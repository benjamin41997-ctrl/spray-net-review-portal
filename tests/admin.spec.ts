import {test,expect,type APIRequestContext} from './test';
import {mkdir} from 'node:fs/promises';
import {login,browserAdmin,site,apiBase,fixture,patch} from './helpers';
let admin:APIRequestContext;let token:string;
test.beforeAll(async()=>{({admin,token}=await login());});
test.afterAll(async()=>{await admin.dispose();});

test('custom customer greeting survives editing and archiving and appears on the same printed link',async({page,browser})=>{
 let job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Custom greeting QA'}})).json();
 const greeting='Sam, the cabinets finally match your excellent taste! <High five>';
 const customerContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
  await admin.post('/api/admin/batch',{data:{count:1}});const dashboard=await(await admin.get('/api/admin/dashboard')).json();const code=dashboard.qrs.find((q:any)=>!q.assigned_at).token;
  await admin.post('/api/admin/assign',{data:{token:code,job_id:job.id}});job=await(await patch(admin,job,'active')).json();
  await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.getByLabel('Find a project').fill('Custom greeting QA');
  await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();
  const field=page.getByLabel('Customer greeting',{exact:true});await expect(field).toHaveValue(fixture.title);await expect(field).toHaveAttribute('maxlength','160');
  await field.fill(greeting);await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
  const customer=await customerContext.newPage();await customer.goto(site+'?code='+code);await expect(customer.getByRole('heading',{name:greeting,exact:true})).toBeVisible();await expect(customer.locator('high')).toHaveCount(0);
  await page.reload();await page.getByLabel('Find a project').fill('Custom greeting QA');await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();await expect(field).toHaveValue(greeting);
  await page.getByLabel('Project label (private)',{exact:true}).fill('Custom greeting QA updated');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();await expect(field).toHaveValue(greeting);
  await page.getByRole('button',{name:'Archive page',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Archive page',exact:true}).click();await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(field).toHaveValue(greeting);
  expect((await(await admin.get('/api/admin/jobs/'+job.id)).json()).title).toBe(greeting);await customer.reload();await expect(customer.getByRole('heading',{name:'This page is no longer available.',exact:true})).toBeVisible();
  await field.fill('   ');await page.getByRole('button',{name:'Activate page',exact:true}).click();await expect(field).toHaveValue('We loved working with you!');await customer.reload();await expect(customer.getByRole('heading',{name:'We loved working with you!',exact:true})).toBeVisible();await customer.close();
 }finally{await customerContext.close();await admin.delete('/api/admin/jobs/'+job.id);}
});

test('new project has an opaque mobile dialog and only one required customer name',async({page})=>{
 await browserAdmin(page,token);await page.goto(site+'?admin=1');
 await page.getByRole('button',{name:'New project',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New customer project'});
 await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
 await expect(dialog.getByRole('textbox')).toHaveCount(2);
 await expect(dialog.getByLabel('Customer name',{exact:true})).toHaveAttribute('required','');
 await expect(dialog.getByLabel('Project label (optional)',{exact:true})).not.toHaveAttribute('required','');
 await dialog.getByLabel('Customer name',{exact:true}).fill('Sam QA');
 await expect(dialog.getByRole('switch',{name:'Google',exact:true})).toBeChecked();
 const track=await dialog.getByRole('switch',{name:'Google',exact:true}).boundingBox();const thumb=await dialog.getByRole('switch',{name:'Google',exact:true}).locator('[data-slot=switch-thumb]').boundingBox();expect(thumb!.x+thumb!.width).toBeLessThanOrEqual(track!.x+track!.width);
 for(const name of ['Angi','Thumbtack','Yelp'])await expect(dialog.getByRole('switch',{name,exact:true})).not.toBeChecked();
 await expect(dialog.getByRole('combobox')).toHaveCount(0);
 const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);
 await mkdir('.sites-runtime/qa',{recursive:true});await page.screenshot({path:`.sites-runtime/qa/admin-dialog-${test.info().project.name}.png`});
 await dialog.getByRole('button',{name:'Create project',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Prepare their project.'})).toBeVisible();
 const dashboard=await(await admin.get('/api/admin/dashboard')).json();const job=dashboard.jobs.find((j:any)=>j.internal_name==='Sam QA');
 expect(job.title).toBe('We loved working with you, Sam QA!');expect(job.source).toBe('direct');expect(Object.keys(job.links)).toEqual(['google']);
 await page.getByRole('button',{name:'Delete project',exact:true}).click();
 const confirmation=page.getByRole('alertdialog',{name:'Delete this project?'});await expect(confirmation).toContainText('Sam QA');
 await confirmation.getByRole('button',{name:'Delete project',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ready for their review.'})).toBeVisible();
 expect((await admin.get('/api/admin/jobs/'+job.id)).status()).toBe(404);
});

test('list deletion supports cancel and retry, removes photos and permanently retires its sticker',async({page,request})=>{
 const job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Delete retry QA'}})).json();
 const upload=await admin.post('/api/admin/photos',{multipart:{job_id:job.id,kind:'before',label:'Delete QA photo',file:{name:'before.webp',mimeType:'image/webp',buffer:await (await import('node:fs/promises')).readFile('public/sample/before.webp')}}});expect(upload.ok()).toBeTruthy();const populated=await upload.json();
 await admin.post('/api/admin/batch',{data:{count:1}});const dashboard=await(await admin.get('/api/admin/dashboard')).json();const code=dashboard.qrs.find((q:any)=>!q.assigned_at).token;
 await admin.post('/api/admin/assign',{data:{token:code,job_id:job.id}});await patch(admin,populated,'active');
 await browserAdmin(page,token);await page.goto(site+'?admin=1');const row=page.locator('.project-row').filter({has:page.getByRole('heading',{name:'Delete retry QA',exact:true})});
 await row.getByRole('button',{name:'Delete project',exact:true}).click();const dialog=page.getByRole('alertdialog',{name:'Delete this project?'});
 await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect((await admin.get('/api/admin/jobs/'+job.id)).status()).toBe(200);
 let attempts=0;await page.route('**/api/admin/jobs/'+job.id,async route=>{if(route.request().method()==='DELETE'&&++attempts===1){await route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':route.request().headers().origin||'*'},json:{error:'Test: could not delete. Please retry.'}});}else await route.continue();});
 await row.getByRole('button',{name:'Delete project',exact:true}).click();await dialog.getByRole('button',{name:'Delete project',exact:true}).click();
 await expect(page.getByText('Test: could not delete. Please retry.',{exact:true})).toBeVisible();await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Delete project',exact:true})).toBeEnabled();
 expect((await admin.get('/api/admin/jobs/'+job.id)).status()).toBe(200);
 await dialog.getByRole('button',{name:'Delete project',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(row).toHaveCount(0);
 expect((await admin.get('/api/admin/jobs/'+job.id)).status()).toBe(404);expect((await admin.get('/api/admin/photos/'+populated.photos[0].id)).status()).toBe(404);expect((await request.get(apiBase+'/api/customer/'+code)).status()).toBe(404);
 const updated=await(await admin.get('/api/admin/dashboard')).json();const retired=updated.qrs.find((q:any)=>q.token===code);expect(retired.job_id).toBeNull();expect(retired.assigned_at).toBeTruthy();
 const other=await(await admin.post('/api/admin/jobs',{data:fixture})).json();expect((await admin.post('/api/admin/assign',{data:{token:code,job_id:other.id}})).status()).toBe(409);await admin.delete('/api/admin/jobs/'+other.id);
});
