// Chromium can lose clipboard permission when focus moves to the new tab.
// Make a synchronous copy in the original tap as a fallback before opening it.
export function copyReviewText(text:string):Promise<void>{
 let writing:Promise<void>;try{writing=navigator.clipboard.writeText(text);}catch(error){writing=Promise.reject(error);}
 let copied=false;
 const active=document.activeElement;const field=document.createElement('textarea');
 try{
  field.value=text;field.readOnly=true;field.tabIndex=-1;field.setAttribute('aria-hidden','true');field.style.cssText='position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);
  copied=document.execCommand('copy');
 }catch{/* The async clipboard or manual-copy flow remains available. */}
 finally{field.remove();if(active instanceof HTMLElement)active.focus({preventScroll:true});}
 return writing.catch(error=>{if(!copied)throw error;});
}
