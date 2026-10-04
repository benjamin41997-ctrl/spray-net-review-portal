import {test,expect,type Page} from './test';
import {login,browserAdmin,site,origin,startDraft} from './helpers';
async function setup(page:Page){
 const {admin,token}=await login();const sample=await(await admin.post('/api/admin/seed',{data:{}})).json();await admin.dispose();await browserAdmin(page,token);
 const code=sample.qrs[0].token;
 await page.route('**/api/customer/'+code+'?preview=1',async route=>{const response=await route.fetch();const data=await response.json();data.settings={transcription:true,cleanup:true};await route.fulfill({response,json:data});});
 return code;
}
const headers={'Access-Control-Allow-Origin':origin};
test('unusable feedback blocks Next, survives reload and edits, then recovers after a successful recheck',async({page})=>{
 const code=await setup(page);let calls=0;
 await page.route('**/api/customer/*/cleanup',route=>{calls++;return route.fulfill({headers,json:calls===1?{status:'needs_more_detail',message:'Please share notes.'}:calls===2?{error:'Editing unavailable.'}:{status:'ready',text:'Great job.'},status:calls===2?502:200});});
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('asdf qwer');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('actual project or experience');await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('asdf qwer');await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await page.reload();await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await page.getByLabel('Your review',{exact:true}).fill('Great job.');await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Check spelling & formatting again'}).click();await expect(page.getByRole('alert').first()).toContainText('Editing unavailable');await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Check spelling & formatting again'}).click();await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('Great job.');
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos'})).toBeVisible();
});
test('legacy assistant questions never enter the review and previously approved cached questions are blocked',async({page})=>{
 const code=await setup(page);const question='Could you share your notes about the project or your experience with Spray-Net South Charlotte?';
 await page.route('**/api/customer/*/cleanup',route=>route.fulfill({headers,json:{text:question}}));
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('zzzzz');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('zzzzz');
 await page.evaluate(({code,question})=>localStorage.setItem('spraynet-review:v1:'+code,JSON.stringify({text:question,original:'zzzzz',aiEdited:true,approved:true,stage:'share',savedAt:Date.now()})),{code,question});
 await page.reload();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('zzzzz');await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:/Paste my review/})).toHaveCount(0);
});
test('voice transcription stays intact when the formatter needs more detail',async({page})=>{
 const code=await setup(page);
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
  class Recorder{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['mock speech'],{type:this.mimeType})});this.onstop?.();}}
  Object.defineProperty(window,'MediaRecorder',{value:Recorder});
 });
 await page.route('**/api/customer/*/transcribe',route=>route.fulfill({headers,json:{text:'Banana spaceship.'}}));
 await page.route('**/api/customer/*/cleanup',route=>route.fulfill({headers,json:{status:'needs_more_detail'}}));
 await page.goto(site+'?code='+code+'&preview=1');await startDraft(page,'voice');await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.getByRole('button',{name:/Done recording/}).click();
 await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('Banana spaceship.');await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
});
