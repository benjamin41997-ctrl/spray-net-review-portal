import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const platforms = ['google','angi','thumbtack','apple','yelp'] as const;
export type Platform = typeof platforms[number];
export type Job = {id:string;internal_name:string;title:string;source:string;status:string;links:Record<string,string>;demo:number;revision:number;created_at:string;updated_at:string;photos:Photo[];qrs?:QR[]};
export type Photo = {id:string;job_id:string;label:string;kind:string;position:number;mime:string};
export type QR = {token:string;label:string;batch_id:string;job_id:string|null;assigned_at:string|null};
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function db(){if(!env.DB)throw new HttpError(503,'Storage is unavailable. Please try again later.');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new HttpError(503,'Photo storage is unavailable. Please try again later.');return env.BUCKET;}
export function settings(){return {origin:env.PUBLIC_ORIGIN || (import.meta.env.DEV?'http://localhost:5173':''),local:import.meta.env.DEV,
  transcription:!!env.OPENAI_API_KEY,cleanup:env.ENABLE_AI_CLEANUP==='true'&&!!env.OPENAI_API_KEY};}
export async function isAdmin(){const user=await getChatGPTUser();if(!user)return false;
  if(import.meta.env.DEV && user.userId==='local_seedy')return true;
  return (env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(user.email.toLowerCase());}
export async function requireAdmin(){if(!await isAdmin())throw new HttpError(403,'Administrator sign-in required.');}
export function sameOrigin(r:Request){if(r.headers.get('origin')!==new URL(r.url).origin)throw new HttpError(403,'Please use the portal to make this change.');}
export async function body(r:Request){if(+(r.headers.get('content-length')||0)>65536)throw new HttpError(413,'That request is too large.');const t=await r.text();if(t.length>65536)throw new HttpError(413,'That request is too large.');try{return JSON.parse(t);}catch{throw new HttpError(400,'Invalid request.');}}
export function clean(value:unknown,max=160){if(typeof value!=='string'||!value.trim()||value.length>max)throw new HttpError(400,'Please check the required fields.');return value.trim();}
export function links(input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpError(400,'Invalid review links.');const out:Record<string,string>={};
 for(const p of platforms){const v=(input as any)[p];if(!v)continue;let u:URL;try{u=new URL(clean(v,2048));}catch{throw new HttpError(400,'Enter a complete HTTPS review link.');}
 const hosts:Record<string,string[]>= {google:['google.com','g.page','maps.app.goo.gl'],angi:['angi.com','angieslist.com','homeadvisor.com'],thumbtack:['thumbtack.com'],apple:['maps.apple.com'],yelp:['yelp.com']};
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[p].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw new HttpError(400,`Use an official ${p} HTTPS link.`);out[p]=u.href;}return out;}
export function token(){const a=new Uint8Array(24);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export async function getJob(id:string):Promise<Job>{const j=await db().prepare('SELECT * FROM jobs WHERE id=?').bind(id).first<any>();if(!j)throw new HttpError(404,'This project could not be found.');
 j.links=JSON.parse(j.links);j.photos=(await db().prepare('SELECT id,job_id,label,kind,position,mime FROM photos WHERE job_id=? ORDER BY position,id').bind(id).all()).results;
 j.qrs=(await db().prepare('SELECT * FROM qr_codes WHERE job_id=? ORDER BY label').bind(id).all()).results;return j;}
export async function resolveQR(t:string,preview=false){if(!/^[A-Za-z0-9_-]{32}$/.test(t))throw new HttpError(404,'This page is unavailable.');const q=await db().prepare('SELECT * FROM qr_codes WHERE token=?').bind(t).first<QR>();
 if(!q||!q.job_id)throw new HttpError(404,q?.assigned_at?'This page is no longer available.':"This page isn’t ready yet.");const job=await getJob(q.job_id);
 if(job.status!=='active'&&!(preview&&await isAdmin()))throw new HttpError(404,job.status==='archived'?'This page is no longer available.':"This page isn’t ready yet.");return {q,job};}
export function publicJob(job:Job){return {id:job.id,title:job.title,source:job.source,demo:!!job.demo,links:job.links,photos:job.photos};}
export async function rate(key:string,max:number){const k=`${new Date().toISOString().slice(0,10)}:${key}`;
 const row=await db().prepare('INSERT INTO limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(k,max).first();if(!row)throw new HttpError(429,'Today’s usage limit has been reached. Please type your review instead.');}
export async function event(jobId:string,id:string,type:string,platform:string|null){await db().prepare('INSERT OR IGNORE INTO events(id,job_id,type,platform,created_at) VALUES(?,?,?,?,?)').bind(id,jobId,type,platform,new Date().toISOString()).run();}
