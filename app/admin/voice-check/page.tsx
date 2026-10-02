// Local-only component integration harness. No credentials or production route behavior.
import {notFound} from 'next/navigation';
import {requireAdmin,resolveQR,publicJob} from '@/lib/portal';
import Customer from '@/app/q/[token]/review';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){if(!import.meta.env.DEV)notFound();await requireAdmin();const q=await searchParams;const token=q.token||'';const{job}=await resolveQR(token,true);return <><div className="notice">Local voice test · API responses are mocked in automated tests.</div><Customer token={token} initial={publicJob(job)} capabilities={{transcription:true,cleanup:true}} preview admin/></>;}
