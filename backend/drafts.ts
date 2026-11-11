import {draftLifetime,emptyDraft,parseReviewDraft,type DraftRecord} from '../lib/review-draft';
import {HttpError} from './portal';

export async function readDraft(db:D1Database,id:string):Promise<DraftRecord>{
 const row=await db.prepare('SELECT version, content, updated_at FROM review_drafts WHERE job_id=?').bind(id).first<{version:string;content:string;updated_at:number}>();
 if(!row)return {version:null,draft:emptyDraft};
 if(row.updated_at<=Date.now()-draftLifetime){
  // Keep the version so a device with an old copy cannot silently resurrect it.
  if(row.content!=='{}'){
   const version=crypto.randomUUID();
   const expired=await db.prepare("UPDATE review_drafts SET content='{}',version=? WHERE job_id=? AND version=? RETURNING version").bind(version,id,row.version).first();
   return expired?{version,draft:emptyDraft}:readDraft(db,id);
  }
  return {version:row.version,draft:emptyDraft};
 }
 return {version:row.version,draft:parseReviewDraft(JSON.parse(row.content))||emptyDraft};
}

export async function writeDraft(db:D1Database,id:string,input:any):Promise<DraftRecord|null>{
 const draft=parseReviewDraft(input?.draft);const expected=input?.version;
 if(!draft||(expected!==null&&(typeof expected!=='string'||!/^[-a-f0-9]{36}$/.test(expected))))throw new HttpError(400,'Invalid review draft.');
 const version=crypto.randomUUID();const content=draft.text?JSON.stringify(draft):'{}';const now=Date.now();
 const result=expected===null
  ?await db.prepare("INSERT INTO review_drafts(job_id,version,content,updated_at) SELECT id,?,?,? FROM jobs WHERE id=? AND status='active' ON CONFLICT(job_id) DO NOTHING RETURNING version").bind(version,content,now,id).first()
  :await db.prepare("UPDATE review_drafts SET version=?,content=?,updated_at=? WHERE job_id=? AND version=? AND (updated_at>? OR content='{}') AND EXISTS (SELECT 1 FROM jobs WHERE id=? AND status='active') RETURNING version").bind(version,content,now,id,expected,now-draftLifetime,id).first();
 return result?{version,draft}:null;
}
