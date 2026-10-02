import {NextResponse} from 'next/server';
export function middleware(){const r=NextResponse.next();r.headers.set('Referrer-Policy','no-referrer');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('X-Robots-Tag','noindex, nofollow');r.headers.set('Permissions-Policy','microphone=(self), camera=()');r.headers.set('Cache-Control','no-store');r.headers.set('Content-Security-Policy',"frame-ancestors 'self'; base-uri 'self'; object-src 'none'");return r;}
export const config={matcher:['/((?!_next/static|branding|favicon.svg).*)']};
