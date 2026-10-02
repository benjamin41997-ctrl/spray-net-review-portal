import {useEffect,useState} from 'react';
import {Download,Loader2,ArrowRight,ArrowLeft} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {getAccessToken} from '@/lib/auth';
import {photoFile} from '@/lib/photo-files';
import {saveFile} from '@/lib/client';
import SecurePhoto from './SecurePhoto';

type Photo={id:string;kind:string;label:string};
type Prepared={key:string;files:Record<string,File>;failed:string[]};
type Mode='choices'|'select'|'skip'|'downloaded';
export const skipPhotoLabel="Don't share my photos, I don't want neighbors to be envious";
export default function PhotoHandoff({photos,selected,onSelect,photoURL,onContinue,onDownload}:{photos:Photo[];selected:string[];onSelect:(ids:string[])=>void;photoURL:(id:string)=>string;onContinue:()=>void;onDownload:(ids:string[])=>void}){
 const [mode,setMode]=useState<Mode>(selected.length===0?'skip':'choices');
 const [prepared,setPrepared]=useState<Prepared|null>(null);const [error,setError]=useState('');const [status,setStatus]=useState('');const [retry,setRetry]=useState(0);const [requested,setRequested]=useState<string[]>([]);
 const key=JSON.stringify(photos.map(p=>[p.id,photoURL(p.id)]));const ready=prepared?.key===key?prepared:null;
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();setPrepared(null);setError('');
  (async()=>{
   const token=await getAccessToken();const files:Record<string,File>={};const failed:string[]=[];
   await Promise.all(photos.map(async(p,i)=>{
    try{const r=await fetch(photoURL(p.id),{headers:token?{Authorization:'Bearer '+token}:{},signal:controller.signal});if(!r.ok)throw Error('Unavailable');files[p.id]=await photoFile(await r.blob(),`Spray-Net-${p.kind}-${String(i+1).padStart(2,'0')}.jpg`);}catch{failed.push(p.id);}
   }));
   if(cancelled)return;setPrepared({key,files,failed});if(failed.length)setError('Some photos could not be prepared. Try again or choose other photos.');
  })().catch(()=>{if(!cancelled)setError('Photos could not be prepared. Please try again.');});
  return()=>{cancelled=true;controller.abort();};
 },[key,retry]);
 const available=(ids:string[])=>!!ready&&ids.length>0&&ids.every(id=>!!ready.files[id]);
 function download(ids:string[],personal=false){
  if(!available(ids))return;
  // All files are prepared before this tap. Request JPEG downloads directly;
  // do not open a share sheet, bundle into a ZIP, or claim they were saved.
  for(const id of ids)saveFile(ready!.files[id],ready!.files[id].name);
  onDownload(ids);
  setRequested(ids);setStatus('Photo downloads requested. If your browser asks, allow multiple downloads. Look in Downloads or Files.');
  if(!personal){onSelect(ids);setMode('downloaded');}
 }
 function skip(){onSelect([]);setRequested([]);setStatus('');setMode('skip');}
 return <section className="panel stack" id="project-photos" aria-labelledby="photo-heading">
  <div><h2 id="photo-heading">Your project photos</h2><small>Project photos supplied by Spray-Net.</small></div>
  {(mode==='choices'||mode==='select')&&<div className="photo-grid">{photos.map(p=><figure className="photo-card" key={p.id}><SecurePhoto src={photoURL(p.id)} alt={p.label}/><span className="photo-type">{p.kind==='after'?'After':p.kind}</span>{mode==='select'?<label className="photo-caption"><Checkbox checked={selected.includes(p.id)} aria-label={`Select ${p.label}`} onCheckedChange={v=>onSelect(v===true?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.label}</label>:<figcaption className="photo-caption">{p.label}</figcaption>}</figure>)}</div>}
  {!ready&&!error&&<small role="status"><Loader2 className="inline-loader"/>Preparing your photos…</small>}
  {error&&<div className="notice error" role="alert">{error}<button className="secondary" onClick={()=>setRetry(v=>v+1)}>Retry photo preparation</button></div>}
  {mode==='choices'&&<div className="stack photo-choices">
   <button className="full" disabled={!available(photos.map(p=>p.id))} onClick={()=>download(photos.map(p=>p.id))}><Download/>Share all photos</button>
   <button className="secondary full" onClick={()=>setMode('select')}>Select which photos to include</button>
   <button className="quiet full" onClick={skip}>{skipPhotoLabel}</button>
  </div>}
  {mode==='select'&&<div className="stack">
   <small>Uncheck any photos you don’t want to include.</small>
   <button className="full" disabled={!available(selected)} onClick={()=>download(selected)}><Download/>Download selected photos ({selected.length})</button>
   <button className="quiet" onClick={()=>setMode('choices')}><ArrowLeft/>Back to photo options</button>
  </div>}
  {mode==='skip'&&<div className="stack">
   <p>No problem. You can still keep the photos for yourself.</p>
   <button className="secondary full" disabled={!available(photos.map(p=>p.id))} onClick={()=>download(photos.map(p=>p.id),true)}><Download/>Download photos for myself</button>
   <button className="full" onClick={onContinue}>Next<ArrowRight/></button>
   <button className="quiet" onClick={()=>setMode('choices')}><ArrowLeft/>Back to photo options</button>
  </div>}
  {mode==='downloaded'&&<div className="stack">
   <p>On Google, tap “Add photos” and choose the images you downloaded. Look in Downloads or Files if they aren’t in Recents.</p>
   <button className="full" onClick={onContinue}>Next<ArrowRight/></button>
   <button className="quiet" onClick={()=>setMode('choices')}><ArrowLeft/>Back to photo options</button>
  </div>}
  {status&&<div className="notice" role="status">{status}</div>}
  {ready&&requested.length>0&&<details className="photo-options"><summary>Download didn’t start?</summary><small>Your browser may block several downloads at once. Tap each photo to download it separately.</small><div className="actions">{photos.filter(p=>requested.includes(p.id)).map(p=><button className="secondary" key={p.id} onClick={()=>saveFile(ready.files[p.id],ready.files[p.id].name)}><Download/>Download {p.label}</button>)}</div></details>}
 </section>;
}
