type SavePicker=(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<{createWritable:()=>Promise<{write:(file:File)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>;

export function isAppleMobile(){return /iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;}
export function canUseApplePhotoMenu(files:File[]){
 if(!isAppleMobile()||typeof navigator.share!=='function'||typeof navigator.canShare!=='function')return false;
 try{return navigator.canShare({files});}catch{return false;}
}

// Retry a desktop save with an explicit picker when supported. No file handles
// or directory access are retained.
export function desktopPhotoSavePicker():SavePicker|undefined{
 const picker=(window as Window&{showSaveFilePicker?:SavePicker}).showSaveFilePicker;
 return typeof picker==='function'&&matchMedia('(pointer: fine)').matches?picker.bind(window):undefined;
}

export async function savePhotoWithPicker(file:File,picker:SavePicker){
 const handle=await picker({suggestedName:file.name,types:[{description:'Project photo',accept:{'image/jpeg':['.jpg']}}]});
 const writer=await handle.createWritable();
 try{await writer.write(file);await writer.close();}
 catch(error){await writer.abort().catch(()=>{});throw error;}
}
