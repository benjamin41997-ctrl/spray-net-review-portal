import {test,expect,type Page} from '@playwright/test';
import {login,browserAdmin,site,origin,startDraft} from './helpers';
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
 if(!await page.evaluate(()=>typeof MediaRecorder!=='undefined')){await expect(page.getByText('Recording is unavailable in this browser.',{exact:false})).toBeVisible();await page.getByLabel('Your review',{exact:true}).fill(original);}else{
  await expect(page.getByRole('button',{name:/Stop recording/})).toBeVisible();await page.getByRole('button',{name:/Stop recording/}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
 }
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('The cabinets look good.\n\nWe started a day late.');
 await page.getByRole('button',{name:'Use my original wording',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
 await page.getByRole('button',{name:'Go directly to review options',exact:true}).click();await expect(page.getByRole('button',{name:'Paste my review to Google',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Edit my review',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
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
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(formatted);expect(calls).toBe(1);await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(formatted);await expect(page.getByRole('button',{name:'Use my original wording',exact:true})).toBeVisible();
 const final=formatted+' I would ask about the schedule next time.';await page.getByLabel('Your review',{exact:true}).fill(final);await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Skip photos',exact:true}).click();
 await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();await expect(page).toHaveURL('https://g.page/r/CdBR4AUNk5DkEAI/review');await page.goBack();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(final);expect(await page.evaluate(()=>sessionStorage.getItem('qa-copied-text'))).toBe(final);
});

test('failed AI request leaves exact original available and AI can be bypassed',async({page})=>{
 const code=await setup(page);let calls=0;await page.route('**/api/customer/*/cleanup',r=>{calls++;return r.fulfill({status:502,headers:{'Access-Control-Allow-Origin':origin},json:{error:'Editing is unavailable.'}});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'type');const text='Good finish, but scheduling needs work.';await page.getByLabel('Your review',{exact:true}).fill(text);await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Editing is unavailable');await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('checkbox',{name:'Automatically format my review',exact:true}).uncheck();await page.reload();await expect(page.getByRole('checkbox',{name:'Automatically format my review',exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
});
