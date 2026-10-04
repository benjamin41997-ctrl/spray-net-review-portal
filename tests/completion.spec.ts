import {test,expect} from './test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {login,site,fixture,patch,startDraft,approveReview,openReviewTab} from './helpers';
import {businessReviewLinks} from '../lib/business';

test('completion waits for every enabled site including Yelp, survives reload and adapts to changed destinations',async({page,context})=>{
 const {admin}=await login();
 const job=await(await admin.post('/api/admin/jobs',{data:{...fixture,source:'direct',links:businessReviewLinks}})).json();
 try{
  await admin.post('/api/admin/batch',{data:{count:1}});
  const dashboard=await(await admin.get('/api/admin/dashboard')).json();const code=dashboard.qrs.find((q:any)=>!q.assigned_at).token;
  await admin.post('/api/admin/assign',{data:{token:code,job_id:job.id}});await patch(admin,job,'active');
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>sessionStorage.setItem('qa-completion-copy',text)}}));
  await page.route('**/api/customer/'+code,async route=>{const response=await route.fetch();const data=await response.json();data.settings={transcription:false,cleanup:false};await route.fulfill({response,json:data});});
  await page.goto(site+'?code='+code);await startDraft(page);const text='The cabinets look great. The crew explained the work clearly.';
  await page.getByLabel('Your review',{exact:true}).fill(text);await approveReview(page);
  const thanks=page.getByRole('heading',{name:'Thank you for sharing your experience!',exact:true});
  for(const [platform,name] of [['google','Google'],['angi','Angi'],['thumbtack','Thumbtack']] as const){
   const card=page.locator(`.destination[data-platform=${platform}]`);
   await expect(card.getByRole('button',{name:`I posted my ${name} review`,exact:true})).toHaveCount(0);
   await openReviewTab(page,businessReviewLinks[platform],()=>card.getByRole('button',{name:`Paste my review to ${name}`,exact:true}).click());
   await expect(thanks).toHaveCount(0);expect(await page.evaluate(()=>sessionStorage.getItem('qa-completion-copy'))).toBe(text);
   await card.getByRole('button',{name:`I posted my ${name} review`,exact:true}).click();await expect(thanks).toHaveCount(0);
  }
  const yelp=page.locator('.destination[data-platform=yelp]');await expect(yelp.getByText('Start here',{exact:true})).toBeVisible();
  await context.route(businessReviewLinks.yelp,route=>route.fulfill({contentType:'text/html',body:'<h1>Mock Yelp. No review posted.</h1>'}));
  const popupEvent=page.waitForEvent('popup');await yelp.getByRole('link',{name:'Open Yelp business page',exact:true}).click();const popup=await popupEvent;
  await expect(popup.getByRole('heading',{name:'Mock Yelp. No review posted.',exact:true})).toBeVisible();expect(page.url()).toBe(site+'?code='+code);await popup.close();
  await expect(thanks).toHaveCount(0);await page.reload();await expect(yelp.getByRole('button',{name:'I posted my Yelp review',exact:true})).toBeVisible();
  const metrics=async()=>{const data=await(await admin.get('/api/admin/dashboard')).json();return data.jobs.find((j:any)=>j.id===job.id);};
  await expect.poll(async()=>(await metrics()).reported).toBe(3);
  await yelp.getByRole('button',{name:'I posted my Yelp review',exact:true}).click();await expect(thanks).toBeVisible();
  const completion=page.getByRole('region',{name:'Review completion',exact:true});await expect(completion.getByText('Confirmed by you',{exact:true})).toHaveCount(4);
  await expect(completion).toContainText('Publication hasn’t been independently verified.');await expect.poll(async()=>(await metrics()).reported).toBe(4);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await mkdir('.sites-runtime/qa',{recursive:true});await page.screenshot({path:`.sites-runtime/qa/review-thanks-${test.info().project.name}.png`,fullPage:true});
  await page.reload();await expect(thanks).toBeVisible();expect((await metrics()).reported).toBe(4);
  const current=await(await admin.get('/api/admin/jobs/'+job.id)).json();const links={...current.links};delete links.yelp;
  await patch(admin,{...current,links},'active');await page.reload();await expect(thanks).toBeVisible();await expect(completion.getByText('Confirmed by you',{exact:true})).toHaveCount(3);
  const withoutYelp=await(await admin.get('/api/admin/jobs/'+job.id)).json();await patch(admin,{...withoutYelp,links:businessReviewLinks},'active');await page.reload();
  await expect(thanks).toHaveCount(0);await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();await expect(yelp.getByRole('button',{name:'I posted my Yelp review',exact:true})).toHaveCount(0);
 }finally{await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});
