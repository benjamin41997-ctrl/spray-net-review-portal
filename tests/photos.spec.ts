import {test,expect,type APIRequestContext} from '@playwright/test';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {login,site,fixture,patch,startDraft,approveReview} from './helpers';
import {googleReviewURL} from '../lib/business';
let admin:APIRequestContext;let job:any;let code:string;
test.beforeAll(async()=>{({admin}=await login());});
test.afterAll(async()=>{await admin.dispose();});
test.beforeEach(async()=>{
 job=await(await admin.post('/api/admin/jobs',{data:{...fixture,source:'training',links:{}}})).json();
 for(const [kind,label,background] of [['before','Before cabinets','#ed2222'],['after','Finished cabinets','#2222ed'],['detail','Optional detail','#22ed22']]){
  const buffer=await sharp({create:{width:400,height:300,channels:3,background}}).png().toBuffer();
  const upload=await admin.post('/api/admin/photos',{multipart:{job_id:job.id,kind,label,file:{name:kind+'.png',mimeType:'image/png',buffer}}});expect(upload.ok()).toBeTruthy();job=await upload.json();
 }
 await admin.post('/api/admin/batch',{data:{count:1}});const d=await(await admin.get('/api/admin/dashboard')).json();code=d.qrs.find((q:any)=>!q.assigned_at).token;
 await admin.post('/api/admin/assign',{data:{job_id:job.id,token:code}});job=await(await patch(admin,job,'active')).json();
});
test.afterEach(async()=>{if(job?.id)await admin.delete('/api/admin/jobs/'+job.id);});

test('customer chooses the pair and both JPEG files reach the native menu during the save tap',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:({files}:ShareData)=>!!files?.length&&files.every(f=>f.type==='image/jpeg')});
  Object.defineProperty(navigator,'share',{value:(data:ShareData)=>{
   const gesture=navigator.userActivation?.isActive??null;
   sessionStorage.setItem('qa-photo-share',JSON.stringify({gesture,keys:Object.keys(data),files:data.files?.map(f=>({name:f.name,type:f.type,size:f.size}))}));return Promise.resolve();
  }});
 });
 await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My feedback stays mine.');await approveReview(page);await expect(page.getByRole('checkbox',{name:'Select Before cabinets'})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Finished cabinets'})).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Save selected photos (2)',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Select before & after',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Select Optional detail'})).not.toBeChecked();const save=page.getByRole('button',{name:'Save selected photos (2)',exact:true});await expect(save).toBeEnabled();
 await save.click();const data=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-photo-share')!));
 expect(data.files.map((f:any)=>f.name)).toEqual(['Spray-Net-before-01.jpg','Spray-Net-after-02.jpg']);expect(data.files.every((f:any)=>f.type==='image/jpeg'&&f.size>0)).toBeTruthy();expect(data.keys.sort()).toEqual(['files','title']);if(data.gesture!==null)expect(data.gesture).toBe(true);
 await expect(page.getByRole('status')).toContainText('You still choose which photos to attach');expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/photo-save-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('checkbox',{name:'Select Before cabinets'}).uncheck();await expect(page.getByRole('button',{name:'Save selected photos (1)',exact:true})).toBeEnabled();await expect(page.getByRole('heading',{name:'One photo, both views'})).toHaveCount(0);
});

test('single before-and-after download contains both labeled views and selections survive the Google trip',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>false});
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}});
 });
 await page.route(googleReviewURL,r=>r.fulfill({body:'Mock Google review form. No photos or feedback are submitted.'}));
 await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My feedback stays mine.');await approveReview(page);await page.getByRole('button',{name:'Select before & after',exact:true}).click();
 await page.getByText('Save as one before-and-after photo',{exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download before-and-after photo',exact:true}).click();const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('Spray-Net-before-and-after.jpg');const path=await download.path();expect(path).toBeTruthy();const metadata=await sharp(path!).metadata();expect(metadata.format).toBe('jpeg');expect([metadata.width,metadata.height]).toEqual([1600,760]);
 const {data,info}=await sharp(path!).removeAlpha().raw().toBuffer({resolveWithObject:true});const pixel=(x:number,y:number)=>Array.from(data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
 const before=pixel(400,380),after=pixel(1200,380);expect(before[0]).toBeGreaterThan(210);expect(before[2]).toBeLessThan(60);expect(after[2]).toBeGreaterThan(210);expect(after[0]).toBeLessThan(60);
 await expect(page.getByRole('status')).toContainText('Download requested.');await page.getByRole('button',{name:'Continue to sharing',exact:true}).click();await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();await page.getByRole('button',{name:'Save photos again',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Select Before cabinets'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Finished cabinets'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Optional detail'})).not.toBeChecked();
 if(await page.locator('details.photo-bundle').getAttribute('open')===null)await page.getByText('Save as one before-and-after photo',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Download before-and-after photo',exact:true})).toBeEnabled();
 const single=page.waitForEvent('download');await page.getByRole('button',{name:'Download Before cabinets',exact:true}).click();expect((await single).suggestedFilename()).toBe('Spray-Net-before-01.jpg');
});

test('canceled or denied photo menu keeps originals available and does not silently download',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'canShare',{value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('Canceled','AbortError'))});
 });
 let downloads=0;page.on('download',()=>downloads++);await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My feedback stays mine.');await approveReview(page);await page.getByRole('button',{name:'Select before & after',exact:true}).click();
 await page.getByText('Save as one before-and-after photo',{exact:true}).click();
 await page.getByRole('button',{name:'Save before-and-after photo',exact:true}).click();await expect(page.getByRole('status')).toContainText('Photo menu canceled.');expect(downloads).toBe(0);
 await page.getByRole('checkbox',{name:'Select Finished cabinets'}).uncheck();await expect(page.getByRole('button',{name:'Save selected photos (1)',exact:true})).toBeEnabled();
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}));
 await page.getByRole('button',{name:'Save selected photos (1)',exact:true}).click();await expect(page.getByRole('status')).toContainText('could not open');expect(downloads).toBe(0);await page.getByText('Download photos instead',{exact:true}).click();await expect(page.getByRole('button',{name:'Download Before cabinets',exact:true})).toBeEnabled();
});

test('unavailable photos show a retry; no fake saved or uploaded status',async({page})=>{
 await page.route('**/api/customer/*/photo/*?download=1',route=>route.fulfill({status:404,json:{error:'Unavailable'}}));
 await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My feedback stays mine.');await approveReview(page);await page.getByRole('button',{name:'Select before & after',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('selected photo is unavailable');await expect(page.getByRole('button',{name:'Retry photo preparation'})).toBeEnabled();await expect(page.getByRole('button',{name:/^(Save|Download) before-and-after photo$/})).toHaveCount(0);
 await page.unroute('**/api/customer/*/photo/*?download=1');await page.getByRole('button',{name:'Retry photo preparation'}).click();await expect(page.getByText('Save as one before-and-after photo',{exact:true})).toBeVisible();
});
