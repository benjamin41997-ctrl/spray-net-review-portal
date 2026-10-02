import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {login,apiBase,site} from './helpers';
const staticSite='http://127.0.0.1:4173/spray-net-review-portal/';
test('production static bundle resolves customer query links and keeps mock admin disabled',async({page,request})=>{
 const {admin}=await login();const sample=await(await admin.post('/api/admin/seed',{data:{}})).json();await admin.dispose();
 await page.route('**/portal-config.json',r=>r.fulfill({json:{apiBaseURL:'https://api.example.test',portalURL:'https://benjamin41997-ctrl.github.io/spray-net-review-portal/',supabaseURL:'',supabasePublishableKey:'',localPreview:true}}));
 await page.route('https://api.example.test/**',async route=>{const original=new URL(route.request().url());const response=await route.fetch({url:apiBase+original.pathname+original.search});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'http://127.0.0.1:4173'}});});
 await page.goto(staticSite+'?code='+sample.qrs[0].token);await expect(page.getByRole('heading',{name:'Your kitchen transformation'})).toBeVisible();await expect(page.locator('.photo-card img').first()).toBeVisible();
 const review='These cabinets look good. The start was a day late.';await page.getByLabel('Your review',{exact:true}).fill(review);await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(review);expect(page.url()).toBe(staticSite+'?code='+sample.qrs[0].token);
 await page.goto(staticSite+'?admin=1');await expect(page.getByRole('heading',{name:'Prepare their project card.'})).toBeVisible();await expect(page.getByRole('button',{name:'Enter local admin preview'})).toHaveCount(0);
 expect((await request.get(staticSite+'api/admin/dashboard')).status()).toBe(404);expect((await request.get(staticSite+'?code='+sample.qrs[0].token)).status()).toBe(200);
});
test('Pages upload contains static assets only and no customer records or server credentials',async()=>{
 const names=await readdir('dist/site');expect(names).not.toContain('backend');expect(names).not.toContain('worker.js');expect(names).not.toContain('.dev.vars');expect(names).not.toContain('drizzle');
 const html=await readFile('dist/site/index.html','utf8');expect(html).toContain('/spray-net-review-portal/assets/');expect(html).not.toContain('QA private');
 const config=JSON.parse(await readFile('dist/site/portal-config.json','utf8'));expect(config.localPreview).toBe(false);expect(Object.keys(config)).toEqual(['apiBaseURL','portalURL','supabaseURL','supabasePublishableKey','localPreview']);
});
