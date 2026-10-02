import {useEffect,useState} from 'react';
import {getAccessToken} from '@/lib/auth';
export default function SecurePhoto({src,alt}:{src:string;alt:string}){
 const [url,setURL]=useState('');const [failed,setFailed]=useState(false);
 useEffect(()=>{let objectURL='';let cancelled=false;const controller=new AbortController();setFailed(false);
  (async()=>{const token=await getAccessToken();const r=await fetch(src,{headers:token?{Authorization:'Bearer '+token}:{},signal:controller.signal});if(!r.ok)throw Error();const blob=await r.blob();if(cancelled)return;objectURL=URL.createObjectURL(blob);setURL(objectURL);})().catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;controller.abort();if(objectURL)URL.revokeObjectURL(objectURL);};
 },[src]);
 return url?<img src={url} alt={alt}/>:<div role="status" className="loading">{failed?'Photo unavailable.':'Loading photo…'}</div>;
}
