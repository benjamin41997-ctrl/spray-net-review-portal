import {useEffect,useState} from 'react';
import {Loader2} from 'lucide-react';

export type PreparationPhase='microphone'|'transcribing'|'formatting';

export default function ReviewPreparation({phase}:{phase:PreparationPhase}){
 const [takingLonger,setTakingLonger]=useState(false);
 const preparing=phase!=='microphone';
 useEffect(()=>{
  setTakingLonger(false);
  if(!preparing)return;
  const timer=setTimeout(()=>setTakingLonger(true),25000);
  return()=>clearTimeout(timer);
 },[preparing]);
 const message=phase==='microphone'?'Allow microphone access if your browser asks.':phase==='transcribing'?'Turning your recording into text…':'Tidying spelling, grammar, and sentence flow…';
 return <section className="panel review-preparation" aria-label={preparing?'Review preparation':'Microphone setup'}>
  <div className="preparation-icon" aria-hidden="true"><Loader2/></div>
  <div role="status" aria-live="polite" aria-atomic="true" className="preparation-status">
   <p className="preparation-message">{message}</p>
   <p>{takingLonger?'Still working. This is taking a little longer.':preparing?'You’ll check the wording next.':'Your recording will start when the microphone is ready.'}</p>
  </div>
  {preparing&&<div className="preparation-track" role="progressbar" aria-label="Preparing your review" aria-valuemin={0} aria-valuemax={100}><span/></div>}
  <small>{preparing?'Please keep this page open. Your review will appear automatically.':'If you decline access, you can type your review instead.'}</small>
 </section>;
}
