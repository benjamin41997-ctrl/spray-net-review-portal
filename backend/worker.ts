import {handle} from './api';
import {allowedOrigin,isLocal} from './auth';
import type {Env} from './types';
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const allowed=allowedOrigin(request,env);
  if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:allowed?{
   'Access-Control-Allow-Origin':request.headers.get('origin')!,
   'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type, Authorization',
   'Access-Control-Max-Age':'600','Vary':'Origin',
  }:{}});
  let response:Response;
  const path=new URL(request.url).pathname;
  if(path==='/api/local/signin'){
   response=isLocal(request,env)&&allowed&&request.method==='POST'&&env.LOCAL_ADMIN_TOKEN
    ?Response.json({access_token:env.LOCAL_ADMIN_TOKEN}):Response.json({error:'Unavailable.'},{status:404});
  }else if(path.startsWith('/api/'))response=await handle(request,env);
  else response=Response.json({error:'This backend serves API requests only.'},{status:404});
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('Vary','Origin');
  if(allowed){headers.set('Access-Control-Allow-Origin',request.headers.get('origin')!);headers.set('Access-Control-Expose-Headers','Content-Disposition');}
  return new Response(response.body,{status:response.status,headers});
 }
};
