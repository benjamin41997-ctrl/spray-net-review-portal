import {test,expect} from './test';
import {login,browserAdmin,site,apiBase,fixture,patch,startDraft} from './helpers';
import AxeBuilder from '@axe-core/playwright';
import {readFile,mkdir} from 'node:fs/promises';

test('project has a stable copyable email link without a QR sticker, with draft/archive/deletion access controls',async({page,browser,request})=>{
 const {admin,token}=await login();let job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Email link QA'}})).json();
 const customerContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
  expect(job.customer_token).toMatch(/^[A-Za-z0-9_-]{32}$/);expect(job.qrs).toHaveLength(0);const customerToken=job.customer_token;
  const upload=await admin.post('/api/admin/photos',{multipart:{job_id:job.id,kind:'before',label:'Sample cabinets',file:{name:'before.webp',mimeType:'image/webp',buffer:await readFile('public/sample/before.webp')}}});expect(upload.ok()).toBeTruthy();job=await upload.json();
  const photoPath=apiBase+'/api/customer/'+customerToken+'/photo/'+job.photos[0].id;
  const before=(await(await admin.get('/api/admin/dashboard')).json()).qrs.length;
  expect((await request.get(apiBase+'/api/customer/'+customerToken)).status()).toBe(404);
  await browserAdmin(page,token);await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>sessionStorage.setItem('qa-customer-link',text)}}));
  await page.goto(site+'?admin=1');await page.getByLabel('Find a project').fill('Email link QA');await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();
  const field=page.getByLabel('Customer review link',{exact:true});await expect(field).toHaveValue(site+'?code='+customerToken);
  const preview=page.getByRole('link',{name:'Preview project layout',exact:true});
  expect(await preview.evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.customer-link')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByText('Activate this page before sending the link. No QR sticker is needed.',{exact:true})).toBeVisible();
  await mkdir('.sites-runtime/qa',{recursive:true});await page.locator('section').filter({has:page.getByRole('heading',{name:'Project card',exact:true})}).screenshot({path:`.sites-runtime/qa/customer-link-${test.info().project.name}.png`});
  await page.getByRole('button',{name:'Copy customer link',exact:true}).click();expect(await page.evaluate(()=>sessionStorage.getItem('qa-customer-link'))).toBe(site+'?code='+customerToken);
  await page.getByRole('button',{name:'Activate page',exact:true}).click();await expect(page.getByText('Send this link by email or text. No QR sticker is needed.',{exact:true})).toBeVisible();
  const customer=await customerContext.newPage();await customer.goto(site+'?code='+customerToken);await expect(customer.getByRole('heading',{name:fixture.title,exact:true})).toBeVisible();
  const response=await request.get(apiBase+'/api/customer/'+customerToken);const publicJob=await response.json();expect(response.status()).toBe(200);expect(publicJob.hasSticker).toBe(false);expect(publicJob.internal_name).toBeUndefined();expect(publicJob.customer_token).toBeUndefined();expect(publicJob.qrs).toBeUndefined();
  const download=await request.get(photoPath+'?download=1');expect(download.status()).toBe(200);expect(download.headers()['content-disposition']).toContain('attachment');expect((await download.body()).length).toBeGreaterThan(0);
  const current=await(await admin.get('/api/admin/jobs/'+job.id)).json();job=await(await patch(admin,{...current,title:'Your new greeting'},'active')).json();expect(job.customer_token).toBe(customerToken);
  await customer.reload();await expect(customer.getByRole('heading',{name:'Your new greeting',exact:true})).toBeVisible();expect((await(await admin.get('/api/admin/dashboard')).json()).qrs.length).toBe(before);
  job=await(await patch(admin,job,'archived')).json();await customer.reload();await expect(customer.getByRole('heading',{name:'This page is no longer available.',exact:true})).toBeVisible();
  expect((await request.get(photoPath)).status()).toBe(404);
  job=await(await patch(admin,job,'active')).json();expect(job.customer_token).toBe(customerToken);await admin.delete('/api/admin/jobs/'+job.id);expect((await request.get(apiBase+'/api/customer/'+customerToken)).status()).toBe(404);
 }finally{await customerContext.close();await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});

test('draft layout preview uses live capabilities and an authenticated editor without needing a sticker or activation',async({page,context,request})=>{
 const {admin,token}=await login();const job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Preview editor QA'}})).json();
 try{
  await browserAdmin(page,token);
  await context.route('**/api/admin/dashboard',async route=>{const response=await route.fetch();const data=await response.json();data.settings.cleanup=true;data.settings.transcription=true;await route.fulfill({response,json:data});});
  let calls=0;await context.route('**/api/admin/jobs/'+job.id+'/cleanup',async route=>{calls++;expect(route.request().headers().authorization).toBe('Bearer '+token);expect(route.request().postDataJSON().text).toBe('crew was friendly cabinets look good');await route.fulfill({headers:{'Access-Control-Allow-Origin':route.request().headers().origin||'*'},json:{status:'ready',text:'The crew was friendly, and the cabinets look good.'}});});
  await page.goto(site+'?admin=1&previewJob='+job.id);await expect(page.getByText('We’ll help tidy your wording. You approve every word.',{exact:true})).toBeVisible();await expect(page.getByText('AI formatting isn’t connected yet.',{exact:false})).toHaveCount(0);
  await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('crew was friendly cabinets look good');await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue('The crew was friendly, and the cabinets look good.');expect(calls).toBe(1);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  const unauthorized=await request.post(apiBase+'/api/admin/jobs/'+job.id+'/cleanup',{headers:{Origin:'http://127.0.0.1:5173'},data:{text:'A review'}});expect(unauthorized.status()).toBe(403);
  const dashboard=await(await admin.get('/api/admin/dashboard')).json();const entry=dashboard.jobs.find((j:any)=>j.id===job.id);expect(entry.visits).toBe(0);expect(entry.clicks).toBe(0);expect(entry.reported).toBe(0);
 }finally{await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});
