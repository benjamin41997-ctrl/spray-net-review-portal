import {useEffect,useRef,useState} from 'react';
import {Copy,Loader2} from 'lucide-react';

export default function GoogleHandoff({url,text,approved,photoCount,includePhotos,saveDraft,onContinue,onManualCopy,previewOnly=false}:{url:string;text:string;approved:boolean;photoCount:number;includePhotos:boolean;saveDraft:()=>void;onContinue:()=>Promise<void>;onManualCopy:()=>void;previewOnly?:boolean}){
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const [previewNotice,setPreviewNotice]=useState('');
 const current=useRef({text,approved});current.current={text,approved};
 useEffect(()=>{const reset=()=>setBusy(false);window.addEventListener('pageshow',reset);return()=>window.removeEventListener('pageshow',reset);},[]);
 async function open(){
  if(!approved||!text.trim()||busy)return;
  setBusy(true);
  try{
   // Clipboard access is initiated directly by the customer's tap. Same-tab
   // navigation avoids pop-up blockers after asynchronous clipboard permission.
   if(!failed)await navigator.clipboard.writeText(text);
  }catch{setFailed(true);setBusy(false);onManualCopy();return;}
  if(current.current.text!==text||!current.current.approved){setBusy(false);return;}
  saveDraft();
  if(previewOnly){setBusy(false);setPreviewNotice(`${failed?'This sample preview stops here.':'Review copied. This sample preview stops here;'} Google will open from a real customer page. Please don’t post sample feedback.`);return;}
  // Activity is a link click only. An unavailable API must not block Google.
  await Promise.race([onContinue(),new Promise<void>(resolve=>setTimeout(resolve,1000))]);
  setBusy(false);
  window.location.assign(url);
 }
 return <div className="stack">
  {approved&&!!text.trim()&&<ol className="google-steps" aria-label="How to post your Google review">
   <li>{failed?'Copy the selected review below, then press “Continue to Google”.':'Press “Paste my review to Google” below.'}</li>
   <li>Sign in to Google if prompted.</li>
   <li>{failed?'Paste the review you copied.':'Paste your review. It is automatically copied for you.'}</li>
   <li>{includePhotos?'Press “Add photos & videos”.':'You can post without photos.'}</li>
   <li>{includePhotos?`Import the ${photoCount} transformation photo${photoCount===1?'':'s'} you already downloaded.`:'Choose your rating.'}</li>
   <li>{includePhotos?'Confirm everything looks correct, choose your rating, and press “Post”.':'Confirm everything looks correct and press “Post”.'}</li>
  </ol>}
  <button className="full" disabled={!approved||!text.trim()||busy} onClick={open}>{busy?<Loader2/>:<Copy/>}{busy?(failed?'Opening Google…':'Copying and opening Google…'):failed?'Continue to Google':'Paste my review to Google'}</button>
  {!approved&&!!text.trim()&&<small>Use Back to check your review, then tap Next to approve it.</small>}
  {failed&&<div className="notice" role="status">Your browser couldn’t copy automatically. Your text is selected at the bottom of this page: copy it with your phone’s menu, then choose “Continue to Google”.</div>}
  {previewNotice&&<div className="notice" role="status">{previewNotice}</div>}
 </div>;
}
