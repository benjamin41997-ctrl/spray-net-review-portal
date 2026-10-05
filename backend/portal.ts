import type {Env} from './types';
import {authenticate,allowedOrigin,isLocal} from './auth';
import {platforms,type Job,type QR} from '../lib/types';
export {platforms} from '../lib/types';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export function createPortal(env:Env,request:Request){
function db(){if(!env.DB)throw new HttpError(503,'Storage is unavailable. Please try again later.');return env.DB;}
function bucket(){if(!env.BUCKET)throw new HttpError(503,'Photo storage is unavailable. Please try again later.');return env.BUCKET;}
function settings(){return {origin:env.PUBLIC_PORTAL_URL||'',local:isLocal(request,env),transcription:!!env.OPENAI_API_KEY,cleanup:env.ENABLE_AI_CLEANUP==='true'&&!!env.OPENAI_API_KEY};}
async function isAdmin(){return authenticate(request,env);}
async function requireAdmin(){if(!await isAdmin())throw new HttpError(403,'Administrator sign-in required.');}
function sameOrigin(r:Request){if(!allowedOrigin(r,env))throw new HttpError(403,'Please use the portal to make this change.');}
async function body(r:Request){if(+(r.headers.get('content-length')||0)>65536)throw new HttpError(413,'That request is too large.');const t=await r.text();if(t.length>65536)throw new HttpError(413,'That request is too large.');try{return JSON.parse(t);}catch{throw new HttpError(400,'Invalid request.');}}
function clean(value:unknown,max=160){if(typeof value!=='string'||!value.trim()||value.length>max)throw new HttpError(400,'Please check the required fields.');return value.trim();}
function links(input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'Invalid review links.');const out:Record<string,string>={};
 for(const p of platforms){const v=(input as any)[p];if(!v)continue;let u:URL;try{u=new URL(clean(v,2048));}catch{throw new HttpError(400,'Enter a complete HTTPS review link.');}
 const hosts:Record<string,string[]>= {google:['google.com','g.page','maps.app.goo.gl'],angi:['angi.com','angieslist.com','homeadvisor.com'],thumbtack:['thumbtack.com'],apple:['maps.apple.com'],yelp:['yelp.com']};
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[p].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw new HttpError(400,`Use an official ${p} HTTPS link.`);out[p]=u.href;}return out;}
function token(){const a=new Uint8Array(24);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function getJob(id:string,ensureLink=false):Promise<Job>{const j=await db().prepare('SELECT * FROM jobs WHERE id=?').bind(id).first<any>();if(!j)throw new HttpError(404,'This project could not be found.');
 if(ensureLink)await db().prepare('INSERT INTO customer_links(job_id,token,created_at) VALUES(?,?,?) ON CONFLICT(job_id) DO NOTHING').bind(id,token(),new Date().toISOString()).run();
 const direct=await db().prepare('SELECT token FROM customer_links WHERE job_id=?').bind(id).first<{token:string}>();if(direct)j.customer_token=direct.token;
 j.links=JSON.parse(j.links);j.photos=(await db().prepare('SELECT id,job_id,label,kind,position,mime FROM photos WHERE job_id=? ORDER BY position,id').bind(id).all()).results;
 j.qrs=(await db().prepare('SELECT * FROM qr_codes WHERE job_id=? ORDER BY label').bind(id).all()).results;return j;}
async function resolveQR(t:string,preview=false){if(!/^[A-Za-z0-9_-]{32}$/.test(t))throw new HttpError(404,'This page is unavailable.');const q=await db().prepare('SELECT * FROM qr_codes WHERE token=?').bind(t).first<QR>();
 const direct=!q?await db().prepare('SELECT job_id FROM customer_links WHERE token=?').bind(t).first<{job_id:string}>():null;
 if(!q?.job_id&&!direct)throw new HttpError(404,q?.assigned_at?'This page is no longer available.':"This page isn’t ready yet.");const job=await getJob(q?.job_id||direct!.job_id);
 if(job.status!=='active'&&!(preview&&await isAdmin()))throw new HttpError(404,job.status==='archived'?'This page is no longer available.':"This page isn’t ready yet.");return {q,job};}
function publicJob(job:Job){return {id:job.id,title:job.title,source:job.source,demo:!!job.demo,links:job.links,photos:job.photos};}
async function rate(key:string,max:number){const k=`${new Date().toISOString().slice(0,10)}:${key}`;
 const row=await db().prepare('INSERT INTO limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(k,max).first();if(!row)throw new HttpError(429,'Today’s usage limit has been reached. Please type your review instead.');}
async function event(jobId:string,id:string,type:string,platform:string|null){await db().prepare('INSERT OR IGNORE INTO events(id,job_id,type,platform,created_at) VALUES(?,?,?,?,?)').bind(id,jobId,type,platform,new Date().toISOString()).run();}

return {db,bucket,settings,isAdmin,requireAdmin,sameOrigin,body,clean,links,token,getJob,resolveQR,publicJob,rate,event};
}
