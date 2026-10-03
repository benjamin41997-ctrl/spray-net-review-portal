import {test,expect} from './test';
import {handle} from '../backend/api';
import type {Env} from '../backend/types';
const token='B'.repeat(32),portal='https://benjamin41997-ctrl.github.io';
function environment(demo=1,status='active',quotaReached=false):Env{
 const db={prepare(sql:string){const statement={bind(..._values:unknown[]){return statement;},async first(){if(sql.startsWith('SELECT * FROM qr_codes'))return {job_id:'preview-job'};if(sql.startsWith('SELECT * FROM jobs'))return {id:'preview-job',internal_name:'PRIVATE job name',title:'PRIVATE greeting',source:'training',demo,status,links:'{}'};if(sql.startsWith('INSERT INTO limits'))return quotaReached?null:{count:1};return null;},async all(){return {results:[]};}};return statement;}};
 return {DB:db as unknown as D1Database,ENVIRONMENT:'production',ALLOWED_ORIGINS:portal,PREVIEW_QR_TOKEN:token,OPENAI_API_KEY:'fake-test-key',ENABLE_AI_CLEANUP:'true',REVIEW_EDITOR_MODEL:'gpt-6-luna'};
}
const previewRequest=()=>new Request('https://api.example.test/api/preview');
test('preview exposes only the designated active demo token and capabilities, with no admin access',async()=>{
 const response=await handle(previewRequest(),environment());expect(response.status).toBe(200);expect(await response.json()).toEqual({token,settings:{transcription:true,cleanup:true}});
 expect((await handle(previewRequest(),{...environment(),PREVIEW_QR_TOKEN:undefined})).status).toBe(503);
 expect((await handle(previewRequest(),environment(0))).status).toBe(503);
 expect((await handle(previewRequest(),environment(1,'archived'))).status).toBe(404);
 const admin=await handle(new Request('https://api.example.test/api/admin/dashboard'),environment());expect(admin.status).toBe(403);
});
test('preview requests use Luna server-side and quota rejection prevents another paid request',async()=>{
 const previous=globalThis.fetch;let calls=0;
 const request=()=>new Request(`https://api.example.test/api/customer/${token}/cleanup`,{method:'POST',headers:{Origin:portal,'Content-Type':'application/json'},body:JSON.stringify({text:'The crew was friendly, but arrived late.'})});
 try{
  globalThis.fetch=(async(url:any,options:any)=>{calls++;expect(url).toBe('https://api.openai.com/v1/responses');const payload=JSON.parse(options.body);expect(payload.model).toBe('gpt-6-luna');expect(payload.reasoning).toEqual({effort:'low'});expect(payload.input).toBe('The crew was friendly, but arrived late.');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'The crew at Spray-Net South Charlotte was friendly, but arrived late.'}]}]});}) as typeof fetch;
  const response=await handle(request(),environment());expect(response.status).toBe(200);expect((await response.json() as any).text).toContain('arrived late');expect(calls).toBe(1);
  expect((await handle(request(),environment(1,'active',true))).status).toBe(429);expect(calls).toBe(1);
 }finally{globalThis.fetch=previous;}
});
