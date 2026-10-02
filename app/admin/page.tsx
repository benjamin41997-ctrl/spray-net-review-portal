import { getChatGPTUser,chatGPTSignInPath } from '@/app/chatgpt-auth';
import { isAdmin } from '@/lib/portal';
import Admin from './portal';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();if(!user)return <main className="entry"><img src="/branding/logo.png" alt="Spray-Net" width="230"/><p className="eyebrow">REVIEW PORTAL</p><h1>Prepare their<br/>project card.</h1><p>Sign in to manage customer pages, photos, and your QR stickers.</p><a className="button" href={chatGPTSignInPath('/admin')} target="_top">Sign in with ChatGPT</a><small>Only approved administrators can access customer records.</small></main>;
 if(!await isAdmin())return <main className="entry"><h1>Access not enabled</h1><p>This account is not on the administrator list.</p><a href="/signout-with-chatgpt?return_to=/admin">Use another account</a></main>;
 return <Admin/>;}
