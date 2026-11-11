import {test,expect} from './test';
import {apiBase,fixture,login,patch,site} from './helpers';

test('a legacy desktop draft syncs to a phone, stale edits require a choice, and clearing applies across devices',async({browser,page,request})=>{
 const {admin}=await login();
 const job=await(await admin.post('/api/admin/jobs',{data:fixture})).json();
 const mobile=await browser.newContext({viewport:{width:390,height:844}});
 const code=job.customer_token;const link=site+'?code='+code;
 const endpoint=apiBase+'/api/customer/'+code+'/draft';
 const original='The original review was saved on desktop before syncing existed.';
 const updated='The mobile edit keeps the good finish and the original concern.';
 const localEdit='An older tab should not silently overwrite the mobile edit.';
 try{
  expect((await request.get(endpoint)).status()).toBe(404);
  expect((await patch(admin,job,'active')).ok()).toBe(true);
  await page.addInitScript(({code,original})=>{
   const key='spraynet-review:v1:'+code;
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({text:original,original,stage:'check',approved:false,savedAt:Date.now()}));
  },{code,original});
  await page.goto(link);
  await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
  await expect.poll(async()=>((await(await request.get(endpoint)).json()).draft?.text)).toBe(original);
  const phone=await mobile.newPage();await phone.goto(link);
  await expect(phone.getByRole('heading',{name:'Check your review'})).toBeVisible();
  await expect(phone.getByLabel('Your review',{exact:true})).toHaveValue(original);
  await phone.getByLabel('Your review',{exact:true}).fill(updated);
  await expect.poll(async()=>((await(await request.get(endpoint)).json()).draft?.text)).toBe(updated);
  await page.getByLabel('Your review',{exact:true}).fill(localEdit);
  await expect(page.getByRole('button',{name:'Use draft from other device'})).toBeVisible();
  await page.getByRole('button',{name:'Use draft from other device'}).click();
  await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(updated);
  phone.once('dialog',d=>d.accept());await phone.getByRole('button',{name:'Clear my draft'}).click();
  await expect.poll(async()=>((await(await request.get(endpoint)).json()).draft?.text)).toBe('');
  await page.reload();await expect(page.getByRole('button',{name:'Type my review'})).toBeEnabled();
  expect((await request.get(endpoint+'?preview=1')).status()).toBe(404);
 }finally{await mobile.close();await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});
