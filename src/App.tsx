import {useEffect,useState,lazy} from 'react';
const Admin=lazy(()=>import('./admin/Admin'));
const Customer=lazy(()=>import('./Customer'));
import {api} from '@/lib/client';
import {getConfig} from '@/lib/config';
import {getAccessToken,signOut} from '@/lib/auth';
import AdminSignIn from './AdminSignIn';
import {adminLink,assetURL} from '@/lib/urls';
import {googleReviewURL} from '@/lib/business';

const publicSample={id:'public-sample',title:'We loved working with you, Sam!',source:'training',demo:true,links:{google:googleReviewURL},photos:[{id:'before',kind:'before',label:'Before · Spray-Net network sample'},{id:'after',kind:'after',label:'After · Spray-Net network sample'}]};

function Message({title,children}:{title:string;children:React.ReactNode}){return <main className="entry"><img src={assetURL('branding/logo.png')} alt="Spray-Net"/><p className="eyebrow">SOUTH CHARLOTTE</p><h1>{title}</h1>{children}</main>;}
function SignIn(){return <Message title="Prepare their project card."><AdminSignIn/></Message>;}

export default function App(){const params=new URLSearchParams(location.search);const code=params.get('code');const adminRequested=params.has('admin');const previewJob=params.get('previewJob');const preview=params.get('preview')==='1';const[loaded,setLoaded]=useState<any>(null);const[error,setError]=useState('');const[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{let live=true;(async()=>{try{if(!adminRequested&&!code&&(params.get('demo')==='1'||!getConfig().apiBaseURL||!getConfig().supabaseURL&&!getConfig().localPreview)){const connection=getConfig().apiBaseURL?await api('preview'):{settings:{transcription:false,cleanup:false}};if(live)setLoaded({job:publicSample,settings:connection.settings,previewToken:connection.token,staticDemo:true});return;}const hasSession=!!await getAccessToken();let signed=false;if(hasSession){try{await api('admin/session');signed=true;}catch(e){if(adminRequested)throw e;}}if(live)setSignedIn(signed);if(adminRequested){if(!signed)return;const dashboard=await api('admin/dashboard');if(previewJob){const job=await api('admin/jobs/'+encodeURIComponent(previewJob));if(live)setLoaded({job,settings:dashboard.settings});}else if(live)setLoaded({admin:true});return;}
 if(code){try{const result=await api('customer/'+encodeURIComponent(code)+(preview?'?preview=1':''));if(live)setLoaded({job:result,settings:result.settings});}catch(e){if(signed&&live){location.replace(adminLink({assign:code}));return;}throw e;}}else if(live)setLoaded({entry:true});
 }catch(e){if(live)setError((e as Error).message);}})();return()=>{live=false;};},[]);
 if(adminRequested&&!signedIn&&!error)return <SignIn/>;
 if(error)return <Message title={adminRequested?'Administrator access unavailable':error}><p>{adminRequested?error:'Please contact your Spray-Net team if you need help with your project card.'}</p>{adminRequested&&<button className="secondary" onClick={()=>signOut().then(()=>location.reload())}>Use another account</button>}<button className="quiet" onClick={()=>location.reload()}>Try again</button></Message>;
 if(!loaded)return <main className="entry"><p role="status">Loading your page…</p></main>;
 if(loaded.admin)return <Admin/>;
 if(loaded.entry)return <Message title="Your project. Your experience."><p>Scan your project card to see your photos and share your experience.</p><a className="button secondary" href={adminLink()}>Administrator sign-in</a></Message>;
 return <Customer token={loaded.staticDemo?(loaded.previewToken||'public-demo'):previewJob?'preview-'+previewJob:code!} initial={loaded.job} capabilities={loaded.settings} preview={!!loaded.staticDemo||!!previewJob||preview&&signedIn} admin={signedIn&&!previewJob} jobPreview={!!previewJob} staticDemo={!!loaded.staticDemo}/>;
}
