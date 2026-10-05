import {Copy} from 'lucide-react';
import {portalLink} from '@/lib/urls';
import type {Job} from '@/lib/types';

export default function CustomerLink({job,origin,onCopy}:{job:Job;origin?:string;onCopy:(link:string)=>Promise<void>}){
 if(!job.customer_token)return null;
 const link=portalLink({code:job.customer_token},origin);
 return <div className="stack customer-link">
  <label>Customer link (email or text)<input aria-label="Customer review link" readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label>
  <button className="secondary" onClick={()=>onCopy(link)}><Copy/>Copy customer link</button>
  <small>{job.status==='active'?'Send this link by email or text. No QR sticker is needed.':job.status==='archived'?'This page is archived. Reactivate it before sending this link.':'Activate this page before sending the link. No QR sticker is needed.'}</small>
 </div>;
}
