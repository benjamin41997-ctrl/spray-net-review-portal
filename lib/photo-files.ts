export async function loadPhoto(blob:Blob){
 const url=URL.createObjectURL(blob);const image=new Image();
 try{image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}
}
function jpeg(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('This browser could not prepare the photo.')),'image/jpeg',.9));}
export async function photoFile(blob:Blob,name:string){
 if(blob.type==='image/jpeg')return new File([blob],name,{type:'image/jpeg'});
 const image=await loadPhoto(blob);const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo preparation is unavailable.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return new File([await jpeg(canvas)],name,{type:'image/jpeg'});
}
export async function beforeAfterFile(before:File,after:File){
 const images=await Promise.all([loadPhoto(before),loadPhoto(after)]);const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=760;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Combined photo preparation is unavailable.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1600,760);
 images.forEach((image,i)=>{
  const left=24+i*800;const scale=Math.min(752/image.naturalWidth,640/image.naturalHeight);const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  // Contain the entire original image; never crop either view.
  ctx.drawImage(image,left+(752-w)/2,64+(640-h)/2,w,h);ctx.fillStyle='#003965';ctx.font='bold 30px Arial';ctx.fillText(i===0?'Before':'After',left,44);
 });
 ctx.fillStyle='#003965';ctx.font='20px Arial';ctx.fillText('Project photos supplied by Spray-Net',24,740);
 return new File([await jpeg(canvas)],'Spray-Net-before-and-after.jpg',{type:'image/jpeg'});
}
