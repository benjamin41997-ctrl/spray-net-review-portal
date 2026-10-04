import {test,expect,type APIRequestContext,type Download} from './test';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {login,site,fixture,patch,startDraft,approveReview} from './helpers';
import {googleReviewURL} from '../lib/business';
import {skipPhotoLabel} from '../src/PhotoHandoff';
let admin:APIRequestContext;let job:any;let code:string;
test.beforeAll(async()=>{({admin}=await login());});
test.afterAll(async()=>{await admin.dispose();});
test.beforeEach(async({page})=>{
 // Ordinary download tests cover browsers without a desktop save picker.
 // Explicit picker tests install their own deterministic native-dialog stub.
 await page.addInitScript(()=>Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true}));
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
 await expect(page.getByRole('button',{name:'Save and share all photos',exact:true})).toBeEnabled();
 expect(await page.locator('.photo-choices button').allTextContents()).toEqual(['Save and share all photos','Select photos to include and save',skipPhotoLabel]);
 await expect(page.getByRole('checkbox',{name:/^Select /})).toHaveCount(0);expect(downloads).toHaveLength(0);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/photo-choices-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Save and share all photos',exact:true}).click();await expect.poll(()=>downloads.length).toBe(3);
 expect(downloads.map(d=>d.suggestedFilename()).sort()).toEqual(['Spray-Net-after-02.jpg','Spray-Net-before-01.jpg','Spray-Net-detail-03.jpg']);
 for(const d of downloads){const metadata=await sharp((await d.path())!).metadata();expect(metadata.format).toBe('jpeg');expect([metadata.width,metadata.height]).toEqual([400,300]);}
 await expect(page.getByRole('status')).toContainText('downloads requested');await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Next',exact:true})).toHaveCount(0);await expect(page.getByText('Attach the 3 transformation photos you already downloaded.',{exact:true})).toBeVisible();
});

test('selection downloads only chosen photos and selections survive Google and a return to Photos',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}}}));await page.route(googleReviewURL,r=>r.fulfill({body:'Mock Google. No feedback or photos are submitted.'}));
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);await page.getByRole('button',{name:'Select photos to include and save',exact:true}).click();
 await page.getByRole('checkbox',{name:'Select Optional detail'}).uncheck();await page.getByRole('checkbox',{name:'Select Before cabinets'}).uncheck();
 await page.getByRole('button',{name:'Download selected photos (1)',exact:true}).click();await expect.poll(()=>downloads.length).toBe(1);expect(downloads[0].suggestedFilename()).toBe('Spray-Net-after-02.jpg');
 await expect(page.getByText('Attach the 1 transformation photo you already downloaded.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();await expect(page).toHaveURL(googleReviewURL);await page.goBack();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save photos again',exact:true}).click();await expect(page.getByRole('heading',{name:'Add your project photos',exact:true})).toBeVisible();await page.getByRole('button',{name:'Select photos to include and save',exact:true}).click();await expect(page.getByRole('checkbox',{name:/^Select /})).toHaveCount(3);
 await expect(page.getByRole('checkbox',{name:'Select Before cabinets'})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Finished cabinets'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Select Optional detail'})).not.toBeChecked();
});

test('saving all photos again requests a fresh set after Back and Save photos again',async({page})=>{
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);
 const save=page.getByRole('button',{name:'Save and share all photos',exact:true});
 await save.click();await expect.poll(()=>downloads.length).toBe(3);
 await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();await expect(save).toBeEnabled();
 await save.click();await expect.poll(()=>downloads.length).toBe(6);
 await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save photos again',exact:true}).click();await expect(save).toBeEnabled();
 await save.click();await expect.poll(()=>downloads.length).toBe(9);
 expect(downloads.map(d=>d.suggestedFilename())).toEqual(Array(3).fill(['Spray-Net-before-01.jpg','Spray-Net-after-02.jpg','Spray-Net-detail-03.jpg']).flat());
});

test.describe('downloads rejected by the browser',()=>{
 test.use({acceptDownloads:false});
 test('a rejected batch does not suppress a new request after returning to Photos',async({page})=>{
  await page.addInitScript(()=>{
   (window as any).requestedDownloads=[];const click=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(this.download)(window as any).requestedDownloads.push({name:this.download,url:this.href});click.call(this);};
  });
  const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);
  const save=page.getByRole('button',{name:'Save and share all photos',exact:true});
  await save.click();expect(await page.evaluate(()=>(window as any).requestedDownloads.length)).toBe(3);await expect.poll(()=>downloads.length).toBeGreaterThan(0);
  for(const d of downloads)expect(await d.failure()).toBeTruthy();
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(save).toBeEnabled();
  await save.click();const requests=await page.evaluate(()=>(window as any).requestedDownloads);expect(requests).toHaveLength(6);expect(new Set(requests.map((r:any)=>r.url)).size).toBe(6);
  await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 });
});

async function desktopPicker(page:any){
 await page.addInitScript(()=>{
  const media=window.matchMedia.bind(window);window.matchMedia=query=>query==='(pointer: fine)'?{...media(query),matches:true} as MediaQueryList:media(query);
  const state={cancel:true,failWrite:false,picks:[] as string[],writes:[] as {name:string,size:number,type:string}[],closed:[] as string[],aborted:[] as string[]};(window as any).saveQA=state;
  Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async({suggestedName:name}:{suggestedName:string})=>{
   state.picks.push(name);if(state.cancel)throw new DOMException('Canceled','AbortError');
   return {createWritable:async()=>({write:async(file:File)=>{if(state.failWrite)throw Error('Disk write failed');state.writes.push({name,size:file.size,type:file.type});},close:async()=>{state.closed.push(name);},abort:async()=>{state.aborted.push(name);}})};
  }});
 });
}

test('desktop cancel on a retry stops the batch and the next tap opens a fresh save picker',async({page})=>{
 await desktopPicker(page);const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);
 const save=page.getByRole('button',{name:'Save and share all photos',exact:true});await save.click();await expect.poll(()=>downloads.length).toBe(3);
 await page.getByRole('button',{name:'Back',exact:true}).click();await save.click();
 await expect(page.getByRole('status')).toContainText('Saving canceled. You can try again.');await expect(save).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).saveQA)).toMatchObject({picks:['Spray-Net-before-01.jpg'],writes:[],closed:[]});
 await page.evaluate(()=>{(window as any).saveQA.cancel=false;});await save.click();
 await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>(window as any).saveQA);expect(state.picks).toEqual(['Spray-Net-before-01.jpg','Spray-Net-before-01.jpg','Spray-Net-after-02.jpg','Spray-Net-detail-03.jpg']);
 expect(state.closed).toEqual(['Spray-Net-before-01.jpg','Spray-Net-after-02.jpg','Spray-Net-detail-03.jpg']);expect(state.writes).toHaveLength(3);expect(state.writes.every((file:any)=>file.size>0&&file.type==='image/jpeg')).toBe(true);expect(downloads).toHaveLength(3);
});

test('a desktop write failure keeps the retry available and never advances as saved',async({page})=>{
 await desktopPicker(page);await photos(page);const save=page.getByRole('button',{name:'Save and share all photos',exact:true});await save.click();await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.evaluate(()=>{(window as any).saveQA.cancel=false;(window as any).saveQA.failWrite=true;});await save.click();
 await expect(page.getByRole('status')).toContainText('The photos could not be saved.');await expect(save).toBeEnabled();await expect(page.getByRole('heading',{name:'Add your project photos',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).saveQA)).toMatchObject({closed:[],aborted:['Spray-Net-before-01.jpg']});
});

test('opt-out still offers downloads for personal use and keeps photo inclusion off after reload',async({page})=>{
 const downloads:Download[]=[];page.on('download',d=>downloads.push(d));await photos(page);await page.getByRole('button',{name:skipPhotoLabel,exact:true}).click();
 expect(downloads).toHaveLength(0);await expect(page.getByRole('button',{name:'Download photos for myself',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Download photos for myself',exact:true}).click();await expect.poll(()=>downloads.length).toBe(3);
 const draft=await page.evaluate(code=>JSON.parse(localStorage.getItem('spraynet-review:v1:'+code)!),code);expect(draft.selected).toEqual([]);
 await page.reload();await expect(page.getByRole('button',{name:'Download photos for myself',exact:true})).toBeEnabled();expect(downloads).toHaveLength(3);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save photos again',exact:true})).toHaveCount(0);await expect(page.getByText('You can post without photos.',{exact:true})).toBeVisible();
});

test('individual download fallback is available when a browser blocks batch downloads',async({page})=>{
 await photos(page);await page.getByRole('button',{name:skipPhotoLabel,exact:true}).click();await page.getByRole('button',{name:'Download photos for myself',exact:true}).click();await page.getByText('Download didn’t start?',{exact:true}).click();
 await expect(page.getByText('Your browser may block several downloads at once.',{exact:false})).toBeVisible();
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Download Before cabinets',exact:true}).click();expect((await d).suggestedFilename()).toBe('Spray-Net-before-01.jpg');
 await expect(page.getByRole('status')).toContainText('downloads requested');
});

test('unavailable photos can be retried or excluded and do not prevent opting out',async({page})=>{
 const before=job.photos.find((p:any)=>p.kind==='before').id;await page.route('**/api/customer/*/photo/'+before+'?download=1',r=>r.fulfill({status:404,json:{error:'Unavailable'}}));
 await photos(page);await expect(page.getByRole('alert')).toContainText('Some photos could not be prepared');await expect(page.getByRole('button',{name:'Save and share all photos',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Select photos to include and save',exact:true}).click();await page.getByRole('checkbox',{name:'Select Before cabinets'}).uncheck();await expect(page.getByRole('button',{name:'Download selected photos (2)',exact:true})).toBeEnabled();
 await page.unroute('**/api/customer/*/photo/'+before+'?download=1');await page.getByRole('button',{name:'Retry photo preparation',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'Back to photo options',exact:true}).click();await expect(page.getByRole('button',{name:'Save and share all photos',exact:true})).toBeEnabled();await page.getByRole('button',{name:skipPhotoLabel,exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
});
