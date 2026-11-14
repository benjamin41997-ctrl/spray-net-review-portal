import {useEffect,useState} from 'react';
import {Printer,QrCode} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {saveFile} from '@/lib/client';
import {portalLink} from '@/lib/urls';
import type {SheetOptions} from '@/lib/sticker-pdf';

type Code={token:string;label:string};
export const defaultStickerLayout:Omit<SheetOptions,'origin'|'test'>={width:66.675,height:25.4,marginX:4.7625,marginY:12.7,gapX:3.175,gapY:0,paper:'letter'};

export default function QRPreview({codes,options,label,title,description,buttonClass='secondary',disabled=false}:{codes:Code[];options:SheetOptions;label:string;title:string;description:string;buttonClass?:string;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const [selected,setSelected]=useState('');
 const [image,setImage]=useState<{link:string;src:string}|null>(null);
 const [error,setError]=useState('');const [printing,setPrinting]=useState(false);
 const code=codes.find(q=>q.token===selected)||codes[0];
 const link=code?portalLink({code:code.token},options.origin):'';
 const stickerLabel=code?`${options.test?'TEST · ':''}${code.label}`:'';
 useEffect(()=>{
  if(!open||!link)return;
  let cancelled=false;
  void import('qrcode').then(({default:qr})=>qr.toDataURL(link,{errorCorrectionLevel:'M',margin:4,scale:10})).then(src=>{
   if(!cancelled)setImage({link,src});
  }).catch(()=>{if(!cancelled)setError('Couldn’t draw this QR code. Close the preview and try again.');});
  return()=>{cancelled=true;};
 },[open,link]);
 async function printOne(){
  if(!code)return;
  setError('');setPrinting(true);
  try{
   const {stickerPDF}=await import('@/lib/sticker-pdf');
   const result=await stickerPDF([code],options);
   saveFile(new Blob([result as BlobPart],{type:'application/pdf'}),`spray-net-${options.test?'TEST-':''}${code.label.replace(/[^A-Za-z0-9-]+/g,'-')}.pdf`);
  }catch(e){setError((e as Error).message);}finally{setPrinting(false);}
 }
 return <Dialog open={open} onOpenChange={value=>{setOpen(value);setError('');}}>
  <DialogTrigger asChild><button className={buttonClass} disabled={disabled||!code}><QrCode/>{label}</button></DialogTrigger>
  <DialogContent className="qr-preview-dialog" showCloseButton={false}>
   <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
   {codes.length>1&&<label>Choose a QR code<select value={code?.token||''} onChange={e=>{setSelected(e.target.value);setError('');}}>{codes.map(q=><option key={q.token} value={q.token}>{q.label}</option>)}</select></label>}
   {image?.link===link?<img className="qr-scan-image" src={image.src} alt={`Scannable QR code for ${stickerLabel}`}/>:!error&&<p role="status">Preparing QR code…</p>}
   <strong className="qr-preview-label">{stickerLabel}</strong>
   {error&&<p role="alert" className="notice error">{error}</p>}
   <button className="secondary" disabled={printing||!code} onClick={printOne}><Printer/>{printing?'Preparing PDF…':'Download single-sticker PDF'}</button>
   <small>Print the PDF at 100% / Actual size.</small>
   <DialogClose asChild><button className="quiet">Done</button></DialogClose>
  </DialogContent>
 </Dialog>;
}
