import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {getConfig} from './config';
let client:SupabaseClient|null=null;
const localKey='spraynet-review-local-admin';
export async function initializeAuth(){const config=getConfig();if(config.supabaseURL&&config.supabasePublishableKey){client=createClient(config.supabaseURL,config.supabasePublishableKey,{auth:{storageKey:'spraynet-review-admin',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});await client.auth.getSession();}return getAccessToken();}
export async function getAccessToken(){if(getConfig().localPreview){try{const token=localStorage.getItem(localKey);if(token)return token;}catch{}}return (await client?.auth.getSession())?.data.session?.access_token||'';}
export async function sendSignIn(email:string){if(!client)throw Error('Administrator sign-in needs Supabase configuration.');const url=new URL(getConfig().portalURL);url.searchParams.set('admin','1');const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:url.href}});if(error)throw Error(error.message);}
export async function enterLocalPreview(){if(!getConfig().localPreview)throw Error('Local sign-in is unavailable.');const r=await fetch(getConfig().apiBaseURL+'/api/local/signin',{method:'POST'});if(!r.ok)throw Error('The local backend is not ready.');const result=await r.json() as {access_token:string};localStorage.setItem(localKey,result.access_token);}
export async function signOut(){try{localStorage.removeItem(localKey);}catch{}if(client)await client.auth.signOut();}
