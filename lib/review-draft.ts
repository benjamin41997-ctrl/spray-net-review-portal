export type ReviewDraft={text:string;original:string;aiEdited:boolean;needsDetail:boolean};
export type DraftRecord={version:string|null;draft:ReviewDraft};
export const emptyDraft:ReviewDraft={text:'',original:'',aiEdited:false,needsDetail:false};
export const draftLifetime=30*86400000;

export function parseReviewDraft(input:unknown):ReviewDraft|null{
 if(!input||typeof input!=='object')return null;
 const {text,original,aiEdited,needsDetail}=input as ReviewDraft;
 if(typeof text!=='string'||text.length>8000||typeof original!=='string'||original.length>8000||typeof aiEdited!=='boolean'||typeof needsDetail!=='boolean')return null;
 return text.trim()?{text,original,aiEdited,needsDetail}:emptyDraft;
}
export function sameDraft(a:ReviewDraft,b:ReviewDraft){return a.text===b.text&&a.original===b.original&&a.aiEdited===b.aiEdited&&a.needsDetail===b.needsDetail;}
