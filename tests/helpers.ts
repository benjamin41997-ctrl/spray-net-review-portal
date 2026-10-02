import {request,type Page,type APIRequestContext} from '@playwright/test';
export const site='http://127.0.0.1:5173/spray-net-review-portal/';
export const apiBase='http://127.0.0.1:8787';
export const origin='http://127.0.0.1:5173';
export async function login(){const a=await request.newContext({baseURL:apiBase,extraHTTPHeaders:{Origin:origin}});const response=await a.post('/api/local/signin');if(!response.ok())throw Error('Local auth backend unavailable.');const session=await response.json();await a.dispose();const token=session.access_token;return {admin:await request.newContext({baseURL:apiBase,extraHTTPHeaders:{Origin:origin,Authorization:'Bearer '+token}}),token};}
export async function browserAdmin(page:Page,token:string){await page.addInitScript(token=>localStorage.setItem('spraynet-review-local-admin',token),token);}
export const fixture={internal_name:'Pages QA private job',title:'Your finished kitchen',source:'angi',links:{google:'https://g.page/r/test/review',angi:'https://www.angi.com/write-review/test',thumbtack:'https://www.thumbtack.com/reviews/test',yelp:'https://www.yelp.com/biz/test'}};
export async function make(admin:APIRequestContext){return (await admin.post('/api/admin/jobs',{data:fixture})).json();}
export async function patch(admin:APIRequestContext,job:any,status:string){return (await admin.patch('/api/admin/jobs/'+job.id,{data:{...job,status}}));}

export async function startDraft(page:Page,mode:'type'|'voice'='type',help=false){
 await page.getByRole('button',{name:help?'Help me with my review':'Write my review',exact:true}).click();
 await page.getByRole('button',{name:mode==='voice'?'Speak my review':'Type my review',exact:true}).click();
}
export async function approveReview(page:Page){
 await page.getByRole('button',{name:/^(Check my review|Check & format with AI)$/}).click();
 await page.getByRole('button',{name:'Use this review',exact:true}).click();
}
