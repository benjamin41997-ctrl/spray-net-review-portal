import {useEffect,useState} from 'react';
import {authorizedFetch} from '@/lib/client';
export default function PrivatePhoto({id,label}:{id:string;label:string}){
 const [url,setURL]=useState('');const [failed,setFailed]=useState(false);
 useEffect(()=>{let objectURL='';let cancelled=false;const controller=new AbortController();
  authorizedFetch('admin/photos/'+id,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const blob=await r.blob();if(cancelled)return;objectURL=URL.createObjectURL(blob);setURL(objectURL);}).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;controller.abort();if(objectURL)URL.revokeObjectURL(objectURL);};
 },[id]);
 return url?<img src={url} alt={label}/>:<div role="status" className="loading">{failed?'Photo unavailable.':'Loading photo…'}</div>;
}
