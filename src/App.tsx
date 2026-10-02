import {useEffect,useState,lazy} from 'react';
const Admin=lazy(()=>import('./admin/Admin'));
const Customer=lazy(()=>import('./Customer'));
import {api} from '@/lib/client';
import {getConfig} from '@/lib/config';
import {getAccessToken,sendSignIn,enterLocalPreview,signOut} from '@/lib/auth';
import {adminLink,assetURL} from '@/lib/urls';

function Message({title,children}:{title:string;children:React.ReactNode}){return <main className="entry"><img src={assetURL('branding/logo.png')} alt="Spray-Net"/><p className="eyebrow">SOUTH CHARLOTTE</p><h1>{title}</h1>{children}</main>;}
function SignIn(){const[email,setEmail]=useState('');const[busy,setBusy]=useState(false);const[notice,setNotice]=useState('');const[error,setError]=useState('');return <Message title="Prepare their project card."><p>Sign in with an approved administrator email. Customers do not need to sign in.</p><form className="stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await sendSignIn(email);setNotice('Check your email for a sign-in link. Open it in this browser.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Administrator email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy||!getConfig().supabaseURL}>{busy?'Sending…':'Email me a sign-in link'}</button></form>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}{!getConfig().supabaseURL&&!getConfig().localPreview&&<div className="notice">Administrator sign-in needs backend and Supabase configuration before launch.</div>}{getConfig().localPreview&&<div className="notice stack"><p>Local preview only · simulated administrator session. No email is sent.</p><button onClick={async()=>{try{await enterLocalPreview();location.reload();}catch(e){setError((e as Error).message);}}}>Enter local admin preview</button></div>}</Message>;}

export default function App(){const params=new URLSearchParams(location.search);const code=params.get('code');const adminRequested=params.has('admin');const previewJob=params.get('previewJob');const preview=params.get('preview')==='1';const[loaded,setLoaded]=useState<any>(null);const[error,setError]=useState('');const[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{let live=true;(async()=>{try{const hasSession=!!await getAccessToken();let signed=false;if(hasSession){try{await api('admin/session');signed=true;}catch(e){if(adminRequested)throw e;}}if(live)setSignedIn(signed);if(adminRequested){if(!signed)return;await api('admin/dashboard');if(previewJob){const job=await api('admin/jobs/'+encodeURIComponent(previewJob));if(live)setLoaded({job,settings:{transcription:false,cleanup:false}});}else if(live)setLoaded({admin:true});return;}
 if(code){try{const result=await api('customer/'+encodeURIComponent(code)+(preview?'?preview=1':''));if(live)setLoaded({job:result,settings:result.settings});}catch(e){if(signed&&live){location.replace(adminLink({assign:code}));return;}throw e;}}else if(live)setLoaded({entry:true});
 }catch(e){if(live)setError((e as Error).message);}})();return()=>{live=false;};},[]);
 if(adminRequested&&!signedIn&&!error)return <SignIn/>;
 if(error)return <Message title={adminRequested?'Administrator access unavailable':error}><p>{adminRequested?error:'Please contact your Spray-Net team if you need help with your project card.'}</p>{adminRequested&&<button className="secondary" onClick={()=>signOut().then(()=>location.reload())}>Use another account</button>}<button className="quiet" onClick={()=>location.reload()}>Try again</button></Message>;
 if(!loaded)return <main className="entry"><p role="status">Loading your page…</p></main>;
 if(loaded.admin)return <Admin/>;
 if(loaded.entry)return <Message title="Your project. Your experience."><p>Scan your project card to see your photos and share your experience.</p><a className="button secondary" href={adminLink()}>Administrator sign-in</a></Message>;
 return <Customer token={previewJob?'preview-'+previewJob:code!} initial={loaded.job} capabilities={loaded.settings} preview={!!previewJob||preview&&signedIn} admin={signedIn&&!previewJob} jobPreview={!!previewJob}/>;
}
