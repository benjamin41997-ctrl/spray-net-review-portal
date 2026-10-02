import type {Env} from './types';
import {createPortal,HttpError,platforms} from './portal';
import {isLocal} from './auth';
import {googleReviewURL} from '../lib/business';
import {reviewEditingInstructions,transcriptionInstructions} from './review-editor';
function json(v:unknown,status=200){return Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
export async function handle(r:Request,env:Env){const {db,bucket,requireAdmin,sameOrigin,body,clean,links,token,getJob,resolveQR,publicJob,settings,rate,event}=createPortal(env,r);try{const p=new URL(r.url).pathname.split('/').filter(Boolean).slice(1);const method=r.method;
 if(method!=='GET')sameOrigin(r);
 if(p[0]==='admin'){
  await requireAdmin();const now=new Date().toISOString();
  if(p[1]==='session'&&method==='GET')return json({allowed:true});
  if(p[1]==='dashboard'&&method==='GET'){
   const jobs=(await db().prepare(`SELECT jobs.*, (SELECT count(*) FROM events e WHERE e.job_id=jobs.id AND e.type='visit') visits, (SELECT count(*) FROM events e WHERE e.job_id=jobs.id AND e.type='click') clicks, (SELECT count(*) FROM events e WHERE e.job_id=jobs.id AND e.type='reported') reported FROM jobs ORDER BY updated_at DESC`).all()).results;
   const qrs=(await db().prepare('SELECT * FROM qr_codes ORDER BY created_at,label').all()).results;
   return json({jobs:jobs.map((j:any)=>({...j,links:JSON.parse(j.links)})),qrs,settings:settings()});
  }
  if(p[1]==='jobs'&&!p[2]&&method==='POST'){const b=await body(r);const source=clean(b.source);if(!['direct','training','angi','thumbtack','other'].includes(source))throw new HttpError(400,'Choose a customer source.');const id=crypto.randomUUID();
   const suppliedLinks=links(b.links);const initialLinks={google:googleReviewURL,...suppliedLinks};
   await db().prepare('INSERT INTO jobs(id,internal_name,title,source,links,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,clean(b.internal_name),clean(b.title),source,JSON.stringify(initialLinks),now,now).run();return json(await getJob(id),201);}
  if(p[1]==='jobs'&&p[2]){const id=p[2];
   if(method==='GET')return json(await getJob(id));
   if(method==='PATCH'){const b=await body(r);const source=clean(b.source);if(!['direct','training','angi','thumbtack','other'].includes(source)||!['draft','active','archived'].includes(b.status)||!Number.isInteger(b.revision))throw new HttpError(400,'Check the project fields.');const safeLinks=links(b.links);
    if(b.status==='active'&&!Object.keys(safeLinks).some(x=>x!=='yelp'))throw new HttpError(400,'Add at least one review destination before activation.');
    const result=await db().prepare('UPDATE jobs SET internal_name=?,title=?,source=?,links=?,status=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id').bind(clean(b.internal_name),clean(b.title),source,JSON.stringify(safeLinks),b.status,now,id,b.revision).first();if(!result)throw new HttpError(409,'This project changed in another tab. Reload it before saving.');return json(await getJob(id));}
   if(method==='DELETE'){const job=await getJob(id);const keys=(await db().prepare('SELECT object_key FROM photos WHERE job_id=?').bind(id).all<{object_key:string}>()).results;
    await db().batch([db().prepare('UPDATE qr_codes SET job_id=NULL WHERE job_id=?').bind(id),db().prepare('DELETE FROM jobs WHERE id=?').bind(id)]);
    let storageCleanupPending=false;try{for(const photo of keys)await bucket().delete(photo.object_key);}catch{storageCleanupPending=true;}return json({deleted:true,storageCleanupPending});}
  }
  if(p[1]==='batch'&&method==='POST'){const b=await body(r);const count=b.count??100;if(!Number.isInteger(count)||count<1||count>100)throw new HttpError(400,'Choose 1–100 codes.');
   const counter=await db().prepare("INSERT INTO counters(name,value) VALUES('qr',?) ON CONFLICT(name) DO UPDATE SET value=value+excluded.value RETURNING value").bind(count).first<{value:number}>();const batch=crypto.randomUUID();
   await db().batch(Array.from({length:count},(_,i)=>db().prepare('INSERT INTO qr_codes(token,label,batch_id,created_at) VALUES(?,?,?,?)').bind(token(),`SN-${String(counter!.value-count+i+1).padStart(3,'0')}`,batch,now)));
   return json({batch_id:batch},201);}
  if(p[1]==='assign'&&method==='POST'){const b=await body(r);await getJob(clean(b.job_id));const q=await db().prepare('UPDATE qr_codes SET job_id=?,assigned_at=? WHERE token=? AND assigned_at IS NULL AND job_id IS NULL RETURNING *').bind(b.job_id,now,clean(b.token)).first();if(!q)throw new HttpError(409,'This code is already assigned or unavailable. Use an unused sticker.');return json(q);}
  if(p[1]==='reorder'&&method==='POST'){const b=await body(r);const job=await getJob(clean(b.job_id));if(!Array.isArray(b.ids)||b.ids.length!==job.photos.length||new Set(b.ids).size!==b.ids.length||!b.ids.every((id:string)=>job.photos.some(p=>p.id===id)))throw new HttpError(409,'Photos changed. Reload before reordering.');if(b.ids.length)await db().batch(b.ids.map((id:string,i:number)=>db().prepare('UPDATE photos SET position=? WHERE id=? AND job_id=?').bind(i,id,job.id)));return json({saved:true});}
  if(p[1]==='photos'&&method==='POST'){if(+(r.headers.get('content-length')||0)>13*1024*1024)throw new HttpError(413,'Use a photo smaller than 12 MB.');const b=await r.formData();const file=b.get('file');const id=crypto.randomUUID();const job=await getJob(clean(b.get('job_id')));const kind=clean(b.get('kind'));if(!['before','after','detail'].includes(kind))throw new HttpError(400,'Choose a photo type.');
   if(!(file instanceof File)||file.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new HttpError(400,'Upload a JPEG, PNG, or WebP photo under 12 MB.');const bytes=new Uint8Array(await file.arrayBuffer());
   const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)throw new HttpError(400,'That file is not a supported image.');
   if(job.photos.length>=30)throw new HttpError(400,'Use up to 30 photos per project.');const key=`jobs/${job.id}/${id}`;await bucket().put(key,bytes,{httpMetadata:{contentType:file.type}});
   try{await db().prepare('INSERT INTO photos(id,job_id,object_key,label,kind,position,mime) VALUES(?,?,?,?,?,?,?)').bind(id,job.id,key,clean(b.get('label')),kind,job.photos.length,file.type).run();}catch(e){await bucket().delete(key);throw e;}return json(await getJob(job.id));}
  if(p[1]==='photos'&&p[2]){const photo=await db().prepare('SELECT * FROM photos WHERE id=?').bind(p[2]).first<any>();if(!photo)throw new HttpError(404,'Photo unavailable.');
   if(method==='GET'){const obj=await bucket().get(photo.object_key);if(!obj)throw new HttpError(404,'Photo unavailable.');return new Response(obj.body,{headers:{'Content-Type':photo.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
   if(method==='PATCH'){const b=await body(r);if(!Number.isInteger(b.position)||b.position<0||b.position>1000||!['before','after','detail'].includes(b.kind))throw new HttpError(400,'Check photo order and type.');await db().prepare('UPDATE photos SET label=?,kind=?,position=? WHERE id=?').bind(clean(b.label),b.kind,b.position,p[2]).run();return json({saved:true});}
   if(method==='DELETE'){await db().prepare('DELETE FROM photos WHERE id=?').bind(p[2]).run();await bucket().delete(photo.object_key);return json({deleted:true});}
  }
  if(p[1]==='seed'&&method==='POST'){if(!isLocal(r,env))throw new HttpError(404,'Unavailable.');if(await db().prepare("SELECT id FROM jobs WHERE id='sample-kitchen'").first())return json(await getJob('sample-kitchen'));
   await db().prepare('INSERT INTO jobs(id,internal_name,title,source,status,links,demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('sample-kitchen','Sample kitchen · network photos','We loved working with you, Sam!','training','active',JSON.stringify({google:googleReviewURL}),1,now,now).run();
   for(const kind of ['before','after']){const f=await fetch(new URL(`sample/${kind}.webp`,settings().origin));if(!f.ok)throw new HttpError(503,'Sample images unavailable.');const key=`jobs/sample-kitchen/${kind}`;await bucket().put(key,await f.arrayBuffer(),{httpMetadata:{contentType:'image/webp'}});await db().prepare('INSERT INTO photos VALUES(?,?,?,?,?,?,?)').bind(`sample-${kind}`,'sample-kitchen',key,kind==='before'?'Before refinishing':'Finished cabinets',kind,kind==='before'?0:1,'image/webp').run();}
   await db().prepare('INSERT INTO qr_codes(token,label,batch_id,job_id,assigned_at,created_at) VALUES(?,?,?,?,?,?)').bind(token(),'DEMO-001','demo','sample-kitchen',now,now).run();return json(await getJob('sample-kitchen'));}
 }
 if(p[0]==='customer'&&p[1]){const t=p[1];const {job}=await resolveQR(t,new URL(r.url).searchParams.get('preview')==='1');
  if(method==='GET'&&!p[2])return json({...publicJob(job),settings:{transcription:settings().transcription,cleanup:settings().cleanup}});
  if(p[2]==='photo'&&method==='GET'){const photo=await db().prepare('SELECT * FROM photos WHERE id=? AND job_id=?').bind(p[3],job.id).first<any>();if(!photo)throw new HttpError(404,'Photo unavailable.');const obj=await bucket().get(photo.object_key);if(!obj)throw new HttpError(404,'Photo unavailable.');const download=new URL(r.url).searchParams.has('download');return new Response(obj.body,{headers:{'Content-Type':photo.mime,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...(download?{'Content-Disposition':`attachment; filename="spray-net-${photo.kind}-${photo.id.slice(0,8)}.${photo.mime==='image/jpeg'?'jpg':photo.mime==='image/png'?'png':'webp'}"`}:{})}});}
  if(p[2]==='event'&&method==='POST'){if(new URL(r.url).searchParams.has('preview'))return json({saved:false});const b=await body(r);if(!['visit','click','reported'].includes(b.type)||!/^[-a-f0-9]{36}$/.test(b.id)|| (b.type!=='visit'&&!platforms.includes(b.platform)) || (b.type!=='visit'&&!job.links[b.platform]))throw new HttpError(400,'Invalid activity.');await rate(`events:${t}`,200);await event(job.id,b.id,b.type,b.platform||null);return json({saved:true});}
  if(p[2]==='transcribe'&&method==='POST'){if(!settings().transcription)throw new HttpError(503,'Voice transcription is not connected yet. You can type or use your phone keyboard’s microphone.');if(+(r.headers.get('content-length')||0)>10*1024*1024)throw new HttpError(413,'Keep recordings under two minutes.');const b=await r.formData();const f=b.get('audio');if(!(f instanceof File)||f.size>9*1024*1024||!['audio/webm','audio/mp4','audio/ogg','audio/wav','video/webm','video/mp4'].includes(f.type.split(';')[0]))throw new HttpError(400,'Unsupported recording.');await rate(`transcribe:${t}`,5);await rate('transcribe:global',100);const form=new FormData();form.set('file',f);form.set('model',env.TRANSCRIPTION_MODEL||'gpt-transcribe');form.set('prompt',transcriptionInstructions);const res=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form,signal:AbortSignal.timeout(60000)});if(!res.ok)throw new HttpError(502,'Transcription could not finish. Your recording is still available to retry.');const result=await res.json() as any;if(typeof result.text!=='string'||!result.text.trim())throw new HttpError(422,'No clear speech was detected. Please try again or type your review.');if(result.text.length>8000)throw new HttpError(502,'This transcript is too long. Your recording is still available to save or retry.');return json({text:result.text});}
  if(p[2]==='cleanup'&&method==='POST'){
   if(!settings().cleanup)throw new HttpError(403,'Optional AI editing is disabled.');
   const b=await body(r);const text=clean(b.text,8000);
   await rate(`cleanup:${t}`,5);await rate('cleanup:global',100);
   const model=env.REVIEW_EDITOR_MODEL||'gpt-6.1-sol';
   const res=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
     model,
     // Only send this parameter to Sol; legacy non-reasoning overrides reject it.
     ...(model==='gpt-6.1-sol'?{reasoning:{effort:'low'}}:{}),
     instructions:reviewEditingInstructions,input:text,store:false,max_output_tokens:4000
    }),signal:AbortSignal.timeout(45000)
   });
   if(!res.ok)throw new HttpError(502,'Editing is unavailable. Your original text is unchanged.');
   const result=await res.json() as any;
   const edited=result.output?.flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n');
   if(result.status!=='completed'||!edited?.trim()||edited.length>8000)throw new HttpError(502,'The edit could not be completed. Your original text is unchanged.');
   return json({text:edited});
  }
 }
 throw new HttpError(404,'This action is unavailable.');
 }catch(e){if(!(e instanceof HttpError))console.error('Portal operation failed',e);return json({error:e instanceof HttpError?e.message:'Something could not be saved. Please try again.'},e instanceof HttpError?e.status:503);}}
