import {useEffect,useRef,useState} from 'react';
import {Download,Loader2,ArrowRight,ArrowLeft} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {getAccessToken} from '@/lib/auth';
import {photoFile} from '@/lib/photo-files';
import {saveFile} from '@/lib/client';
import {desktopPhotoSavePicker,savePhotoWithPicker} from '@/lib/photo-save';
import SecurePhoto from './SecurePhoto';

type Photo={id:string;kind:string;label:string};
type Prepared={key:string;files:Record<string,File>;failed:string[]};
type Mode='choices'|'select'|'skip';
export const skipPhotoLabel="Don't share my photos, I don't want neighbors to be jealous…";
export default function PhotoHandoff({photos,selected,onSelect,photoURL,onContinue,onDownload,recoveryOnly=false,retryDownloads=false}:{photos:Photo[];selected:string[];onSelect:(ids:string[])=>void;photoURL:(id:string)=>string;onContinue:()=>void;onDownload:(ids:string[])=>void;recoveryOnly?:boolean;retryDownloads?:boolean}){
 const [mode,setMode]=useState<Mode>(selected.length===0?'skip':'choices');
 const [prepared,setPrepared]=useState<Prepared|null>(null);const [error,setError]=useState('');const [status,setStatus]=useState('');const [retry,setRetry]=useState(0);const [requested,setRequested]=useState<string[]>([]);
 const [saving,setSaving]=useState(false);const [saveProgress,setSaveProgress]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
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
 async function download(ids:string[],personal=false,individual=false){
  if(!available(ids)||saving)return;
  const picker=(retryDownloads||individual)&&desktopPhotoSavePicker();
  if(picker){
   setSaving(true);setStatus('');
   try{
    for(const [index,id] of ids.entries()){
     setSaveProgress(`Saving photo ${index+1} of ${ids.length}…`);
     await savePhotoWithPicker(ready!.files[id],picker);if(!mounted.current)return;onDownload([id]);
    }
    setRequested(ids);setStatus(`${ids.length} photo${ids.length===1?'':'s'} saved.`);
    if(!personal&&!individual){onSelect(ids);onContinue();}
   }catch(error){if(mounted.current)setStatus((error as Error).name==='AbortError'?'Saving canceled. You can try again.':'The photos could not be saved. Try again or use the individual photo options.');}
   finally{if(mounted.current){setSaving(false);setSaveProgress('');}}
   return;
  }
  // All files are prepared before this tap. Request JPEG downloads directly;
  // do not open a share sheet, bundle into a ZIP, or claim they were saved.
  for(const id of ids)saveFile(ready!.files[id],ready!.files[id].name);
  onDownload(ids);
  setRequested(ids);if(!recoveryOnly)setStatus('Photo downloads requested. If your browser asks, allow multiple downloads. Look in Downloads or Files.');
  if(!personal&&!individual){onSelect(ids);onContinue();}
 }
 function skip(){onSelect([]);setRequested([]);setStatus('');setMode('skip');}
 const preparationStatus=<>
  {!ready&&!error&&<small role="status"><Loader2 className="inline-loader"/>Preparing your photos…</small>}
  {error&&<div className="notice error" role="alert">{error}<button className="secondary" onClick={()=>setRetry(v=>v+1)}>Retry photo preparation</button></div>}
 </>;
 const recovery=(ids:string[])=><details className="photo-options"><summary>Download didn’t start?</summary><small>Your browser may block several downloads at once. Tap each photo to download it separately. Look in Downloads or Files.</small>{recoveryOnly&&preparationStatus}<div className="actions">{photos.filter(p=>ids.includes(p.id)).map(p=><button className="secondary" key={p.id} disabled={saving||!ready?.files[p.id]} onClick={()=>download([p.id],false,true)}><Download/>Download {p.label}</button>)}</div>{saving&&<small role="status">{saveProgress}</small>}{recoveryOnly&&status&&<small role="status">{status}</small>}</details>;
 if(recoveryOnly)return recovery(selected);
 return <section className="panel stack" id="project-photos" aria-labelledby="photo-heading">
  <h2 id="photo-heading">Your project photos</h2>
  <small>For your privacy, we remove hidden metadata from uploaded photos, including location and camera details.</small>
  {(mode==='choices'||mode==='select')&&<div className="photo-grid">{photos.map(p=><figure className="photo-card" key={p.id}><SecurePhoto src={photoURL(p.id)} alt={p.label}/><span className="photo-type">{p.kind==='after'?'After':p.kind}</span>{mode==='select'?<label className="photo-caption"><Checkbox checked={selected.includes(p.id)} aria-label={`Select ${p.label}`} onCheckedChange={v=>onSelect(v===true?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.label}</label>:<figcaption className="photo-caption">{p.label}</figcaption>}</figure>)}</div>}
  {preparationStatus}
  {mode==='choices'&&<div className="stack photo-choices">
   <button className="full" disabled={saving||!available(photos.map(p=>p.id))} onClick={()=>download(photos.map(p=>p.id))}>{saving?<Loader2/>:<Download/>}{saving?saveProgress:'Save and share all photos'}</button>
   <button className="secondary full" disabled={saving} onClick={()=>setMode('select')}>Select photos to include and save</button>
   <button className="quiet full" disabled={saving} onClick={skip}>{skipPhotoLabel}</button>
  </div>}
  {mode==='select'&&<div className="stack">
   <small>Uncheck any photos you don’t want to include.</small>
   <button className="full" disabled={saving||!available(selected)} onClick={()=>download(selected)}>{saving?<Loader2/>:<Download/>}{saving?saveProgress:`Download selected photos (${selected.length})`}</button>
   <button className="quiet" disabled={saving} onClick={()=>setMode('choices')}><ArrowLeft/>Back to photo options</button>
  </div>}
  {mode==='skip'&&<div className="stack">
   <p>No problem. You can still keep the photos for yourself.</p>
   <button className="secondary full" disabled={saving||!available(photos.map(p=>p.id))} onClick={()=>download(photos.map(p=>p.id),true)}>{saving?<Loader2/>:<Download/>}{saving?saveProgress:'Download photos for myself'}</button>
   <button className="full" disabled={saving} onClick={onContinue}>Next<ArrowRight/></button>
   <button className="quiet" disabled={saving} onClick={()=>setMode('choices')}><ArrowLeft/>Back to photo options</button>
  </div>}
  {status&&<div className="notice" role="status">{status}</div>}
  {ready&&requested.length>0&&recovery(requested)}
 </section>;
}
