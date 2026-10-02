import {test,expect,type APIRequestContext} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {login,site,fixture,patch} from './helpers';
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

test('one tap copies exactly the approved review, opens Google, and restores draft after Back',async({page})=>{
 const {j,code}=await project();
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>sessionStorage.setItem('qa-copied-text',text)}});});
 // Google is intercepted: this test never sends feedback or clicks Post.
 await page.route(googleReviewURL,r=>r.fulfill({contentType:'text/html',body:'<h1>Mock Google sign-in / review page</h1>'}));
 await page.goto(site+'?code='+code);const button=page.getByRole('button',{name:'Copy review & open Google',exact:true});await expect(button).toBeDisabled();
 const text='The cabinets look good. Arrival was late.\nI would ask about scheduling next time.';
 await page.getByLabel('Your review',{exact:true}).fill(text);await expect(button).toBeDisabled();await page.getByRole('checkbox',{name:'I’ve checked this text.'}).check();
 await expect(page.getByText('Google may ask you to sign in.',{exact:false})).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/google-handoff-${test.info().project.name}.png`,fullPage:true});
 await button.click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);await expect(page.getByRole('checkbox',{name:'I’ve checked this text.'})).toBeChecked();
 await expect(button).toBeEnabled();
 expect(await page.evaluate(()=>sessionStorage.getItem('qa-copied-text'))).toBe(text);
 await expect.poll(async()=>(await row(j.id)).clicks).toBe(1);expect((await row(j.id)).reported).toBe(0);
 await page.getByLabel('Your review',{exact:true}).fill(text+' Updated.');await expect(button).toBeDisabled();
 await admin.delete('/api/admin/jobs/'+j.id);
});

test('denied clipboard selects text, preserves draft and records no external click',async({page})=>{
 const {j,code}=await project();await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new DOMException('Denied','NotAllowedError');}}}));
 await page.goto(site+'?code='+code);const text='My honest feedback.';await page.getByLabel('Your review',{exact:true}).fill(text);await page.getByRole('checkbox',{name:'I’ve checked this text.'}).check();
 await page.getByRole('button',{name:'Copy review & open Google',exact:true}).click();await expect(page.getByRole('status')).toContainText('couldn’t copy automatically');expect(page.url()).toBe(site+'?code='+code);
 expect(await page.getByLabel('Your review',{exact:true}).evaluate((el:HTMLTextAreaElement)=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(text);
 expect((await row(j.id)).clicks).toBe(0);await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);await admin.delete('/api/admin/jobs/'+j.id);
});

test('direct Google link stays available without drafting, approval, or portal login',async({page,context})=>{
 const {j,code}=await project();await context.route(googleReviewURL,r=>r.fulfill({body:'Mock Google page; no public submission.'}));
 await page.goto(site+'?code='+code);await expect(page.getByRole('button',{name:'Copy review & open Google',exact:true})).toBeDisabled();
 const link=page.getByRole('link',{name:'Continue to Google',exact:true});await expect(link).toHaveAttribute('href',googleReviewURL);
 const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await expect(popup).toHaveURL(googleReviewURL);await popup.close();
 await expect.poll(async()=>(await row(j.id)).clicks).toBe(1);expect((await row(j.id)).reported).toBe(0);await admin.delete('/api/admin/jobs/'+j.id);
});
