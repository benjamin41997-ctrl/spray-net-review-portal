'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Mic,Square,PenLine,Sparkles,RotateCcw,Loader2} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Toaster,toast} from 'sonner';
import {api,orderedPlatforms,platformNames,saveFile} from '@/lib/client';
import {adminLink,assetURL,photoURL as remotePhotoURL} from '@/lib/urls';
import {publicGreeting} from '@/lib/greeting';
import GoogleHandoff from './GoogleHandoff';
import PhotoHandoff from './PhotoHandoff';

type CustomerJob={id:string;title:string;source:string;demo:boolean;links:Record<string,string>;photos:{id:string;kind:string;label:string}[]};
type Stage='welcome'|'compose'|'check'|'photos'|'share';
const stages:Stage[]=['welcome','compose','check','photos','share'];
export default function Customer({token,initial:job,capabilities,preview,admin,jobPreview=false}:{token:string;initial:CustomerJob;capabilities:{transcription:boolean;cleanup:boolean};preview:boolean;admin:boolean;jobPreview?:boolean}){
 const [stage,setStage]=useState<Stage>('welcome');
 const [mode,setMode]=useState<'type'|'voice'>('type');const [autoFormat,setAutoFormat]=useState(true);const [photoChoiceMade,setPhotoChoiceMade]=useState(false);
 const [text,setText]=useState('');const [original,setOriginal]=useState('');const [aiEdited,setAiEdited]=useState(false);
 const [selected,setSelected]=useState<string[]>(job.photos.map(p=>p.id));const [approved,setApproved]=useState(false);
 const [restored,setRestored]=useState(false);const [storageIssue,setStorageIssue]=useState(false);
 const [recording,setRecording]=useState(false);const [processing,setProcessing]=useState(false);
 const [seconds,setSeconds]=useState(0);const [audio,setAudio]=useState<Blob|null>(null);const [audioURL,setAudioURL]=useState('');
 const [reported,setReported]=useState<string[]>([]);const [editingError,setEditingError]=useState('');const [showReview,setShowReview]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);
 const recordingTimer=useRef<ReturnType<typeof setInterval>|null>(null);const limitTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const textarea=useRef<HTMLTextAreaElement>(null);const heading=useRef<HTMLHeadingElement>(null);
 const key=`spraynet-review:v1:${token}`;const base=`customer/${token}`;
 const photoURL=(id:string,download=false)=>remotePhotoURL(jobPreview?`admin/photos/${id}`:`${base}/photo/${id}`,{preview,download});
 function update(v:string){setText(v);setApproved(false);setEditingError('');}
 async function track(type:string,platform?:string){
  if(preview)return;
  try{let id:string=crypto.randomUUID();if(type==='reported'){try{const k=key+':confirmation:'+platform;id=localStorage.getItem(k)||id;localStorage.setItem(k,id);}catch{}}
   await api(`${base}/event`,{method:'POST',keepalive:true,body:JSON.stringify({id,type,platform})});
  }catch{/* Activity reporting must never prevent sharing. */}
 }
 useEffect(()=>{
  try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&Date.now()-v.savedAt<30*86400000){
   const draft=typeof v.text==='string'?v.text.slice(0,8000):'';
   setText(draft);setOriginal(typeof v.original==='string'?v.original.slice(0,8000):'');setAiEdited(v.aiEdited===true);
   const explicitPhotos=v.photoChoiceMade===true||(Array.isArray(v.selected)&&v.selected.length>0);setPhotoChoiceMade(explicitPhotos);setSelected(explicitPhotos?v.selected.filter((id:string)=>job.photos.some(p=>p.id===id)):job.photos.map(p=>p.id));
   setApproved(v.approved===true&&!!draft.trim());setReported(Array.isArray(v.reported)?v.reported:[]);
   setMode(v.mode==='voice'?'voice':'type');setAutoFormat(v.autoFormat!==false);
   const saved:Stage=stages.includes(v.stage)?v.stage:draft?'compose':'welcome';
   setStage(saved==='photos'&&!v.approved?'check':saved);
  }else localStorage.removeItem(key);}catch{setStorageIssue(true);}setRestored(true);
  try{if(!preview&&!sessionStorage.getItem(key+':visit')){void track('visit');sessionStorage.setItem(key+':visit','1');}}catch{void track('visit');}
  const context=(document as any).modelContext;const lifecycle=new AbortController();
  if(context?.registerTool){Promise.resolve(context.registerTool({name:'stage_review_text',description:'Place customer-provided text in the editable draft. Does not approve, publish or improve it.',inputSchema:{type:'object',properties:{text:{type:'string',maxLength:8000}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input:any){if(typeof input.text!=='string'||input.text.length>8000)throw Error('Text must be at most 8000 characters.');update(input.text);setStage('compose');return {staged:true,approved:false,published:false};}},{signal:lifecycle.signal})).catch(()=>{});}
  return()=>{lifecycle.abort();if(recordingTimer.current)clearInterval(recordingTimer.current);if(limitTimer.current)clearTimeout(limitTimer.current);stream.current?.getTracks().forEach(t=>t.stop());};
 },[key]);
 function saveDraft(){if(!restored)return;try{localStorage.setItem(key,JSON.stringify({text,original,aiEdited,selected,approved,reported,stage,mode,autoFormat,photoChoiceMade,savedAt:Date.now()}));}catch{setStorageIssue(true);}}
 // Persist before painting the next step: reload/navigation immediately after
 // an AI response must not restore the previous wording or approval state.
 useLayoutEffect(saveDraft,[text,original,aiEdited,selected,approved,reported,stage,mode,autoFormat,photoChoiceMade,restored,key]);
 useEffect(()=>{if(restored){heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}},[stage,restored]);
 useEffect(()=>{if(!audio){setAudioURL('');return;}const u=URL.createObjectURL(audio);setAudioURL(u);return()=>URL.revokeObjectURL(u);},[audio]);
 function stop(){if(recordingTimer.current)clearInterval(recordingTimer.current);if(limitTimer.current)clearTimeout(limitTimer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());setRecording(false);}
 async function transcribe(blob:Blob){
  setProcessing(true);
  try{const form=new FormData();const ext=blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm';form.set('audio',new File([blob],`review.${ext}`,{type:blob.type}));
   const b=await api(`${base}/transcribe`,{method:'POST',body:form});
   const draft=text?`${text}\n\n${b.text}`:b.text;if(draft.length>8000)throw Error('This transcript is too long. Save the recording below and shorten your draft before retrying.');
   setOriginal(draft);setAiEdited(false);update(draft);toast.success('Transcript ready. Check it before formatting.');
  }catch(e){toast.error((e as Error).message);}finally{setProcessing(false);}
 }
 async function start(){
  if(!capabilities.transcription){toast('Voice transcription isn’t connected yet. Use your keyboard’s microphone, or type your review.');textarea.current?.focus();return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){toast.error('Recording is unavailable in this browser. Please type or use your keyboard’s microphone.');textarea.current?.focus();return;}
  setProcessing(true);
  try{const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));const rec=new MediaRecorder(media,type?{mimeType:type}:undefined);recorder.current=rec;const chunks:BlobPart[]=[];
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onerror=()=>{stop();toast.error('Recording stopped. Please try again or type your review.');};
   rec.onstop=()=>{const b=new Blob(chunks,{type:rec.mimeType.split(';')[0]});setAudio(b);if(b.size)void transcribe(b);};
   setAudio(null);setSeconds(0);setRecording(true);rec.start();recordingTimer.current=setInterval(()=>setSeconds(s=>s+1),1000);limitTimer.current=setTimeout(stop,120000);
  }catch(e){toast.error((e as Error).name==='NotAllowedError'?'Microphone access was declined. You can allow it in browser settings, or type below.':'The microphone could not start. Please type or try again.');stream.current?.getTracks().forEach(t=>t.stop());}finally{setProcessing(false);}
 }
 async function check(useAI=autoFormat){
  if(!text.trim()||processing||recording)return;
  setEditingError('');setApproved(false);
  if(!useAI||!capabilities.cleanup){setStage('check');return;}
  if(!aiEdited)setOriginal(text);setProcessing(true);
  try{const b=await api(`${base}/cleanup`,{method:'POST',body:JSON.stringify({text})});
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>8000)throw Error('The AI edit could not be used. Your original wording is unchanged.');
   setText(b.text);setAiEdited(true);
  }catch(e){setEditingError((e as Error).message);setAiEdited(false);}finally{setProcessing(false);setStage('check');}
 }
 function back(){if(stage==='compose')setStage('welcome');else if(stage==='check')setStage('compose');else if(stage==='photos')setStage('check');else if(stage==='share')setStage(approved&&job.photos.length?'photos':text?'check':'welcome');}
 function clear(){update('');setOriginal('');setAiEdited(false);setSelected(job.photos.map(p=>p.id));setPhotoChoiceMade(false);setAutoFormat(true);setReported([]);setAudio(null);setStage('welcome');toast('Draft cleared on this device.');}
 const destinations=orderedPlatforms(job.source,job.links);
 const titles:Record<Stage,string>={welcome:publicGreeting(job.title),compose:mode==='voice'?'Speak your review':'Type your review',check:'Check your review',photos:'Add your project photos',share:'Ready to share'};
 const progress=stage==='compose'?0:stage==='check'?1:stage==='photos'?2:3;
 const editor=<label>Your review<textarea aria-label="Your review" ref={textarea} disabled={!restored||recording||processing} maxLength={8000} value={text} onChange={e=>update(e.target.value)} placeholder="Write in your own words…"/></label>;
 return <main className="customer-shell guided">
  {admin&&<div className="actions"><a className="text-link" href={adminLink({assign:token})}>Manage this sticker</a></div>}
  {preview&&<div className="notice">Administrator preview · activity is not counted.</div>}
  {job.demo&&<div className="notice demo-notice">Sample project · please don’t submit sample feedback to a real listing.</div>}
  <header className="brand"><img src={assetURL('branding/logo.png')} alt="Spray-Net"/><p className="eyebrow">SOUTH CHARLOTTE</p></header>
  {stage!=='welcome'&&<><button className="quiet back-button" disabled={recording||processing} onClick={back}><ArrowLeft/>Back</button><ol className="review-progress" aria-label="Review steps">{['Write','Check','Photos','Share'].map((label,i)=><li key={label} aria-current={i===progress?'step':undefined} className={i===progress?'current':i<progress?'complete':''}><span>{i+1}</span>{label}</li>)}</ol></>}
  <div className="intro"><h1 ref={heading} tabIndex={-1}>{titles[stage]}</h1>{stage==='welcome'&&<p>A few simple steps to share your experience.</p>}</div>
  {stage==='welcome'&&<section className="panel stack entry-choices" aria-label="Get started">
   <button className="full" disabled={!restored} onClick={()=>{setMode('type');setStage('compose');}}><PenLine/>Type my review<ArrowRight/></button>
   <button className="secondary full" disabled={!restored} onClick={()=>{setMode('voice');setStage('compose');}}><Mic/>Speak my review<ArrowRight/></button>
   <small>We’ll help tidy your wording. You approve every word.</small>
  </section>}
  {stage==='compose'&&<section className="panel stack">
   <p>Tell us about your experience in your own words.</p>
   {mode==='voice'&&<><button className={recording?'full recording':'full'} disabled={processing||!restored} onClick={recording?stop:start}>{processing?<Loader2/>:recording?<Square/>:<Mic/>}{processing?'Please wait…':recording?`Stop recording · ${seconds}s`:'Start recording'}</button><small>{capabilities.transcription?'Tap to record, then stop when you’re finished. Up to two minutes. Audio is sent for transcription.':'Voice transcription isn’t connected yet. Use the microphone on your phone keyboard, or type below.'}</small></>}
   {editor}
   {mode==='type'&&<button className="quiet" onClick={()=>setMode('voice')}><Mic/>Speak instead</button>}
   {audioURL&&<details><summary>Your recording</summary><div className="stack"><audio controls src={audioURL} aria-label="Your recording"/><div className="actions"><button className="secondary" disabled={processing} onClick={()=>audio&&transcribe(audio)}>Retry transcription</button><button className="quiet" onClick={()=>audio&&saveFile(audio,'my-review-recording.'+(audio.type.includes('mp4')?'m4a':'webm'))}>Save recording</button></div></div></details>}
   <label className="selection-label"><Checkbox checked={autoFormat} onCheckedChange={v=>setAutoFormat(v===true)} disabled={processing||recording}/>Automatically format my review</label>
   <small>{capabilities.cleanup?'We’ll tidy spelling, grammar, and paragraph breaks when you tap Next. Uncheck to keep your wording unchanged.':'AI formatting isn’t connected yet. You can continue and check your wording yourself.'}</small>
   <button className="full" disabled={!text.trim()||processing||recording} onClick={()=>check()}>{processing?<Loader2/>:<ArrowRight/>}{processing?'Formatting your review…':'Next'}</button>
  </section>}
  {stage==='check'&&<section className="panel stack">
   <p>{aiEdited?'AI checked the wording. Read it and change anything you like.':'Read your review and change anything you like.'}</p>
   {editingError&&<div className="notice error" role="alert">{editingError} Your words are still here.</div>}
   {editor}
   {original&&original!==text&&<><button className="secondary" onClick={()=>{update(original);setAiEdited(false);}}><RotateCcw/>Use my original wording</button><details className="original-review"><summary>See my original wording</summary><blockquote>{original}</blockquote></details></>}
   {capabilities.cleanup&&<button className="quiet" disabled={!text.trim()||processing} onClick={()=>check()}>{processing?<Loader2/>:<Sparkles/>}Check spelling & formatting again</button>}
   <small>By tapping Next, you confirm this text reflects your own experience.</small>
   <button className="full" disabled={!text.trim()||processing} onClick={()=>{setApproved(true);setStage(job.photos.length?'photos':'share');}}>Next<ArrowRight/></button>
  </section>}
  {stage==='photos'&&<>
   <PhotoHandoff photos={job.photos} selected={selected} onSelect={ids=>{setSelected(ids);setPhotoChoiceMade(true);}} photoURL={id=>photoURL(id,true)} onContinue={()=>setStage('share')}/>
  </>}
  {stage==='share'&&<section className="panel stack" id="destinations">
   {text.trim()&&<div><details open={showReview} onToggle={e=>setShowReview(e.currentTarget.open)} className="original-review"><summary>See my review</summary><label>Your review<textarea aria-label="Your review" ref={textarea} readOnly value={text}/></label></details><button className="quiet" onClick={()=>{setApproved(false);setStage('check');}}>Edit my review</button></div>}
   {selected.length>0&&<div className="notice photo-reminder">On Google, tap “Add photos” and look in Recents if you saved your photos. If they aren’t there, look in Files or Downloads when available.<button className="quiet" onClick={()=>setStage('photos')}>Save photos again</button></div>}
   {!destinations.length&&<div className="notice">Review links haven’t been added yet. Your draft stays here.</div>}
   {destinations.map((p,i)=><div className="destination" key={p}>
    <div className="destination-heading"><h2>{platformNames[p]}</h2>{i===0&&destinations.length>1&&<span className="badge">Start here</span>}</div>
    {p==='google'?<GoogleHandoff url={job.links[p]} text={text} approved={approved} saveDraft={saveDraft} onContinue={()=>track('click',p)} onManualCopy={()=>{setShowReview(true);requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.select();});}}/>:<><small>{p==='apple'?'Apple Maps offers ratings and photos where available.':'Copy your review, then paste it and attach any saved photos on the next page.'}</small>{approved&&p!=='apple'&&<button className="secondary full" onClick={async()=>{try{await navigator.clipboard.writeText(text);toast.success('Review copied.');}catch{setShowReview(true);requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.select();});toast('Copy the selected text using your phone’s menu.');}}}>Copy review</button>}<a className="button full" href={job.links[p]} target="_blank" rel="noopener noreferrer" onClick={()=>{saveDraft();void track('click',p);}}>Continue to {platformNames[p]}</a></>}
    <details className="completion"><summary>Already submitted your review?</summary><label className="selection-label"><Checkbox checked={reported.includes(p)} onCheckedChange={v=>{if(v===true){void track('reported',p);setReported([...reported,p]);}else setReported(reported.filter(x=>x!==p));}}/>I submitted on {platformNames[p]}</label><small>This is your confirmation; the portal cannot verify publication.</small></details>
   </div>)}
  </section>}
  {stage!=='share'&&<button className="quiet full direct-options" disabled={recording||processing||!restored} onClick={()=>setStage('share')}>Go directly to review options</button>}
  {text&&<div className="draft-notice"><small>{storageIssue?'Your browser could not save this draft. Copy it before leaving.':'Your draft is saved on this device for up to 30 days.'}</small></div>}
  <footer className="footer">{job.links.yelp&&<a href={job.links.yelp} target="_blank" rel="noopener noreferrer" onClick={()=>track('click','yelp')}>Business information on Yelp</a>}{text&&<button className="quiet" disabled={recording||processing} onClick={clear}>Clear my draft</button>}</footer>
  <Toaster richColors/>
 </main>;
}
