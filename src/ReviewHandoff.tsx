import {useEffect,useRef,useState} from 'react';
import {Copy,Loader2} from 'lucide-react';
import {platformNames} from '@/lib/client';
import {copyReviewText} from '@/lib/review-clipboard';

export default function ReviewHandoff({platform,url,text,approved,photoCount,includePhotos,saveDraft,onContinue,onManualCopy,progress,onReported,previewOnly=false}:{platform:'google'|'angi'|'thumbtack';url:string;text:string;approved:boolean;photoCount:number;includePhotos:boolean;saveDraft:()=>void;onContinue:()=>Promise<void>;onManualCopy:()=>void;progress?:'opened'|'reported';onReported:()=>void;previewOnly?:boolean}){
 const name=platformNames[platform];
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const [previewNotice,setPreviewNotice]=useState('');
 const [tabBlocked,setTabBlocked]=useState(false);
 const current=useRef({text,approved});current.current={text,approved};
 useEffect(()=>{const reset=()=>setBusy(false);window.addEventListener('pageshow',reset);return()=>window.removeEventListener('pageshow',reset);},[]);
 async function open(){
  if(!approved||!text.trim()||busy)return;
  setBusy(true);
  setTabBlocked(false);
  let tab:Window|null=null;
  const closeTab=()=>tab?.close();
  try{
   // Start copying and reserve the tab in the original tap, before awaiting
   // permission. Opening a tab after await is blocked by many mobile browsers.
   const copying=failed?Promise.resolve():copyReviewText(text);
   if(!previewOnly){try{tab=window.open('about:blank','_blank');if(tab){tab.opener=null;tab.document.title=`Preparing your ${name} review`;tab.document.body.textContent='Preparing your review…';}}catch{tab?.close();tab=null;}}
   await copying;
  }catch{closeTab();setFailed(true);setBusy(false);onManualCopy();return;}
  if(current.current.text!==text||!current.current.approved){tab?.close();setBusy(false);return;}
  saveDraft();
  if(previewOnly){setBusy(false);setPreviewNotice(`${failed?'This sample preview stops here.':'Review copied. This sample preview stops here;'} ${name} will open from a real customer page. Please don’t post sample feedback.`);return;}
  setBusy(false);
  if(!tab||tab.closed){setTabBlocked(true);return;}
  try{tab.location.replace(url);void onContinue();}catch{tab.close();setTabBlocked(true);}
 }
 return <div className="stack">
  {platform==='google'&&approved&&!!text.trim()&&progress!=='reported'&&<ol className="google-steps" aria-label="How to post your Google review">
   <li>{failed?'Copy the selected review below, then press “Continue to Google”.':'Press “Paste my review to Google” below.'}</li>
   <li>Sign in to Google if prompted.</li>
   <li>{failed?'Paste the review you copied.':'Paste your review. It is automatically copied for you.'}</li>
   <li>{includePhotos?`Attach the ${photoCount} transformation photo${photoCount===1?'':'s'} you already downloaded.`:'You can post without photos.'}</li>
   <li>Confirm everything looks correct, choose your rating, and press “Post”.</li>
  </ol>}
  {platform!=='google'&&approved&&!!text.trim()&&progress!=='reported'&&<small>{failed?`Copy the selected review below, then press “Continue to ${name}”.`:`Your review will be copied for you. Paste it on ${name}, then complete the steps there to post it.`}</small>}
  {progress==='reported'&&<div className="notice success" role="status">{name} review marked complete by you.</div>}
  <button className={progress==='reported'?'secondary full':'full'} disabled={!approved||!text.trim()||busy} onClick={open}>{busy?<Loader2/>:<Copy/>}{busy?(failed?`Opening ${name}…`:`Copying and opening ${name}…`):progress==='reported'?`Open ${name} again`:failed?`Continue to ${name}`:`Paste my review to ${name}`}</button>
  {!previewOnly&&progress!=='reported'&&<small>{name} opens in a new tab. After posting, close that tab to return to your review portal.</small>}
  {!previewOnly&&progress==='opened'&&<div className="review-confirmation stack"><p>Did you post your review on {name}?</p><button className="secondary full" disabled={!approved} onClick={onReported}>I posted my {name} review</button></div>}
  {tabBlocked&&<div className="notice" role="status">Your review is copied. Your browser blocked the new tab. <a className="button secondary full" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>{saveDraft();setTabBlocked(false);void onContinue();}}>Open {name} in a new tab</a></div>}
  {!approved&&!!text.trim()&&<small>Use Back to check your review, then tap Next to approve it.</small>}
  {failed&&<div className="notice" role="status">Your browser couldn’t copy automatically. Your text is selected at the bottom of this page: copy it with your phone’s menu, then choose “Continue to {name}”.</div>}
  {previewNotice&&<div className="notice" role="status">{previewNotice}</div>}
 </div>;
}
