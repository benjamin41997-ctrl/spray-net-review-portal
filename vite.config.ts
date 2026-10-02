import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const base=process.env.PORTAL_BASE_PATH||'/spray-net-review-portal/';
function localConfig():Plugin{return {name:'local-portal-config',apply:'serve',configureServer(server){server.middlewares.use((request,response,next)=>{if(request.url?.split('?')[0]===base+'portal-config.json'){
 response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify({apiBaseURL:'http://127.0.0.1:8787',portalURL:'http://127.0.0.1:5173'+base,supabaseURL:'',supabasePublishableKey:'',localPreview:true}));return;}next();});}};}
export default defineConfig({base,plugins:[react(),localConfig()],resolve:{alias:{'@':fileURLToPath(new URL('./',import.meta.url))}},server:{host:'127.0.0.1',port:5173,strictPort:true},build:{outDir:'dist/site',emptyOutDir:true}});
