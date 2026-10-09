export type PortalConfig={apiBaseURL:string;portalURL:string;supabaseURL:string;supabasePublishableKey:string;localPreview:boolean;adminEmailCodes:boolean};
let config:PortalConfig;
export async function loadConfig(){
 const response=await fetch(new URL(import.meta.env.BASE_URL+'portal-config.json',location.origin),{cache:'no-store'});
 if(!response.ok)throw Error('Portal configuration could not be loaded.');
 const input=await response.json() as Record<string,unknown>;
 const localPreview=import.meta.env.DEV&&input.localPreview===true;
 function url(value:unknown,optional=false){if(optional&&!value)return '';if(typeof value!=='string')throw Error('Portal configuration is incomplete.');const parsed=new URL(value);if(parsed.username||parsed.password||(!localPreview&&parsed.protocol!=='https:')||(localPreview&&!['http:','https:'].includes(parsed.protocol)))throw Error('Portal configuration requires secure URLs.');return parsed.href;}
 config={apiBaseURL:url(input.apiBaseURL,true).replace(/\/$/,''),portalURL:url(input.portalURL||new URL(import.meta.env.BASE_URL,location.origin).href),supabaseURL:url(input.supabaseURL,true),supabasePublishableKey:typeof input.supabasePublishableKey==='string'?input.supabasePublishableKey:'',localPreview,adminEmailCodes:input.adminEmailCodes===true};
 if(config.supabasePublishableKey.startsWith('sb_secret_'))throw Error('A private API key must never be included in the website configuration.');
 if(config.supabasePublishableKey.startsWith('eyJ')){try{if(JSON.parse(atob(config.supabasePublishableKey.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role!=='anon')throw Error();}catch{throw Error('Only a Supabase public publishable or anon key belongs in website configuration.');}}
 return config;
}
export function getConfig(){if(!config)throw Error('Portal configuration is not ready.');return config;}
