import {useEffect,useState} from 'react';
import {Download,Loader2} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {getAccessToken} from '@/lib/auth';
import {beforeAfterFile,photoFile} from '@/lib/photo-files';
import {saveFile} from '@/lib/client';
import SecurePhoto from './SecurePhoto';

type Photo={id:string;kind:string;label:string};
type Prepared={key:string;files:File[];combined:File|null;combinedURL:string;canShare:boolean;canShareCombined:boolean};
export default function PhotoHandoff({photos,selected,onSelect,photoURL,onContinue}:{photos:Photo[];selected:string[];onSelect:(ids:string[])=>void;photoURL:(id:string)=>string;onContinue:()=>void}){
 const [prepared,setPrepared]=useState<Prepared|null>(null);const [error,setError]=useState('');const [status,setStatus]=useState('');const [sharing,setSharing]=useState(false);const [retry,setRetry]=useState(0);const [downloadRequested,setDownloadRequested]=useState(false);
 const chosen=photos.filter(p=>selected.includes(p.id));const key=JSON.stringify(chosen.map(p=>[p.id,photoURL(p.id)]));const ready=prepared?.key===key?prepared:null;
 useEffect(()=>{
  let cancelled=false,combinedURL='';const controller=new AbortController();setPrepared(null);setError('');setStatus('');
  if(!chosen.length)return;
  (async()=>{
   const token=await getAccessToken();const files=await Promise.all(chosen.map(async(p)=>{const r=await fetch(photoURL(p.id),{headers:token?{Authorization:'Bearer '+token}:{},signal:controller.signal});if(!r.ok)throw Error('A selected photo is unavailable. Try again or choose another photo.');return photoFile(await r.blob(),`Spray-Net-${p.kind}-${String(photos.findIndex(x=>x.id===p.id)+1).padStart(2,'0')}.jpg`);}));
   // Preparation happens after selection, before the save tap. Native sharing
   // must be called synchronously from that tap, without awaiting a fetch.
   let combined:File|null=null;if(chosen.length===2&&chosen.some(p=>p.kind==='before')&&chosen.some(p=>p.kind==='after')){
    try{combined=await beforeAfterFile(files[chosen.findIndex(p=>p.kind==='before')],files[chosen.findIndex(p=>p.kind==='after')]);}catch{/* Separate originals remain usable if composing the pair fails. */}
   }
   if(cancelled)return;if(combined)combinedURL=URL.createObjectURL(combined);
   const shareable=(items:File[])=>{try{return !!navigator.share&&!!navigator.canShare?.({files:items});}catch{return false;}};
   setPrepared({key,files,combined,combinedURL,canShare:shareable(files),canShareCombined:!!combined&&shareable([combined])});
  })().catch(e=>{if(!cancelled)setError((e as Error).message||'Photos could not be prepared. Please try again.');});
  return()=>{cancelled=true;controller.abort();if(combinedURL)URL.revokeObjectURL(combinedURL);};
 },[key,retry]);
 function select(ids:string[]){setPrepared(null);setStatus('');setError('');onSelect(ids);}
 function share(files:File[]){
  setSharing(true);setStatus('');
  try{
   const result=navigator.share({files,title:'Your Spray-Net project photos'});
   void result.then(()=>onContinue()).catch(e=>{setStatus((e as Error).name==='AbortError'?'Photo menu canceled. You can try again or download a photo below.':'The photo menu could not open. Download a photo below instead.');}).finally(()=>setSharing(false));
  }catch{setSharing(false);setStatus('The photo menu could not open. Download a photo below instead.');}
 }
 function download(file:File){saveFile(file,file.name);setDownloadRequested(true);setStatus('Download requested. Check your browser’s Downloads or Files, then attach it on Google.');}
 return <section className="panel stack" id="project-photos" aria-labelledby="photo-heading">
  <div><h2 id="photo-heading">Your project photos</h2><p>All project photos are selected. Uncheck any you don’t want to include.</p><small>Project photos supplied by Spray-Net.</small></div>
  <div className="photo-grid">{photos.map(p=><figure className="photo-card" key={p.id}><SecurePhoto src={photoURL(p.id)} alt={p.label}/><span className="photo-type">{p.kind==='after'?'After':p.kind}</span><label className="photo-caption"><Checkbox checked={selected.includes(p.id)} disabled={sharing} aria-label={`Select ${p.label}`} onCheckedChange={v=>select(v===true?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.label}</label></figure>)}</div>
  <div className="actions"><button className="secondary" disabled={sharing} onClick={()=>select(photos.map(p=>p.id))}>Select all photos</button>{selected.length>0&&<button className="quiet" disabled={sharing} onClick={()=>select([])}>Deselect all photos</button>}</div>
  {chosen.length>0&&!ready&&!error&&<div role="status"><Loader2 className="inline-loader"/> Preparing {chosen.length} photo{chosen.length===1?'':'s'}…</div>}
  {error&&<div className="notice error" role="alert">{error}<button className="secondary" onClick={()=>setRetry(v=>v+1)}>Retry photo preparation</button></div>}
  {ready&&<>
   {ready.canShare&&<button className="full" disabled={sharing} onClick={()=>share(ready.files)}><Download/>Share my photos ({ready.files.length})</button>}
   {ready.canShare&&<small>On iPhone, choose “Save Image” or “Save Images” if offered. On other devices, choose a save option or use the downloads below.</small>}
   {ready.canShare?<details className="photo-options"><summary>Download photos instead</summary><div className="actions">{ready.files.map((file,i)=><button className="secondary" disabled={sharing} key={file.name} onClick={()=>download(file)}><Download/>Download {chosen[i].label}</button>)}</div></details>:<div className="actions">{ready.files.map((file,i)=><button className="secondary" disabled={sharing} key={file.name} onClick={()=>download(file)}><Download/>Download {chosen[i].label}</button>)}</div>}
   {ready.combined&&<details className="photo-bundle"><summary>Save as one before-and-after photo</summary><div className="stack"><h3>One photo, both views</h3><img className="combined-preview" src={ready.combinedURL} alt="Selected before and after views together, without cropping"/><small>Save this combined image to attach just one photo on Google. Both original views are included in full.</small><button className="full" disabled={sharing} onClick={()=>ready.canShareCombined?share([ready.combined!]):download(ready.combined!)}><Download/>{ready.canShareCombined?'Save before-and-after photo':'Download before-and-after photo'}</button>{ready.canShareCombined&&<button className="quiet" disabled={sharing} onClick={()=>download(ready.combined!)}>Download combined photo instead</button>}</div></details>}
   <small>On Google, tap “Add photos” and choose the image you saved. If you downloaded it, look in Downloads or Files when available.</small>
  </>}
  {status&&<div className="notice" role="status">{status}</div>}
  {(downloadRequested||!chosen.length)&&<button className="full" disabled={sharing} onClick={onContinue}>Next</button>}
 </section>;
}
