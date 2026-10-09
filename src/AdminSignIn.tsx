import {useEffect,useState} from 'react';
import {getConfig} from '@/lib/config';
import {sendSignIn,verifySignInCode,enterLocalPreview} from '@/lib/auth';

const pendingKey='spraynet-review-pending-signin';
type Pending={email:string;sentAt:number};
function readPending():Pending|null{try{const p=JSON.parse(sessionStorage.getItem(pendingKey)||'null');return p&&typeof p.email==='string'&&typeof p.sentAt==='number'&&Date.now()-p.sentAt<60*60*1000?p:null;}catch{return null;}}
export default function AdminSignIn(){
 const codeSignIn=getConfig().adminEmailCodes;
 const [pending,setPending]=useState<Pending|null>(()=>codeSignIn?readPending():null);
 const [email,setEmail]=useState(pending?.email||'');const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const cooldown=pending?Math.max(0,Math.ceil((pending.sentAt+60000-now)/1000)):0;
 function remember(value:Pending|null){setPending(value);try{if(value)sessionStorage.setItem(pendingKey,JSON.stringify(value));else sessionStorage.removeItem(pendingKey);}catch{/* Sign-in works without session storage. */}}
 async function send(){
  if(busy||cooldown)return;setBusy(true);setError('');setNotice('');
  try{const address=email.trim().toLowerCase();await sendSignIn(address);const sentAt=Date.now();setNow(sentAt);if(codeSignIn){remember({email:address,sentAt});setCode('');setNotice('Code requested. Check your inbox and spam folder. Enter the latest code here.');}else setNotice('Check your email for a sign-in link. Open it in this browser.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function verify(){
  if(busy||!pending)return;setBusy(true);setError('');setNotice('');
  try{await verifySignInCode(pending.email,code);remember(null);location.reload();}
  catch(e){setCode('');setError((e as Error).message);setBusy(false);}
 }
 return <div className="stack"><p>Sign in with an approved administrator email. Customers do not need to sign in.</p>
  {!pending?<form className="stack" onSubmit={e=>{e.preventDefault();void send();}}>
   <label>Administrator email<input type="email" required autoComplete="email" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   <button disabled={busy||!getConfig().supabaseURL}>{busy?'Sending…':codeSignIn?'Email me a sign-in code':'Email me a sign-in link'}</button>
  </form>:<>
   <p>Enter the code emailed to <strong>{pending.email}</strong>. You can keep this page open while checking your email.</p>
   <form className="stack" onSubmit={e=>{e.preventDefault();void verify();}}>
    <label>Email sign-in code<input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" maxLength={20} autoFocus value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\s/g,'').slice(0,10))}/></label>
    <button disabled={busy||!/^\d{6,10}$/.test(code)}>{busy?'Please wait…':'Sign in'}</button>
   </form>
   <button className="secondary" disabled={busy||cooldown>0} onClick={()=>void send()}>{cooldown>0?`Send another code in ${cooldown}s`:'Send another code'}</button>
   <button className="quiet" disabled={busy} onClick={()=>{remember(null);setCode('');setNotice('');setError('');}}>Use a different email</button>
  </>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {!getConfig().supabaseURL&&!getConfig().localPreview&&<div className="notice">Administrator sign-in needs backend and Supabase configuration before launch.</div>}
  {getConfig().localPreview&&<div className="notice stack"><p>Local preview only · simulated administrator session. No email is sent.</p><button onClick={async()=>{try{await enterLocalPreview();location.reload();}catch(e){setError((e as Error).message);}}}>Enter local admin preview</button></div>}
 </div>;
}
