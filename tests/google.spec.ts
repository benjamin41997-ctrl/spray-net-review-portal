import {test,expect,type APIRequestContext} from './test';
import AxeBuilder from '@axe-core/playwright';
import {login,site,fixture,patch,startDraft,approveReview,returnToCheck} from './helpers';
import {googleReviewURL} from '../lib/business';
let admin:APIRequestContext;
test.beforeAll(async()=>{({admin}=await login());});
test.afterAll(async()=>{await admin.dispose();});
async function project(){
 const j=await(await admin.post('/api/admin/jobs',{data:{...fixture,source:'direct',links:{}}})).json();
 await admin.post('/api/admin/batch',{data:{count:1}});
 const d=await(await admin.get('/api/admin/dashboard')).json();const qr=d.qrs.find((q:any)=>!q.assigned_at);
 await admin.post('/api/admin/assign',{data:{token:qr.token,job_id:j.id}});await patch(admin,j,'active');return {j,code:qr.token};
}
async function row(id:string){const d=await(await admin.get('/api/admin/dashboard')).json();return d.jobs.find((j:any)=>j.id===id);}

test('new projects receive the official link; edits and originating platform stay in control',async()=>{
 const j=await(await admin.post('/api/admin/jobs',{data:{...fixture,links:{angi:fixture.links.angi}}})).json();
 expect(j.links.google).toBe(googleReviewURL);expect(j.links.angi).toBe(fixture.links.angi);
 const edited=await(await patch(admin,{...j,links:{angi:fixture.links.angi}},'active')).json();
 expect(edited.links.google).toBeUndefined();await admin.delete('/api/admin/jobs/'+j.id);
 const override=await(await admin.post('/api/admin/jobs',{data:fixture})).json();expect(override.links.google).toBe(fixture.links.google);await admin.delete('/api/admin/jobs/'+override.id);
});

test('guided flow copies exactly the approved review and restores the sharing screen after Google',async({page})=>{
 const {j,code}=await project();
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>sessionStorage.setItem('qa-copied-text',text)}});});
 await page.route(googleReviewURL,r=>r.fulfill({contentType:'text/html',body:'<h1>Mock Google sign-in / review page</h1>'}));
 await page.goto(site+'?code='+code);
 await expect(page.getByRole('button',{name:'Type my review',exact:true})).toBeVisible();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveCount(0);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/guided-start-${test.info().project.name}.png`,fullPage:true});
 await startDraft(page);const text='The cabinets look good. Arrival was late.\nI would ask about scheduling next time.';
 await page.getByLabel('Your review',{exact:true}).fill(text);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('button',{name:'Go directly to review options',exact:true})).toHaveCount(0);
 const button=page.getByRole('button',{name:'Paste my review to Google',exact:true});await expect(button).toHaveCount(0);
 await expect(page.getByText('We’ve tidied the wording.',{exact:false})).toBeVisible();
 await expect(page.getByText('Your draft is saved on this device for up to 30 days.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(button).toBeEnabled();
 await expect(page.getByText('Sign in to Google if prompted.',{exact:true})).toBeVisible();await expect(page.locator('.google-steps li')).toHaveCount(6);await expect(page.locator('.google-steps')).toHaveCSS('list-style-type','decimal');await expect(page.getByRole('button',{name:'Edit my review',exact:true})).toHaveCount(0);expect(await button.evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.share-extras')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/google-handoff-${test.info().project.name}.png`,fullPage:true});
 await button.click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();
 await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);await expect(button).toBeEnabled();
 expect(await page.evaluate(()=>sessionStorage.getItem('qa-copied-text'))).toBe(text);
 await expect.poll(async()=>(await row(j.id)).clicks).toBe(1);expect((await row(j.id)).reported).toBe(0);
 await returnToCheck(page);await page.getByLabel('Your review',{exact:true}).fill(text+' Updated.');
 await expect(button).toHaveCount(0);await page.getByRole('button',{name:'Next',exact:true}).click();await expect(button).toBeEnabled();
 await admin.delete('/api/admin/jobs/'+j.id);
});

test('denied clipboard selects approved text and the same button continues after manual copying',async({page})=>{
 const {j,code}=await project();await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new DOMException('Denied','NotAllowedError');}}}));
 await page.goto(site+'?code='+code);await startDraft(page);const text='My honest feedback.';await page.getByLabel('Your review',{exact:true}).fill(text);await approveReview(page);
 await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();await expect(page.getByRole('status')).toContainText('couldn’t copy automatically');expect(page.url()).toBe(site+'?code='+code);
 expect(await page.getByLabel('Your review',{exact:true}).evaluate((el:HTMLTextAreaElement)=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(text);
 expect((await row(j.id)).clicks).toBe(0);await page.route(googleReviewURL,r=>r.fulfill({body:'Mock Google; no public submission.'}));
 await page.getByRole('button',{name:'Continue to Google',exact:true}).click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);await expect.poll(async()=>(await row(j.id)).clicks).toBe(1);expect((await row(j.id)).reported).toBe(0);await admin.delete('/api/admin/jobs/'+j.id);
});

test('share screen has one Google action and no alternate opening or completion controls',async({page})=>{
 const {j,code}=await project();await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My own feedback.');await approveReview(page);
 await expect(page.locator('.destination button')).toHaveCount(1);
 await expect(page.getByText('Open Google without copying',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Already submitted your review?',{exact:true})).toHaveCount(0);
 expect((await row(j.id)).clicks).toBe(0);expect((await row(j.id)).reported).toBe(0);await admin.delete('/api/admin/jobs/'+j.id);
});
