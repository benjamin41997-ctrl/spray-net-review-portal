import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {login,browserAdmin,site,origin,startDraft} from './helpers';

async function setup(page:Page){
 const {admin,token}=await login();
 const sample=await(await admin.post('/api/admin/seed',{data:{}})).json();
 await admin.dispose();await browserAdmin(page,token);
 await page.route('**/api/customer/'+sample.qrs[0].token+'?preview=1',async route=>{
  const response=await route.fetch();const data=await response.json();data.settings={transcription:true,cleanup:true};
  await route.fulfill({response,json:data});
 });
 return sample.qrs[0].token;
}
const headers={'Access-Control-Allow-Origin':origin};

test('preparation remains active beyond 25 seconds and advances only after the real edit completes',async({page})=>{
 const code=await setup(page);
 let finishEdit!:()=>void;const editGate=new Promise<void>(resolve=>{finishEdit=resolve;});
 const original='The cabinets look great. This was a training job, and the crew told us when the first day would start late.';
 const edited='The cabinets look great. This was a training job, and the crew let us know that the first day would start late.';
 await page.route('**/api/customer/*/cleanup',async route=>{await editGate;await route.fulfill({headers,json:{text:edited}});});
 try{
  await page.goto(site+'?code='+code+'&preview=1');await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill(original);
  await page.clock.install();await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Preparing your review…',exact:true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Tidying spelling, grammar, and sentence flow');
  const bar=page.getByRole('progressbar',{name:'Preparing your review'});await expect(bar).toBeVisible();expect(await bar.getAttribute('aria-valuenow')).toBeNull();
  await expect(page.getByRole('button',{name:'Back',exact:true})).toBeDisabled();await expect(page.getByLabel('Your review',{exact:true})).toHaveCount(0);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:`.sites-runtime/qa/preparing-review-${test.info().project.name}.png`,fullPage:true});
  await page.clock.fastForward(26000);
  await expect(page.getByRole('status')).toContainText('Still working. This is taking a little longer.');
  await expect(bar).toBeVisible();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toHaveCount(0);
  finishEdit();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(bar).toHaveCount(0);
  await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(edited);
  await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(edited);
 }finally{finishEdit();}
});

test('voice stages change on real responses and editing failure restores the transcript without a timer delay',async({page})=>{
 const code=await setup(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
  class Recorder {static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;onerror:any;start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['mock recorded speech'],{type:this.mimeType})});this.onstop?.();}}
  Object.defineProperty(window,'MediaRecorder',{value:Recorder});
 });
 let finishTranscript!:()=>void,finishEdit!:()=>void;
 const transcriptGate=new Promise<void>(resolve=>{finishTranscript=resolve;});const editGate=new Promise<void>(resolve=>{finishEdit=resolve;});
 const original='The finish looks good, but the first day started late.';
 await page.route('**/api/customer/*/transcribe',async route=>{await transcriptGate;await route.fulfill({headers,json:{text:original}});});
 await page.route('**/api/customer/*/cleanup',async route=>{await editGate;await route.fulfill({status:502,headers,json:{error:'Editing is unavailable.'}});});
 try{
  await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'voice');
  await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.getByRole('button',{name:/Done recording/}).click();
  await expect(page.getByRole('status')).toContainText('Turning your recording into text');
  expect(await page.locator('.preparation-track span').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  finishTranscript();await expect(page.getByRole('status')).toContainText('Tidying spelling, grammar, and sentence flow');
  finishEdit();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('Editing is unavailable');
  await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();
 }finally{finishTranscript();finishEdit();}
});
