import {test,expect,type APIRequestContext,type Download} from '@playwright/test';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {login,site,fixture,patch,startDraft,approveReview} from './helpers';
import {googleReviewURL} from '../lib/business';
import {skipPhotoLabel} from '../src/PhotoHandoff';
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
async function photos(page:any){await page.goto(site+'?code='+code);await startDraft(page);await page.getByLabel('Your review',{exact:true}).fill('My own feedback.');await approveReview(page);}

test('exactly three photo choices; Share all initiates all JPEG downloads without a share sheet',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'share',{value:()=>{throw Error('The share menu must not be used.');}}));
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);
 await expect(page.getByRole('button',{name:'Share all photos',exact:true})).toBeEnabled();
 expect(await page.locator('.photo-choices button').allTextContents()).toEqual(['Share all photos','Select which photos to include',skipPhotoLabel]);
 await expect(page.getByRole('checkbox',{name:/^Select /})).toHaveCount(0);expect(downloads).toHaveLength(0);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/photo-choices-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Share all photos',exact:true}).click();await expect.poll(()=>downloads.length).toBe(3);
 expect(downloads.map(d=>d.suggestedFilename()).sort()).toEqual(['Spray-Net-after-02.jpg','Spray-Net-before-01.jpg','Spray-Net-detail-03.jpg']);
 for(const d of downloads){const metadata=await sharp((await d.path())!).metadata();expect(metadata.format).toBe('jpeg');expect([metadata.width,metadata.height]).toEqual([400,300]);}
 await expect(page.getByRole('status')).toContainText('downloads requested');await expect(page.getByRole('heading',{name:'Add your project photos',exact:true})).toBeVisible();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
});

test('selection downloads only chosen photos and selections survive Google and a return to Photos',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}}));await page.route(googleReviewURL,r=>r.fulfill({body:'Mock Google. No feedback or photos are submitted.'}));
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);await page.getByRole('button',{name:'Select which photos to include',exact:true}).click();
 await page.getByRole('checkbox',{name:'Select Optional detail'}).uncheck();await page.getByRole('checkbox',{name:'Select Before cabinets'}).uncheck();
 await page.getByRole('button',{name:'Download selected photos (1)',exact:true}).click();await expect.poll(()=>downloads.length).toBe(1);expect(downloads[0].suggestedFilename()).toBe('Spray-Net-after-02.jpg');
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();await page.getByRole('button',{name:'Save photos again',exact:true}).click();await page.getByRole('button',{name:'Select which photos to include',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Select Before cabinets'})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Finished cabinets'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Optional detail'})).not.toBeChecked();
});

test('opt-out still offers downloads for personal use and keeps photo inclusion off after reload',async({page})=>{
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);await page.getByRole('button',{name:skipPhotoLabel,exact:true}).click();
 expect(downloads).toHaveLength(0);await expect(page.getByRole('button',{name:'Download photos for myself',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Download photos for myself',exact:true}).click();await expect.poll(()=>downloads.length).toBe(3);
 const draft=await page.evaluate(code=>JSON.parse(localStorage.getItem('spraynet-review:v1:'+code)!),code);expect(draft.selected).toEqual([]);
 await page.reload();await expect(page.getByRole('button',{name:'Download photos for myself',exact:true})).toBeEnabled();expect(downloads).toHaveLength(3);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save photos again',exact:true})).toHaveCount(0);
});

test('individual download fallback is available when a browser blocks batch downloads',async({page})=>{
 await photos(page);await page.getByRole('button',{name:'Share all photos',exact:true}).click();await page.getByText('Download didn’t start?',{exact:true}).click();
 await expect(page.getByText('Your browser may block several downloads at once.',{exact:false})).toBeVisible();
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Download Before cabinets',exact:true}).click();expect((await d).suggestedFilename()).toBe('Spray-Net-before-01.jpg');
 await expect(page.getByRole('status')).toContainText('downloads requested');
});

test('unavailable photos can be retried or excluded and do not prevent opting out',async({page})=>{
 const before=job.photos.find((p:any)=>p.kind==='before').id;await page.route('**/api/customer/*/photo/'+before+'?download=1',r=>r.fulfill({status:404,json:{error:'Unavailable'}}));
 await photos(page);await expect(page.getByRole('alert')).toContainText('Some photos could not be prepared');await expect(page.getByRole('button',{name:'Share all photos',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Select which photos to include',exact:true}).click();await page.getByRole('checkbox',{name:'Select Before cabinets'}).uncheck();await expect(page.getByRole('button',{name:'Download selected photos (2)',exact:true})).toBeEnabled();
 await page.unroute('**/api/customer/*/photo/'+before+'?download=1');await page.getByRole('button',{name:'Retry photo preparation',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'Back to photo options',exact:true}).click();await expect(page.getByRole('button',{name:'Share all photos',exact:true})).toBeEnabled();await page.getByRole('button',{name:skipPhotoLabel,exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
});
