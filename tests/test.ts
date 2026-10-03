import {test as base} from '@playwright/test';
export * from '@playwright/test';

// Browser checks must not spend API credits when local credentials are present.
// Individual AI/voice tests can register more specific page routes afterward.
export const test=base.extend({context:async({context},use)=>{
 await context.route('**/api/customer/*/cleanup',async route=>{
  const body=route.request().postDataJSON();
  await route.fulfill({headers:{'Access-Control-Allow-Origin':route.request().headers().origin||'*'},json:{text:body.text}});
 });
 await context.route('**/api/customer/*/transcribe',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':route.request().headers().origin||'*'},json:{error:'Transcription is mocked for automated tests.'}}));
 await use(context);
}});
