import {test,expect,type APIRequestContext} from './test';
import {login,browserAdmin,site,fixture,startDraft,approveReview} from './helpers';
import {businessReviewLinks} from '../lib/business';
let admin:APIRequestContext;let token:string;
test.beforeAll(async()=>{({admin,token}=await login());});test.afterAll(async()=>{await admin.dispose();});

test('review source toggles store business links, support Google opt-out, persist edits and reset new projects',async({page})=>{
 await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.getByRole('button',{name:'New project',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'New customer project'});
 await expect(dialog.getByRole('switch')).toHaveCount(4);await expect(dialog.getByRole('switch',{name:'Google',exact:true})).toBeChecked();
 await expect(dialog.getByRole('textbox')).toHaveCount(2);await expect(dialog.getByRole('combobox')).toHaveCount(0);await expect(page.getByText('Apple Maps',{exact:true})).toHaveCount(0);
 await dialog.getByLabel('Customer name',{exact:true}).fill('Review sources QA');
 for(const name of ['Angi','Thumbtack','Yelp'])await dialog.getByRole('switch',{name,exact:true}).check();
 await dialog.getByRole('button',{name:'Create project',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Prepare their project.'})).toBeVisible();
 const d=await(await admin.get('/api/admin/dashboard')).json();const job=d.jobs.find((j:any)=>j.internal_name==='Review sources QA');expect(job.links).toEqual(businessReviewLinks);
 await page.getByRole('switch',{name:'Google',exact:true}).uncheck();await page.getByRole('switch',{name:'Thumbtack',exact:true}).uncheck();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Project saved.',{exact:true})).toBeVisible();
 await page.reload();const row=page.locator('.project-row').filter({has:page.getByRole('heading',{name:'Review sources QA',exact:true})});await row.getByRole('button',{name:/Open project/}).click();
 await expect(page.getByRole('switch',{name:'Google',exact:true})).not.toBeChecked();await expect(page.getByRole('switch',{name:'Thumbtack',exact:true})).not.toBeChecked();await expect(page.getByRole('switch',{name:'Angi',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Activate page',exact:true}).click();await expect(page.getByText('Customer page activated.',{exact:true})).toBeVisible();
 const popupEvent=page.waitForEvent('popup');await page.getByRole('link',{name:'Preview project layout'}).click();const customer=await popupEvent;
 await startDraft(customer);await customer.getByLabel('Your review',{exact:true}).fill('The finished cabinets look good.');await approveReview(customer);
 await expect(customer.getByRole('link',{name:'Continue to Angi',exact:true})).toHaveAttribute('href',businessReviewLinks.angi);
 await expect(customer.getByRole('link',{name:'Open Yelp business page',exact:true})).toHaveAttribute('href',businessReviewLinks.yelp);
 await expect(customer.getByRole('button',{name:'Paste my review to Google',exact:true})).toHaveCount(0);await expect(customer.getByRole('link',{name:'Continue to Thumbtack',exact:true})).toHaveCount(0);await expect(customer.getByRole('link',{name:'Continue to Yelp',exact:true})).toHaveCount(0);await expect(customer.getByText('Apple Maps',{exact:true})).toHaveCount(0);await customer.close();
 await page.getByRole('button',{name:'New project',exact:true}).click();dialog=page.getByRole('dialog',{name:'New customer project'});
 await expect(dialog.getByRole('switch',{name:'Google',exact:true})).toBeChecked();for(const name of ['Angi','Thumbtack','Yelp'])await expect(dialog.getByRole('switch',{name,exact:true})).not.toBeChecked();
 await dialog.getByLabel('Customer name',{exact:true}).fill('Angi-only QA');await dialog.getByRole('switch',{name:'Google',exact:true}).uncheck();await dialog.getByRole('switch',{name:'Angi',exact:true}).check();await dialog.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.getByRole('heading',{name:'Prepare their project.'})).toBeVisible();
 const second=await(await admin.get('/api/admin/dashboard')).json();const next=second.jobs.find((j:any)=>j.internal_name==='Angi-only QA');expect(next.links).toEqual({angi:businessReviewLinks.angi});
 await admin.delete('/api/admin/jobs/'+job.id);await admin.delete('/api/admin/jobs/'+next.id);
});

test('toggling existing destinations preserves customer-specific URLs and hides legacy Apple links',async({page})=>{
 const j=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Existing sources QA',links:{...fixture.links,apple:'https://maps.apple.com/?q=test'}}})).json();
 await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.locator('.project-row').filter({has:page.getByRole('heading',{name:'Existing sources QA',exact:true})}).getByRole('button',{name:/Open project/}).click();
 await page.getByRole('switch',{name:'Thumbtack',exact:true}).uncheck();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Project saved.',{exact:true})).toBeVisible();
 const updated=await(await admin.get('/api/admin/jobs/'+j.id)).json();expect(updated.links.angi).toBe(fixture.links.angi);expect(updated.links.google).toBe(fixture.links.google);expect(updated.links.thumbtack).toBeUndefined();await expect(page.getByText('Apple Maps',{exact:true})).toHaveCount(0);
 await admin.delete('/api/admin/jobs/'+j.id);
});
