import {useState} from 'react';
import {setAdministratorPassword,clearPasswordSetup} from '@/lib/auth';
import {adminLink} from '@/lib/urls';

export default function AdminPassword(){
 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function save(){
  if(busy)return;setError('');if(password!==confirm){setError('Your passwords don’t match. Please enter them again.');return;}
  setBusy(true);try{await setAdministratorPassword(password);setPassword('');setConfirm('');location.assign(adminLink());}catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <div className="stack"><p>Choose your administrator password. After this, you can sign in directly with your email and password.</p>
  <form className="stack" onSubmit={e=>{e.preventDefault();void save();}}>
   <label>New password<input type={show?'text':'password'} required minLength={12} autoComplete="new-password" aria-describedby="password-length" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><small id="password-length">Use at least 12 characters.</small>
   <label>Confirm password<input type={show?'text':'password'} required minLength={12} autoComplete="new-password" value={confirm} disabled={busy} onChange={e=>setConfirm(e.target.value)}/></label>
   <button className="quiet" type="button" disabled={busy} aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Hide passwords':'Show passwords'}</button>
   <button disabled={busy}>{busy?'Saving…':'Save password and open admin'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  <a className="button secondary" href={adminLink()} onClick={()=>clearPasswordSetup()}>Back to admin</a>
 </div>;
}
