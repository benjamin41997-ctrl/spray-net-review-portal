import {test,expect,type APIRequestContext} from './test';
import {login,site,fixture,patch,startDraft,approveReview,openReviewTab} from './helpers';
import {businessReviewLinks} from '../lib/business';
let admin:APIRequestContext;
test.beforeAll(async()=>{({admin}=await login());});test.afterAll(async()=>{await admin.dispose();});

for(const [platform,name] of [['angi','Angi'],['thumbtack','Thumbtack']] as const){
 async function project(){
  const j=await(await admin.post('/api/admin/jobs',{data:{...fixture,source:platform,include_google:false,links:{[platform]:businessReviewLinks[platform]}}})).json();
  await admin.post('/api/admin/batch',{data:{count:1}});const d=await(await admin.get('/api/admin/dashboard')).json();const qr=d.qrs.find((q:any)=>!q.assigned_at);
  await admin.post('/api/admin/assign',{data:{token:qr.token,job_id:j.id}});await patch(admin,j,'active');return {j,code:qr.token};
 }
 async function activity(id:string){const d=await(await admin.get('/api/admin/dashboard')).json();return d.jobs.find((j:any)=>j.id===id);}

 test(`${name} uses one button to copy approved text and navigate, preserving the draft on return`,async({page})=>{
  const {j,code}=await project();try{
   await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>sessionStorage.setItem('qa-copied-text',text)}}));
   await page.route(businessReviewLinks[platform],r=>r.fulfill({contentType:'text/html',body:'<h1>Mock external review page; nothing posted</h1>'}));
   await page.goto(site+'?code='+code);await startDraft(page);const text='The cabinets look good. Arrival was late.\n\nScheduling could be better.';await page.getByLabel('Your review',{exact:true}).fill(text);await approveReview(page);
   const card=page.locator(`.destination[data-platform=${platform}]`),button=card.getByRole('button',{name:`Paste my review to ${name}`,exact:true});await expect(button).toBeEnabled();await expect(card.getByRole('button')).toHaveCount(1);await expect(card.getByRole('link')).toHaveCount(0);
   await openReviewTab(page,businessReviewLinks[platform],()=>button.click());await expect(page.getByRole('heading',{name:'Thank you for sharing your experience!',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);expect(await page.evaluate(()=>sessionStorage.getItem('qa-copied-text'))).toBe(text);await expect(card.getByRole('button',{name:'Something went wrong? Try again',exact:true})).toBeEnabled();
   await expect.poll(async()=>(await activity(j.id)).clicks).toBe(1);expect((await activity(j.id)).reported).toBe(0);
  }finally{await admin.delete('/api/admin/jobs/'+j.id);}
 });

 test(`${name} stays on the portal when copying fails and supports manual copying`,async({page})=>{
  const {j,code}=await project();try{
   await page.addInitScript(()=>{document.execCommand=()=>false;Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
   await page.goto(site+'?code='+code);await startDraft(page);const text='My own honest feedback.';await page.getByLabel('Your review',{exact:true}).fill(text);await approveReview(page);
   await page.getByRole('button',{name:`Paste my review to ${name}`,exact:true}).click();await expect(page.getByRole('status')).toContainText('couldn’t copy automatically');await expect(page).toHaveURL(site+'?code='+code);expect((await activity(j.id)).clicks).toBe(0);
   expect(await page.getByLabel('Your review',{exact:true}).evaluate((el:HTMLTextAreaElement)=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(text);
   await page.route(businessReviewLinks[platform],r=>r.fulfill({body:'Mock external platform; nothing posted'}));await openReviewTab(page,businessReviewLinks[platform],()=>page.getByRole('button',{name:`Continue to ${name}`,exact:true}).click());await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);await expect.poll(async()=>(await activity(j.id)).clicks).toBe(1);expect((await activity(j.id)).reported).toBe(0);
  }finally{await admin.delete('/api/admin/jobs/'+j.id);}
 });
}
