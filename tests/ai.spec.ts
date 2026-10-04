import {test,expect} from './test';
import {handle} from '../backend/api';
import type {Env} from '../backend/types';
import {reviewEditingInstructions} from '../backend/review-editor';
const qr='A'.repeat(32),portal='https://portal.example.test';
function environment():Env{
 const db={prepare(sql:string){const statement={bind(..._values:unknown[]){return statement;},async first(){if(sql.startsWith('SELECT * FROM qr_codes'))return {job_id:'test-job'};if(sql.startsWith('SELECT * FROM jobs'))return {id:'test-job',title:'Test job',source:'training',status:'active',links:'{"google":"https://g.page/r/test/review"}'};return {count:1};},async all(){return {results:[]};}};return statement;}};
 return {DB:db as unknown as D1Database,ALLOWED_ORIGINS:portal,OPENAI_API_KEY:'fake-test-key',ENABLE_AI_CLEANUP:'true'};
}
const request=()=>new Request(`https://api.example.test/api/customer/${qr}/cleanup`,{method:'POST',headers:{Origin:portal,'Content-Type':'application/json'},body:JSON.stringify({text:'This was a training job. Finish looks good, but arrival was late.'})});
test('editor clarification and refusals are separate from review text; short and negative reviews remain usable',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const content of [
   {type:'output_text',text:JSON.stringify({status:'needs_more_detail',review:''})},
   {type:'refusal',refusal:'Cannot edit this input.'},
   {type:'output_text',text:'Could you share your notes about the project or your experience with Spray-Net South Charlotte?'},
   {type:'output_text',text:JSON.stringify({status:'ready',review:'Could you share some project details?'})}
  ]){
   globalThis.fetch=(async()=>Response.json({status:'completed',output:[{content:[content]}]})) as typeof fetch;
   const response=await handle(request(),environment());expect(response.status).toBe(200);const result=await response.json() as any;expect(result.status).toBe('needs_more_detail');expect(result.text).toBeUndefined();expect(result.message).toContain('short, honest review');
  }
  for(const review of ['Great job.','Disappointed.','Why did they leave a mess? Nobody replied to my follow-up.']){
   globalThis.fetch=(async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'ready',review})}]}]})) as typeof fetch;
   const response=await handle(request(),environment());expect(await response.json()).toEqual({status:'ready',text:review});
  }
 }finally{globalThis.fetch=previous;}
});
test('server refuses truncated, empty, or oversized edits so criticism cannot be lost to truncation',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const result of [{status:'incomplete',output:[{content:[{type:'output_text',text:'The finish looks good.'}]}]},{status:'completed',output:[]},{status:'completed',output:[{content:[{type:'output_text',text:'x'.repeat(8001)}]}]}]){
   globalThis.fetch=(async()=>Response.json(result)) as typeof fetch;
   const r=await handle(request(),environment());expect(r.status).toBe(502);expect((await r.json() as any).text).toBeUndefined();
  }
 }finally{globalThis.fetch=previous;}
});
test('AI receives only customer words and no response storage; independent flag and missing key prevent requests',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=(async(input:any,init:any)=>{calls++;expect(input).toBe('https://api.openai.com/v1/responses');const payload=JSON.parse(init.body);expect(payload.model).toBe('gpt-6.1-sol');expect(payload.reasoning).toEqual({effort:'low'});expect(payload.instructions).toBe(reviewEditingInstructions);expect(payload.input).toBe('This was a training job. Finish looks good, but arrival was late.');expect(payload.store).toBe(false);expect(payload.text.format.strict).toBe(true);expect(payload.text.format.schema.properties.status.enum).toEqual(['ready','needs_more_detail']);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'ready',review:payload.input})}]}]});}) as typeof fetch;
  expect((await handle(request(),{...environment(),ENABLE_AI_CLEANUP:'false'})).status).toBe(403);
  expect((await handle(request(),{...environment(),OPENAI_API_KEY:''})).status).toBe(403);expect(calls).toBe(0);
  const result=await handle(request(),environment());expect(result.status).toBe(200);expect((await result.json() as any).text).toContain('arrival was late');expect(calls).toBe(1);
 }finally{globalThis.fetch=previous;}
});

test('local Luna editing uses low reasoning and the same customer-only instructions',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=(async(_input:any,init:any)=>{const payload=JSON.parse(init.body);expect(payload.model).toBe('gpt-6-luna');expect(payload.reasoning).toEqual({effort:'low'});expect(payload.instructions).toBe(reviewEditingInstructions);expect(payload.store).toBe(false);expect(payload.input).toContain('training job');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'ready',review:payload.input})}]}]});}) as typeof fetch;
  const result=await handle(request(),{...environment(),REVIEW_EDITOR_MODEL:'gpt-6-luna'});expect(result.status).toBe(200);expect((await result.json() as any).text).toContain('arrival was late');
 }finally{globalThis.fetch=previous;}
});

test('a configured legacy editor does not receive unsupported reasoning parameters',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=(async(_input:any,init:any)=>{const payload=JSON.parse(init.body);expect(payload.model).toBe('gpt-4.1-mini');expect(payload.reasoning).toBeUndefined();return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'ready',review:payload.input})}]}]});}) as typeof fetch;
  expect((await handle(request(),{...environment(),REVIEW_EDITOR_MODEL:'gpt-4.1-mini'})).status).toBe(200);
 }finally{globalThis.fetch=previous;}
});

test('transcription sends audio server-side, supports model configuration, and rejects missing or oversized speech',async()=>{
 const previous=globalThis.fetch;let calls=0;let transcript:unknown='Arrival was late, but they let us know.';
 function audioRequest(){const form=new FormData();form.set('audio',new File(['mock recorded speech'],'review.webm',{type:'audio/webm'}));return new Request(`https://api.example.test/api/customer/${qr}/transcribe`,{method:'POST',headers:{Origin:portal},body:form});}
 try{
  globalThis.fetch=(async(input:any,init:any)=>{calls++;expect(input).toBe('https://api.openai.com/v1/audio/transcriptions');expect(init.body.get('model')).toBe(calls===1?'gpt-transcribe':'gpt-4o-mini-transcribe');expect(await init.body.get('file').text()).toBe('mock recorded speech');return Response.json({text:transcript});}) as typeof fetch;
  expect((await handle(audioRequest(),{...environment(),OPENAI_API_KEY:''})).status).toBe(503);expect(calls).toBe(0);
  const valid=await handle(audioRequest(),environment());expect(valid.status).toBe(200);expect((await valid.json() as any).text).toBe(transcript);
  for(const invalid of ['',null,'x'.repeat(8001)]){transcript=invalid;const response=await handle(audioRequest(),{...environment(),TRANSCRIPTION_MODEL:'gpt-4o-mini-transcribe'});expect(response.status).toBe(invalid===''||invalid===null?422:502);expect((await response.json() as any).text).toBeUndefined();}
 }finally{globalThis.fetch=previous;}
});
