import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {getConfig} from './config';
let client:SupabaseClient|null=null;
const localKey='spraynet-review-local-admin';
const recoveryKey='spraynet-review-password-recovery';
let recovery=false;let callbackError='';
function markRecovery(){recovery=true;try{sessionStorage.setItem(recoveryKey,'1');}catch{}}
export async function initializeAuth(){
 const config=getConfig();const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.has('error'))callbackError='That email link has expired or was already used. Request a new password setup link below.';
 if(config.supabaseURL&&config.supabasePublishableKey){
  client=createClient(config.supabaseURL,config.supabasePublishableKey,{auth:{storageKey:'spraynet-review-admin',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')markRecovery();});
  const {data}=await client.auth.getSession();
  // The SDK queues the recovery event. Remember the UI intent before rendering;
  // this flag never grants access: App still checks the Worker admin allowlist.
  if(hash.get('type')==='recovery'&&data.session)markRecovery();
 }
 return getAccessToken();
}
export async function getAccessToken(){if(getConfig().localPreview){try{const token=localStorage.getItem(localKey);if(token)return token;}catch{}}return (await client?.auth.getSession())?.data.session?.access_token||'';}
export async function signInWithPassword(email:string,password:string){
 if(!client)throw Error('Administrator sign-in needs Supabase configuration.');
 const {data,error}=await client.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
 if(error)throw Error(error.code==='invalid_credentials'?'Email or password is incorrect. If you haven’t set a password yet, choose “Set up or reset my password”.':error.message);
 if(!data.session)throw Error('Sign-in did not complete. Please try again.');
}
export async function requestPasswordEmail(email:string){
 if(!client)throw Error('Administrator sign-in needs Supabase configuration.');
 const url=new URL(getConfig().portalURL);url.searchParams.set('admin','1');
 const {error}=await client.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:url.href});if(error)throw Error(error.message);
}
export function needsPasswordSetup(){try{return recovery||sessionStorage.getItem(recoveryKey)==='1';}catch{return recovery;}}
export function signInCallbackError(){return callbackError;}
export async function setAdministratorPassword(password:string){
 if(!client)throw Error('Password setup needs a live Supabase administrator session.');
 if(password.length<12)throw Error('Use at least 12 characters for your password.');
 const {error}=await client.auth.updateUser({password});if(error)throw Error(error.message);
 clearPasswordSetup();
}
export function clearPasswordSetup(){recovery=false;try{sessionStorage.removeItem(recoveryKey);}catch{}}
export async function enterLocalPreview(){if(!getConfig().localPreview)throw Error('Local sign-in is unavailable.');const r=await fetch(getConfig().apiBaseURL+'/api/local/signin',{method:'POST'});if(!r.ok)throw Error('The local backend is not ready.');const result=await r.json() as {access_token:string};localStorage.setItem(localKey,result.access_token);}
export async function signOut(){clearPasswordSetup();try{localStorage.removeItem(localKey);}catch{}if(client)await client.auth.signOut();}
