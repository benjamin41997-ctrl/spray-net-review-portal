import {useEffect,useRef,useState} from 'react';
import {Copy,Loader2} from 'lucide-react';

export default function GoogleHandoff({url,text,approved,saveDraft,onContinue,onManualCopy}:{url:string;text:string;approved:boolean;saveDraft:()=>void;onContinue:()=>Promise<void>;onManualCopy:()=>void}){
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const current=useRef({text,approved});current.current={text,approved};
 useEffect(()=>{const reset=()=>setBusy(false);window.addEventListener('pageshow',reset);return()=>window.removeEventListener('pageshow',reset);},[]);
 async function open(){
  if(!approved||!text.trim()||busy)return;
  setBusy(true);setFailed(false);
  try{
   // Clipboard access is initiated directly by the customer's tap. Same-tab
   // navigation avoids pop-up blockers after asynchronous clipboard permission.
   await navigator.clipboard.writeText(text);
  }catch{setFailed(true);setBusy(false);onManualCopy();return;}
  if(current.current.text!==text||!current.current.approved){setBusy(false);return;}
  saveDraft();
  // Activity is a link click only. An unavailable API must not block Google.
  await Promise.race([onContinue(),new Promise<void>(resolve=>setTimeout(resolve,1000))]);
  setBusy(false);
  window.location.assign(url);
 }
 return <div className="stack">
  <small>This button copies your review and opens Google. Tap the review box there and choose “Paste”, then add your saved photos. Google may ask you to sign in and choose your stars.</small>
  <button className="full" disabled={!approved||!text.trim()||busy} onClick={open}>{busy?<Loader2/>:<Copy/>}{busy?'Copying and opening Google…':'Paste my review to Google'}</button>
  {!approved&&!!text.trim()&&<small>Choose “Edit my review”, then “Use this review” to approve your text first.</small>}
  {failed&&<div className="notice" role="status">Your browser couldn’t copy automatically. Your text is selected above: copy it with your phone’s menu, then choose “Continue to Google” below.</div>}
  <a className="text-link" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>{saveDraft();void onContinue();}}>Continue to Google</a>
  <small>Open Google directly to sign in or write there. Use Back to return to your saved draft.</small>
 </div>;
}
