import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve('dist/site');const prefix=process.env.PORTAL_BASE_PATH||'/spray-net-review-portal/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1:4173').pathname;if(!path.startsWith(prefix)){res.writeHead(404);res.end();return;}const relative=decodeURIComponent(path.slice(prefix.length))||'index.html';const file=resolve(root,relative);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}}).listen(4173,'127.0.0.1',()=>console.log('Static production preview: http://127.0.0.1:4173'+prefix));
