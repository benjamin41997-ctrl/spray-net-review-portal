import {apiURL} from './urls';
import {getAccessToken} from './auth';
export async function authorizedFetch(path:string,options:RequestInit={}){const headers=new Headers(options.headers);const token=await getAccessToken();if(token)headers.set('Authorization','Bearer '+token);if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');return fetch(apiURL(path),{...options,headers});}
export async function api(path:string, options:RequestInit={}){const r=await authorizedFetch(path,options);const b:any=await r.json();if(!r.ok)throw new Error(b.error||'Please try again.');return b;}
export const platformNames:Record<string,string>={google:'Google',angi:'Angi',thumbtack:'Thumbtack',apple:'Apple Maps',yelp:'Yelp'};
export const sourceNames:Record<string,string>={direct:'Direct customer',training:'Training job',angi:'Angi customer',thumbtack:'Thumbtack customer',other:'Other'};
export function orderedPlatforms(source:string,links:Record<string,string>){return [...new Set([source==='angi'||source==='thumbtack'?source:'google','google','angi','thumbtack','yelp'])].filter(p=>!!links[p]);}
export function saveFile(blob:Blob,name:string){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
