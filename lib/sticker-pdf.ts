import QRCode from 'qrcode';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
export type SheetOptions={origin:string;width:number;height:number;marginX:number;marginY:number;gapX:number;gapY:number;paper:'letter'|'a4';test:boolean};
export async function stickerPDF(codes:{token:string;label:string}[],o:SheetOptions){
 if(!codes.length)throw Error('Choose at least one code.');
 const origin=new URL(o.origin);if(origin.search||origin.hash||origin.username||origin.password||(!o.test&&origin.protocol!=='https:')||!['http:','https:'].includes(origin.protocol))throw Error('Use the complete portal HTTPS URL, including its repository path, without a query or fragment.');
 const dims=[o.width,o.height,o.marginX,o.marginY,o.gapX,o.gapY];if(dims.some(v=>!Number.isFinite(v)||v<0)||o.width<25||o.height<25)throw Error('Labels must be at least 25 × 25 mm with valid margins and gaps.');
 const mm=72/25.4;const pageW=(o.paper==='a4'?210:215.9)*mm,pageH=(o.paper==='a4'?297:279.4)*mm;
 const w=o.width*mm,h=o.height*mm,mx=o.marginX*mm,my=o.marginY*mm,gx=o.gapX*mm,gy=o.gapY*mm;
 const cols=Math.floor((pageW-2*mx+gx+.001)/(w+gx)),rows=Math.floor((pageH-2*my+gy+.001)/(h+gy));if(cols<1||rows<1||cols*rows>120)throw Error('These labels and margins do not fit the selected paper.');
 const pdf=await PDFDocument.create();pdf.setTitle(`Spray-Net ${o.test?'TEST ':''}QR stickers`);const font=await pdf.embedFont(StandardFonts.HelveticaBold);const navy=rgb(0,.22,.4);let page:any;
 for(let i=0;i<codes.length;i++){const pos=i%(cols*rows);if(pos===0)page=pdf.addPage([pageW,pageH]);const x=mx+(pos%cols)*(w+gx),y=pageH-my-(Math.floor(pos/cols)+1)*h-Math.floor(pos/cols)*gy;
  if(!/^[A-Za-z0-9_-]{32}$/.test(codes[i].token))throw Error('Invalid sticker token.');
  const link=new URL(origin.href);link.searchParams.set('code',codes[i].token);
  const qr=QRCode.create(link.href,{errorCorrectionLevel:'M'});const size=Math.min(w-12,h-20,82);const module=size/(qr.modules.size+8);if(module/mm<.30)throw Error('The QR is too dense for this label/URL. Use larger labels.');const qx=x+(w-size)/2,qy=y+16;
  page.drawRectangle({x:qx,y:qy,width:size,height:size,color:rgb(1,1,1)});
  for(let row=0;row<qr.modules.size;row++)for(let col=0;col<qr.modules.size;col++)if(qr.modules.get(row,col))page.drawRectangle({x:qx+(col+4)*module,y:qy+size-(row+5)*module,width:module+.005,height:module+.005,color:rgb(0,0,0)});
  const label=`${o.test?'TEST · ':''}${codes[i].label}`;const fs=9;page.drawText(label,{x:x+(w-font.widthOfTextAtSize(label,fs))/2,y:y+5,size:fs,font,color:navy});
 }
 return pdf.save();
}
