import {useEffect,useState} from 'react';

export default function PageLoading(){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[]);
 return <main className="entry">
  <p role="status">Loading your page…</p>
  {slow&&<><p role="status">This is taking longer than expected. You can retry if the page doesn’t open.</p><button className="secondary" onClick={()=>location.reload()}>Try again</button></>}
 </main>;
}
