import type {Env} from './types';
export function isLocal(request:Request,env:Env){return env.ENVIRONMENT==='local'&&['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname);}
export function allowedOrigin(request:Request,env:Env){const origin=request.headers.get('origin');return !!origin&&(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin);}
function equal(a:string,b:string){if(a.length!==b.length)return false;let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0;}
export async function authenticate(request:Request,env:Env,fetcher:typeof fetch=fetch):Promise<boolean>{
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]{1,8192}$/.test(authorization))return false;
 const accessToken=authorization.slice(7);
 if(isLocal(request,env)&&env.LOCAL_ADMIN_TOKEN&&equal(accessToken,env.LOCAL_ADMIN_TOKEN))return true;
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return false;
 let authURL:URL;try{authURL=new URL(env.SUPABASE_URL);if(authURL.protocol!=='https:'||authURL.username||authURL.password)return false;}catch{return false;}
 try{
  const result=await fetcher(new URL('/auth/v1/user',authURL),{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!result.ok)return false;
  const user=await result.json() as {id?:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean};
  return !!user.id&&!!user.email_confirmed_at&&user.is_anonymous!==true&&typeof user.email==='string'&&(env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).includes(user.email.toLowerCase());
 }catch{return false;}
}
