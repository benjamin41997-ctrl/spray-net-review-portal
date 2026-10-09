import {useEffect,useState} from 'react';
import {getConfig} from '@/lib/config';
import {signInWithPassword,requestPasswordEmail,signInCallbackError,enterLocalPreview} from '@/lib/auth';

export default function AdminSignIn(){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [reset,setReset]=useState(false);
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState(signInCallbackError);
 const [retryAt,setRetryAt]=useState(0);const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const cooldown=Math.max(0,Math.ceil((retryAt-now)/1000));
 async function submit(){
  if(busy||reset&&cooldown)return;setBusy(true);setError('');setNotice('');
  try{if(reset){await requestPasswordEmail(email);const sentAt=Date.now();setNow(sentAt);setRetryAt(sentAt+60000);setNotice('If this email has an administrator account, you’ll receive a password setup link. Open it once to choose your password. Check your spam folder too.');}else{await signInWithPassword(email,password);setPassword('');location.reload();}}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="stack"><p>{reset?'Set a password for your existing administrator account, or reset a forgotten password.':'Sign in with your administrator email and password. Customers do not need to sign in.'}</p>
  <form className="stack" onSubmit={e=>{e.preventDefault();void submit();}}>
   <label>Administrator email<input type="email" required autoComplete="username" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   {!reset&&<label>Password<input type="password" required autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>}
   <button disabled={busy||!getConfig().supabaseURL||reset&&cooldown>0}>{busy?(reset?'Sending…':'Signing in…'):reset?(cooldown>0?`Send another link in ${cooldown}s`:'Email me a password setup link'):'Sign in'}</button>
  </form>
  <button className="quiet" disabled={busy} onClick={()=>{setReset(!reset);setPassword('');setNotice('');setError('');}}>{reset?'Back to sign in':'Set up or reset my password'}</button>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {!getConfig().supabaseURL&&!getConfig().localPreview&&<div className="notice">Administrator sign-in needs backend and Supabase configuration before launch.</div>}
  {getConfig().localPreview&&<div className="notice stack"><p>Local preview only · simulated administrator session. No email is sent.</p><button onClick={async()=>{try{await enterLocalPreview();location.reload();}catch(e){setError((e as Error).message);}}}>Enter local admin preview</button></div>}
 </div>;
}
