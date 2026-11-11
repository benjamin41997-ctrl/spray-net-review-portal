import {useEffect,useRef,useState} from 'react';
import {apiURL} from '@/lib/urls';
import {parseReviewDraft,sameDraft,type DraftRecord,type ReviewDraft} from '@/lib/review-draft';

async function requestDraft(path:string, record?:DraftRecord){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(apiURL(path),{signal:controller.signal,...(record?{method:'PATCH',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(record)}:{})});
  if(!response.ok&&response.status!==409)throw Error('Draft sync unavailable');
  const value=await response.json() as {draft?:unknown;version?:unknown};const draft=parseReviewDraft(value.draft);
  if(!draft||(value.version!==null&&typeof value.version!=='string'))throw Error('Invalid draft response');
  return {record:{version:value.version,draft},conflict:response.status===409};
 }finally{clearTimeout(timeout);}
}

export function useDraftSync(path:string|null,key:string,restored:boolean,hadLocalDraft:boolean,value:ReviewDraft,apply:(draft:ReviewDraft)=>void){
 const [known,setKnown]=useState<DraftRecord|null>(null);
 const [conflict,setConflict]=useState<DraftRecord|null>(null);
 const [failed,setFailed]=useState(false);const [attempt,setAttempt]=useState(0);
 const [saving,setSaving]=useState(false);const [loading,setLoading]=useState(true);
 const current=useRef({value,apply});current.current={value,apply};
 const metadata=key+':synced';
 function remember(record:DraftRecord){try{localStorage.setItem(metadata,JSON.stringify(record));}catch{/* The server still has the draft. */}setKnown(record);}
 useEffect(()=>{
  if(!path||!restored||known||failed||conflict)return;
  let active=true;
  void requestDraft(path).then(({record})=>{
   if(!active)return;
   let previous:DraftRecord|null=null;
   try{previous=JSON.parse(localStorage.getItem(metadata)||'null');}catch{}
   const local=current.current.value;
   const changed=previous?.draft&&hadLocalDraft?!sameDraft(local,previous.draft):!!local.text;
   if(changed&&record.version!==null&&record.version!==previous?.version&&!sameDraft(local,record.draft))setConflict(record);
   else {
    if(!changed&&!sameDraft(local,record.draft))current.current.apply(record.draft);
    remember(record);
   }
   setLoading(false);
  }).catch(()=>{if(active){setFailed(true);setLoading(false);}});
  return()=>{active=false;};
 },[path,restored,hadLocalDraft,known,failed,conflict,attempt]);

 useEffect(()=>{
  if(!path||!known||failed||conflict||saving||sameDraft(value,known.draft))return;
  let started=false;
  function flush(){
   if(started)return;started=true;setSaving(true);
   const draft=current.current.value;
   void requestDraft(path!,{version:known!.version,draft}).then(result=>{
    if(result.conflict&&!sameDraft(result.record.draft,draft))setConflict(result.record);
    else remember(result.record);
   }).catch(()=>setFailed(true)).finally(()=>setSaving(false));
  }
  const timer=setTimeout(flush,600);
  const hidden=()=>{if(document.visibilityState==='hidden')flush();};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',flush);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',flush);};
 },[path,known,failed,conflict,saving,value.text,value.original,value.aiEdited,value.needsDetail]);

 return {loading:!!path&&loading,failed,saving:!!path&&!conflict&&!failed&&!!known&&(saving||!sameDraft(value,known.draft)),conflict,
  retry:()=>{setFailed(false);setAttempt(n=>n+1);},
  useOnline:()=>{if(conflict){current.current.apply(conflict.draft);remember(conflict);setConflict(null);}},
  useLocal:()=>{if(conflict){remember(conflict);setConflict(null);}},
 };
}
