import {request,expect,type Page,type APIRequestContext} from '@playwright/test';
export const site='http://127.0.0.1:5173/spray-net-review-portal/';
export const apiBase='http://127.0.0.1:8787';
export const origin='http://127.0.0.1:5173';
export async function login(){const a=await request.newContext({baseURL:apiBase,extraHTTPHeaders:{Origin:origin}});const response=await a.post('/api/local/signin');if(!response.ok())throw Error('Local auth backend unavailable.');const session=await response.json();await a.dispose();const token=session.access_token;return {admin:await request.newContext({baseURL:apiBase,extraHTTPHeaders:{Origin:origin,Authorization:'Bearer '+token}}),token};}
export async function browserAdmin(page:Page,token:string){await page.addInitScript(token=>localStorage.setItem('spraynet-review-local-admin',token),token);}
export const fixture={internal_name:'Pages QA private job',title:'We loved working with you, Casey!',source:'angi',links:{google:'https://g.page/r/test/review',angi:'https://www.angi.com/write-review/test',thumbtack:'https://www.thumbtack.com/reviews/test',yelp:'https://www.yelp.com/biz/test'}};
export async function make(admin:APIRequestContext){return (await admin.post('/api/admin/jobs',{data:fixture})).json();}
export async function patch(admin:APIRequestContext,job:any,status:string){return (await admin.patch('/api/admin/jobs/'+job.id,{data:{...job,status}}));}

export async function startDraft(page:Page,mode:'type'|'voice'='type'){
 await page.getByRole('button',{name:mode==='voice'?'Speak my review':'Type my review',exact:true}).click();
}
export async function openReviewTab(page:Page,url:string,click:()=>Promise<void>){
 const portal=page.url();
 // Popup navigation is outside the parent page's route handlers.
 await page.context().route(url,r=>r.fulfill({contentType:'text/html',body:'<h1>Mock external review page. Nothing is posted.</h1>'}));
 const opening=page.waitForEvent('popup');await click();const tab=await opening;
 await expect(tab).toHaveURL(url);expect(await tab.evaluate(()=>window.opener===null)).toBe(true);await expect(page).toHaveURL(portal);await tab.close();
}
export async function approveReview(page:Page){
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();
}

export async function returnToCheck(page:Page){
 for(let i=0;i<2;i++){
  if(await page.getByRole('heading',{name:'Check your review',exact:true}).isVisible())return;
  const previous=await page.locator('h1').textContent();await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('h1')).not.toHaveText(previous!);
 }
 await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();
}
