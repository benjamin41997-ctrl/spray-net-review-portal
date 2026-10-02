import {createRoot} from 'react-dom/client';
import {Suspense} from 'react';
import App from './App';
import {loadConfig} from '@/lib/config';
import {initializeAuth} from '@/lib/auth';
import './styles.css';
const root=createRoot(document.getElementById('root')!);
loadConfig().then(()=>initializeAuth()).then(()=>root.render(<Suspense fallback={<main className="entry"><p role="status">Loading your page…</p></main>}><App/></Suspense>)).catch(()=>root.render(<main className="entry"><h1>The portal is not ready yet.</h1><p>Configuration could not be loaded. Please contact your Spray-Net team.</p></main>));
