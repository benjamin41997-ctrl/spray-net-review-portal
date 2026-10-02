import {getConfig} from './config';
export function portalLink(params:Record<string,string>={},base=getConfig().portalURL){const url=new URL(base);url.search='';url.hash='';for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);return url.href;}
export function adminLink(params:Record<string,string>={}){return portalLink({admin:'1',...params});}
export function assetURL(path:string){return new URL(import.meta.env.BASE_URL+path,location.origin).href;}
export function apiURL(path:string){const base=getConfig().apiBaseURL;if(!base)throw Error('The secure backend has not been configured.');return `${base}/api/${path}`;}
export function photoURL(path:string,{preview=false,download=false}: {preview?:boolean;download?:boolean}={}){const u=new URL(apiURL(path));if(preview)u.searchParams.set('preview','1');if(download)u.searchParams.set('download','1');return u.href;}
