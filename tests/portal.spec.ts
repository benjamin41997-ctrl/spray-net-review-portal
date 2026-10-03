import {test,expect,type APIRequestContext} from './test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {login,browserAdmin,site,apiBase,origin,fixture,make,patch,startDraft,approveReview,returnToCheck} from './helpers';
let admin:APIRequestContext;let token:string;let codes:string[];let sample:any;
test.beforeAll(async()=>{({admin,token}=await login());await admin.post('/api/admin/batch',{data:{count:100}});const d=await(await admin.get('/api/admin/dashboard')).json();codes=d.qrs.filter((q:any)=>!q.assigned_at).map((q:any)=>q.token);sample=await(await admin.post('/api/admin/seed',{data:{}})).json();});
test.afterAll(async()=>{await admin.dispose();});

test('static page lives beneath its GitHub repository path and has no server routes',async({page,request})=>{
 await page.goto(site+'?admin=1');await expect(page.getByRole('heading',{name:'Prepare their project card.'})).toBeVisible();
 await page.getByRole('button',{name:'Enter local admin preview'}).click();await expect(page.getByRole('heading',{name:'Ready for their review.'})).toBeVisible();
 expect((await request.get(apiBase+'/api/admin/dashboard')).status()).toBe(403);
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));expect(resources.some(x=>x.endsWith('/spray-net-review-portal/branding/logo.png'))).toBeTruthy();
 expect(resources.filter(x=>x.startsWith(origin)&&x.includes('/api/'))).toEqual([]);
 expect((await request.get(site+'?code='+codes[0])).status()).toBe(200); // GitHub serves the same static HTML for every token.
});

test('forged identity, wrong tokens, and foreign origins cannot edit or assign',async({request})=>{
 for(const p of ['admin/dashboard','admin/jobs/sample-kitchen','admin/photos/sample-before'])expect((await request.get(apiBase+'/api/'+p)).status()).toBe(403);
 expect((await request.get(apiBase+'/api/admin/dashboard',{headers:{'oai-authenticated-user-email':'ben.hessler@spray-net.com','oai-authenticated-user-id':'local_seedy',Authorization:'Bearer fake'}})).status()).toBe(403);
 expect((await request.post(apiBase+'/api/admin/batch',{data:{count:100},headers:{Origin:origin}})).status()).toBe(403);
 expect((await admin.post('/api/admin/batch',{data:{count:100},headers:{Origin:'https://evil.example'}})).status()).toBe(403);
 expect((await request.fetch(apiBase+'/api/admin/dashboard',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization'}})).headers()['access-control-allow-origin']).toBe(origin);
 const denied=await request.fetch(apiBase+'/api/admin/dashboard',{method:'OPTIONS',headers:{Origin:'https://evil.example'}});expect(denied.status()).toBe(403);expect(denied.headers()['access-control-allow-origin']).toBeUndefined();
});

test('query-token sticker resolves to the original job; assignment is permanent and atomic',async({page,request})=>{
 const a=await make(admin),b=await make(admin),code=codes.shift()!;
 await page.goto(site+'?code='+code);await expect(page.getByRole('heading',{name:'This page isn’t ready yet.'})).toBeVisible();
 const assigned=await Promise.all([admin.post('/api/admin/assign',{data:{token:code,job_id:a.id}}),admin.post('/api/admin/assign',{data:{token:code,job_id:b.id}})]);expect(assigned.map(r=>r.status()).sort()).toEqual([200,409]);
 const d=await(await admin.get('/api/admin/dashboard')).json();const id=d.qrs.find((q:any)=>q.token===code).job_id;let j=await(await admin.get('/api/admin/jobs/'+id)).json();
 expect((await request.get(apiBase+'/api/customer/'+code)).status()).toBe(404);j=await(await patch(admin,j,'active')).json();
 await page.reload();await expect(page.getByRole('heading',{name:fixture.title})).toBeVisible();expect(page.url()).toBe(site+'?code='+code);
 const pub=await(await request.get(apiBase+'/api/customer/'+code)).json();expect(pub.internal_name).toBeUndefined();expect(pub.qrs).toBeUndefined();
 expect((await patch(admin,{...j,revision:1},'active')).status()).toBe(409);
 j=await(await patch(admin,{...j,title:'We loved working with you, Taylor!'},'active')).json();await page.reload();await expect(page.getByRole('heading',{name:'We loved working with you, Taylor!'})).toBeVisible();
 j=await(await patch(admin,j,'archived')).json();await page.reload();await expect(page.getByRole('heading',{name:'This page is no longer available.'})).toBeVisible();
 await admin.delete('/api/admin/jobs/'+id);expect((await admin.post('/api/admin/assign',{data:{token:code,job_id:id===a.id?b.id:a.id}})).status()).toBe(409);await admin.delete('/api/admin/jobs/'+(id===a.id?b.id:a.id));
});

test('scanning and creating retains the sticker; private preview never leaks data',async({page,request})=>{
 const code=codes.pop()!;await browserAdmin(page,token);await page.goto(site+'?code='+code);
 await expect(page.getByRole('dialog',{name:'Assign a preprinted sticker'})).toBeVisible();expect(page.url()).toContain('?admin=1&assign='+code);
 await page.getByRole('button',{name:'Create a new project first'}).click();await page.getByLabel('Internal customer / job name',{exact:true}).fill('Pages scanned QA');await page.getByRole('button',{name:'Create project',exact:true}).click();
 const d=await(await admin.get('/api/admin/dashboard')).json();const j=d.jobs.find((j:any)=>j.internal_name==='Pages scanned QA');expect(d.qrs.find((q:any)=>q.token===code).assigned_at).toBeNull();
 expect((await request.get(apiBase+'/api/admin/jobs/'+j.id)).status()).toBe(403);
 await page.getByRole('button',{name:/Assign SN-.* to project/}).click();await expect(page.getByText('Sticker assigned permanently to this project.')).toBeVisible();
 const preview=page.waitForEvent('popup');await page.getByRole('link',{name:'Preview project layout'}).click();const popup=await preview;await expect(popup.getByRole('heading',{name:'We loved working with you!'})).toBeVisible();await expect(popup.getByText('Administrator preview · activity is not counted.')).toBeVisible();await popup.close();
 expect((await(await admin.get('/api/admin/jobs/'+j.id)).json()).qrs[0].token).toBe(code);await admin.delete('/api/admin/jobs/'+j.id);
});

test('photo downloads require the matching live token and are revoked on archive',async({request})=>{
 const j=await make(admin),code=codes.shift()!;await admin.post('/api/admin/assign',{data:{token:code,job_id:j.id}});
 const upload=await admin.post('/api/admin/photos',{multipart:{job_id:j.id,kind:'before',label:'Before cabinets',file:{name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=','base64')}}});expect(upload.ok()).toBeTruthy();let fresh=await upload.json();fresh=await(await patch(admin,fresh,'active')).json();const id=fresh.photos[0].id;
 const download=await request.get(apiBase+`/api/customer/${code}/photo/${id}?download=1`,{headers:{Origin:origin}});expect(download.headers()['content-disposition']).toContain('attachment');expect(download.headers()['access-control-allow-origin']).toBe(origin);
 expect((await request.get(apiBase+`/api/customer/${sample.qrs[0].token}/photo/${id}`)).status()).toBe(404);await patch(admin,fresh,'archived');expect((await request.get(apiBase+`/api/customer/${code}/photo/${id}`)).status()).toBe(404);await admin.delete('/api/admin/jobs/'+j.id);
});

test('malformed links, batches and files are rejected',async()=>{
 expect((await admin.post('/api/admin/jobs',{data:{...fixture,links:{google:'https://google.com.evil.example'}}})).status()).toBe(400);expect((await admin.post('/api/admin/batch',{data:{count:101}})).status()).toBe(400);
 expect((await admin.post('/api/admin/photos',{multipart:{job_id:sample.id,kind:'after',label:'Fake JPEG',file:{name:'fake.jpg',mimeType:'image/jpeg',buffer:Buffer.from('<script>bad</script>')}}})).status()).toBe(400);
});

test('draft survives external app return and metrics never claim publication',async({page})=>{
 const j=await make(admin),code=codes.shift()!;await admin.post('/api/admin/assign',{data:{token:code,job_id:j.id}});await patch(admin,j,'active');
 await page.route('**/api/customer/'+code,async route=>{const response=await route.fetch();const data=await response.json();data.settings={transcription:false,cleanup:false};await route.fulfill({response,json:data});});
 await page.goto(site+'?code='+code);
 await startDraft(page);const review='Cabinets look good. The start was a day late.';await page.getByLabel('Your review',{exact:true}).fill(review);await approveReview(page);await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(review);await expect(page.getByRole('button',{name:'Paste my review to Google',exact:true})).toBeEnabled();
 expect(await page.locator('.destination a.button').first().textContent()).toContain('Angi');await expect(page.getByRole('link',{name:'Continue to Yelp'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Business information on Yelp'})).toBeVisible();
 await page.route('https://www.angi.com/write-review/test',r=>r.fulfill({body:'Mock external platform; no review is published.'}));const external=page.waitForEvent('popup');await page.getByRole('link',{name:'Continue to Angi'}).click();const other=await external;await other.close();await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(review);
 let d=await(await admin.get('/api/admin/dashboard')).json();let row=d.jobs.find((x:any)=>x.id===j.id);expect(row.visits).toBe(1);expect(row.clicks).toBe(1);expect(row.reported).toBe(0);
 await page.locator('.destination').first().getByText('Already submitted your review?',{exact:true}).click();await page.getByRole('checkbox',{name:'I submitted on Angi'}).check();await expect.poll(async()=>{const d=await(await admin.get('/api/admin/dashboard')).json();return d.jobs.find((x:any)=>x.id===j.id).reported;}).toBe(1);
 await returnToCheck(page);await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Speak instead',exact:true}).click();await page.getByRole('button',{name:'Start recording',exact:true}).click();await expect(page.getByText('Voice transcription isn’t connected yet. Use the microphone on your phone keyboard, or type below.',{exact:true})).toBeVisible();await expect(page.getByText('AI formatting isn’t connected yet.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await mkdir('.sites-runtime/qa',{recursive:true});await page.screenshot({path:`.sites-runtime/qa/pages-customer-${test.info().project.name}.png`,fullPage:true});await admin.delete('/api/admin/jobs/'+j.id);
});

test('admin uploads photos, activates, copies query link and downloads sticker PDF',async({page})=>{
 await browserAdmin(page,token);await page.goto(site+'?admin=1');await expect(page.getByRole('heading',{name:'Ready for their review.'})).toBeVisible();await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByLabel('Internal customer / job name',{exact:true}).fill('Pages mobile QA');await page.getByLabel('Customer first name / display name',{exact:true}).pressSequentially('Morgan Lee');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.getByLabel('Google',{exact:true}).fill('https://g.page/r/test/review');await page.locator('input[type=file]').setInputFiles('public/sample/after.webp');await expect(page.getByText('Photo uploaded.',{exact:true})).toBeVisible();await expect(page.locator('.photo-editor img')).toBeVisible();
 await page.getByRole('button',{name:'Activate page',exact:true}).click();await expect(page.getByText('Customer page activated.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Assign unused sticker'}).click();await page.getByRole('combobox',{name:'Sticker to assign'}).click();await page.getByRole('option').first().click();await page.getByRole('button',{name:/Assign SN-.* to project/}).click();await expect(page.getByRole('link',{name:'Preview customer page'})).toHaveAttribute('href',/\/spray-net-review-portal\/\?code=[\w-]{32}&preview=1/);
 expect(await page.locator('.wrap-link').textContent()).toMatch(/\/spray-net-review-portal\/\?code=[\w-]{32}/);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`.sites-runtime/qa/pages-admin-${test.info().project.name}.png`,fullPage:true});
 const preview=page.waitForEvent('popup');await page.getByRole('link',{name:'Preview project layout'}).click();const other=await preview;await expect(other.getByRole('heading',{name:'We loved working with you, Morgan Lee!',exact:true})).toBeVisible();await expect(other.getByText('Pages mobile QA',{exact:true})).toHaveCount(0);await startDraft(other);await other.getByLabel('Your review',{exact:true}).fill('Preview only.');await approveReview(other);await expect(other.locator('.photo-card img').first()).toBeVisible();await other.close();
 await page.getByRole('button',{name:'All projects'}).click();await page.getByRole('tab',{name:'QR stickers'}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:/Download test sticker PDF/}).click();await(await download).saveAs(`.sites-runtime/qa/pages-stickers-${test.info().project.name}.pdf`);
 const d=await(await admin.get('/api/admin/dashboard')).json();const j=d.jobs.find((x:any)=>x.internal_name==='Pages mobile QA');await admin.delete('/api/admin/jobs/'+j.id);
});
