import {test,expect,type Page} from './test';
import AxeBuilder from '@axe-core/playwright';
import {login,browserAdmin,site,origin,startDraft,openReviewTab} from './helpers';
async function setup(page:Page,cleanup=true){
 const {admin,token}=await login();const sample=await(await admin.post('/api/admin/seed',{data:{}})).json();await admin.dispose();await browserAdmin(page,token);
 await page.route('**/api/customer/'+sample.qrs[0].token+'?preview=1',async route=>{const response=await route.fetch();const data=await response.json();data.settings={transcription:true,cleanup};await route.fulfill({response,json:data});});
 return sample.qrs[0].token;
}
test('recording, transcription and AI formatting preserve original wording and customer approval',async({page})=>{
 const code=await setup(page);
 await page.addInitScript(()=>{const AudioCtx=window.AudioContext||(window as any).webkitAudioContext;let context:any;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{context=new AudioCtx();const oscillator=context.createOscillator();const output=context.createMediaStreamDestination();oscillator.connect(output);oscillator.start();return output.stream;}});});
 const headers={'Access-Control-Allow-Origin':origin};
 const original='The cabinets look good. We started a day late.';
 await page.route('**/api/customer/*/transcribe',r=>r.fulfill({headers,json:{text:original}}));
 await page.route('**/api/customer/*/cleanup',r=>{expect(r.request().postDataJSON()).toEqual({text:original});return r.fulfill({headers,json:{text:'The cabinets look good.\n\nWe started a day late.'}});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'voice');await page.getByRole('button',{name:'Start recording',exact:true}).click();
 if(!await page.evaluate(()=>typeof MediaRecorder!=='undefined')){await expect(page.getByText('Recording is unavailable in this browser.',{exact:false})).toBeVisible();await page.getByLabel('Your review',{exact:true}).fill(original);await page.getByRole('button',{name:'Next',exact:true}).click();}else{
  await expect(page.getByRole('button',{name:/Done recording/})).toBeVisible();await page.getByRole('button',{name:/Done recording/}).click();
 }
 await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('The cabinets look good.\n\nWe started a day late.');
 if(await page.evaluate(()=>typeof MediaRecorder!=='undefined')){await page.getByText('Your recording',{exact:true}).click();await page.getByRole('button',{name:'Retry transcription',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('The cabinets look good.\n\nWe started a day late.');}
 await page.getByRole('button',{name:'Use my original wording',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
 await expect(page.getByRole('button',{name:'Go directly to review options',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Paste my review to Google',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
});

test('microphone permission denial or lack of recording support preserves the draft',async({page})=>{
 const code=await setup(page,false);
 await page.addInitScript(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('Denied','NotAllowedError');}}));
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'voice');await page.getByLabel('Your review',{exact:true}).fill('My original feedback.');const supported=await page.evaluate(()=>typeof MediaRecorder!=='undefined');await page.getByRole('button',{name:'Start recording',exact:true}).click();await expect(page.getByText(supported?'Microphone access was declined.':'Recording is unavailable in this browser.',{exact:false})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('My original feedback.');
});

test('typed review uses AI, retains criticism and training disclosure, and copies the customer final edit',async({page})=>{
 const code=await setup(page);const original='this was a training job. looks good but arival was late.';const formatted='This was a training job.\n\nIt looks good, but arrival was late.';
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>sessionStorage.setItem('qa-copied-text',text)}}));
 let calls=0;await page.route('**/api/customer/*/cleanup',r=>{calls++;expect(r.request().postDataJSON()).toEqual({text:original});return r.fulfill({headers:{'Access-Control-Allow-Origin':origin},json:{text:formatted}});});
 await page.route('https://g.page/r/CdBR4AUNk5DkEAI/review',r=>r.fulfill({body:'Mock Google. No submission.'}));
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page);await expect(page.getByRole('checkbox',{name:'Automatically format my review',exact:true})).toBeChecked();await page.getByLabel('Your review',{exact:true}).fill(original);await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(formatted);expect(calls).toBe(1);await expect(page.getByText('We’ve tidied the wording.',{exact:false})).toBeVisible();await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(formatted);await expect(page.getByRole('button',{name:'Use my original wording',exact:true})).toBeVisible();
 const final=formatted+' I would ask about the schedule next time.';await page.getByLabel('Your review',{exact:true}).fill(final);await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:"Don't share my photos, I don't want neighbors to be jealous…",exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
 await openReviewTab(page,'https://g.page/r/CdBR4AUNk5DkEAI/review',()=>page.getByRole('button',{name:'Paste my review to Google',exact:true}).click());await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(final);expect(await page.evaluate(()=>sessionStorage.getItem('qa-copied-text'))).toBe(final);
});

test('failed AI request leaves exact original available and AI can be bypassed',async({page})=>{
 const code=await setup(page);let calls=0;await page.route('**/api/customer/*/cleanup',r=>{calls++;return r.fulfill({status:502,headers:{'Access-Control-Allow-Origin':origin},json:{error:'Editing is unavailable.'}});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'type');const text='Good finish, but scheduling needs work.';await page.getByLabel('Your review',{exact:true}).fill(text);await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Editing is unavailable');await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('checkbox',{name:'Automatically format my review',exact:true}).uncheck();await page.reload();await expect(page.getByRole('checkbox',{name:'Automatically format my review',exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
});

test('a short review can continue unchanged or expand using only customer-added details',async({page})=>{
 const code=await setup(page);const headers={'Access-Control-Allow-Origin':origin};const inputs:string[]=[];
 await page.route('**/api/customer/*/cleanup',r=>{const {text}=r.request().postDataJSON();inputs.push(text);return r.fulfill({headers,json:{text}});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('Great job.');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByText('Or tap Next to keep it short.',{exact:true})).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/short-review-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Add more detail',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('Great job.');
 const expanded='Great job. It was a training job. Arrival was late, but they warned me ahead of time.';await page.getByLabel('Your review',{exact:true}).fill(expanded);await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(expanded);expect(inputs).toEqual(['Great job.',expanded]);await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(expanded);
});

test('voice formatting opt-out goes directly to the check step and an empty transcript keeps the draft',async({page})=>{
 const code=await setup(page);let edits=0;let blank=true;const headers={'Access-Control-Allow-Origin':origin};
 // Deterministic recording stub exercises the flow on both engines without a microphone.
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
  class Recorder {static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;onerror:any;start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['mock recorded speech'],{type:this.mimeType})});this.onstop?.();}}
  Object.defineProperty(window,'MediaRecorder',{value:Recorder});
 });
 await page.route('**/api/customer/*/transcribe',r=>r.fulfill({headers,json:{text:blank?'':'They warned me ahead of time.'}}));
 await page.route('**/api/customer/*/cleanup',r=>{edits++;return r.fulfill({headers,json:{text:'Unexpected edit'}});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'voice');await page.getByLabel('Your review',{exact:true}).fill('Great job.');await page.getByRole('checkbox',{name:'Automatically format my review',exact:true}).uncheck();
 await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.getByRole('button',{name:/Done recording/}).click();await expect(page.getByText('No clear speech was detected.',{exact:false})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('Great job.');
 blank=false;await page.getByText('Your recording',{exact:true}).click();await page.getByRole('button',{name:'Retry transcription',exact:true}).click();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('Great job.\n\nThey warned me ahead of time.');expect(edits).toBe(0);
});
