import {test,expect} from './test';
import {mkdir} from 'node:fs/promises';
import {login,site,startDraft,approveReview,patch} from './helpers';
import {businessReviewLinks} from '../lib/business';

test('Yelp shares the destination layout, copies only approved text and tracks opening rather than publication',async({page,context})=>{
 const {admin}=await login();
 const job=await(await admin.post('/api/admin/jobs',{data:{internal_name:'Yelp handoff QA',title:'We loved working with you, Sam!',source:'direct',links:businessReviewLinks}})).json();
 await admin.post('/api/admin/batch',{data:{count:1}});const dashboard=await(await admin.get('/api/admin/dashboard')).json();const code=dashboard.qrs.find((q:any)=>!q.assigned_at).token;
 await admin.post('/api/admin/assign',{data:{token:code,job_id:job.id}});await patch(admin,job,'active');
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>sessionStorage.setItem('qa-yelp-copy',text)}}));
 await page.route('**/api/customer/'+code,async route=>{const response=await route.fetch();const data=await response.json();data.settings={transcription:false,cleanup:false};await route.fulfill({response,json:data});});
 await context.route(businessReviewLinks.yelp,route=>route.fulfill({contentType:'text/html',body:'<h1>Mock Yelp business listing. No review posted.</h1>'}));
 await page.goto(site+'?code='+code);await expect(page.locator('footer a')).toHaveCount(0);
 await startDraft(page);const review='The cabinets look good.\n\nThe first day started late, but the crew let me know.';await page.getByLabel('Your review',{exact:true}).fill(review);await approveReview(page);
 const card=page.locator('.destination[data-platform=yelp]');await expect(card.getByRole('heading',{name:'Yelp',exact:true})).toBeVisible();
 await expect(page.locator('.destination')).toHaveCount(4);await expect(card.getByRole('button',{name:'Copy review',exact:true})).toBeEnabled();
 const link=card.getByRole('link',{name:'Open Yelp business page',exact:true});await expect(link).toHaveAttribute('href',businessReviewLinks.yelp);
 await expect(link).toHaveAttribute('target','_blank');await expect(card.getByRole('button',{name:'I posted my Yelp review',exact:true})).toHaveCount(0);
 await expect(page.locator('footer a')).toHaveCount(0);await expect(page.getByText('Business information on Yelp',{exact:true})).toHaveCount(0);
 const width=await card.boundingBox();for(const control of [link,card.getByRole('button',{name:'Copy review',exact:true})]){const bounds=await control.boundingBox();expect(Math.abs(bounds!.width-width!.width)).toBeLessThan(2);}
 await card.getByRole('button',{name:'Copy review',exact:true}).click();expect(await page.evaluate(()=>sessionStorage.getItem('qa-yelp-copy'))).toBe(review);
 let data=await(await admin.get('/api/admin/dashboard')).json();expect(data.jobs.find((j:any)=>j.id===job.id).clicks).toBe(0);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard denied');}}}));
 await card.getByRole('button',{name:'Copy review',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(review);expect(await page.getByLabel('Your review',{exact:true}).evaluate((el:HTMLTextAreaElement)=>el.selectionEnd-el.selectionStart)).toBe(review.length);
 await mkdir('.sites-runtime/qa',{recursive:true});await card.scrollIntoViewIfNeeded();await page.screenshot({path:`.sites-runtime/qa/yelp-card-${test.info().project.name}.png`});
 const popupEvent=page.waitForEvent('popup');await link.click();const popup=await popupEvent;await expect(popup.getByRole('heading',{name:'Mock Yelp business listing. No review posted.'})).toBeVisible();await popup.close();
 await expect.poll(async()=>{const d=await(await admin.get('/api/admin/dashboard')).json();return d.jobs.find((j:any)=>j.id===job.id).clicks;}).toBe(1);
 data=await(await admin.get('/api/admin/dashboard')).json();expect(data.jobs.find((j:any)=>j.id===job.id).reported).toBe(0);await page.reload();await expect(card.getByRole('button',{name:'Copy review',exact:true})).toBeEnabled();await expect(card.getByRole('button',{name:'I posted my Yelp review',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 const updated=await(await admin.get('/api/admin/jobs/'+job.id)).json();const links={...updated.links};delete links.yelp;await patch(admin,{...updated,links},'active');await page.reload();await expect(card).toHaveCount(0);await expect(page.locator('footer a')).toHaveCount(0);
 await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();
});
