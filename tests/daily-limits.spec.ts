import {test,expect} from './test';
import {handle} from '../backend/api';
import type {Env} from '../backend/types';

const origin='https://benjamin41997-ctrl.github.io';
const token='D'.repeat(32);
function environment(){
 const counts=new Map<string,number>();
 const db={prepare(sql:string){let values:unknown[]=[];const statement={bind(...input:unknown[]){values=input;return statement;},async first(){
  if(sql.startsWith('SELECT * FROM qr_codes'))return {job_id:'limit-job'};
  if(sql.startsWith('SELECT * FROM jobs'))return {id:'limit-job',source:'direct',demo:0,status:'active',links:'{}'};
  if(sql.startsWith('INSERT INTO limits')){const key=String(values[0]);const count=counts.get(key)||0;if(count>=Number(values[1]))return null;counts.set(key,count+1);return {count:count+1};}
  return null;
 },async all(){return {results:[]};}};return statement;}};
 const env:Env={DB:db as unknown as D1Database,ENVIRONMENT:'production',ALLOWED_ORIGINS:origin,OPENAI_API_KEY:'fake-test-key',ENABLE_AI_CLEANUP:'true'};
 return {env,counts};
}
function request(action:'cleanup'|'transcribe'){
 if(action==='cleanup')return new Request(`https://api.example.test/api/customer/${token}/${action}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text:'Our cabinets look great.'})});
 const form=new FormData();form.set('audio',new File(['test recording'],'review.webm',{type:'audio/webm'}));
 return new Request(`https://api.example.test/api/customer/${token}/${action}`,{method:'POST',headers:{Origin:origin},body:form});
}
test('each link gets 15 edits and 15 transcriptions independently; request 16 never reaches the provider',async()=>{
 const previous=globalThis.fetch;const {env}=environment();let calls=0;
 try{
  globalThis.fetch=(async input=>{calls++;return String(input).endsWith('/transcriptions')?Response.json({text:'Our cabinets look great.'}):Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({status:'ready',review:'Our cabinets look great.'})}]}]});}) as typeof fetch;
  for(const action of ['cleanup','transcribe'] as const){
   for(let i=0;i<15;i++)expect((await handle(request(action),env)).status).toBe(200);
   const before=calls;const blocked=await handle(request(action),env);expect(blocked.status).toBe(429);expect(calls).toBe(before);
  }
  expect(calls).toBe(30);
 }finally{globalThis.fetch=previous;}
});
test('the existing 100-per-operation site allowance still blocks provider calls',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=(async()=>{calls++;throw Error('Provider must not be reached');}) as typeof fetch;
  for(const action of ['cleanup','transcribe'] as const){
   const {env,counts}=environment();counts.set(`${new Date().toISOString().slice(0,10)}:${action}:global`,100);
   expect((await handle(request(action),env)).status).toBe(429);
  }
  expect(calls).toBe(0);
 }finally{globalThis.fetch=previous;}
});
