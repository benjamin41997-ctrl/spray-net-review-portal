import {notFound} from 'next/navigation';
import {isAdmin,getJob,publicJob} from '@/lib/portal';
import Customer from '@/app/q/[token]/review';
export const dynamic='force-dynamic';
export default async function Preview({params}:{params:Promise<{id:string}>}){
 if(!await isAdmin())notFound();
 const {id}=await params;const job=await getJob(id);
 return <Customer token={`preview-${id}`} initial={publicJob(job)} capabilities={{transcription:false,cleanup:false}} preview admin={false} jobPreview/>;
}
