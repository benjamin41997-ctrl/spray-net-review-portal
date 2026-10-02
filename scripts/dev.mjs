import {spawn} from 'node:child_process';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const vars=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
if(!/^LOCAL_ADMIN_TOKEN=.+$/m.test(vars))appendFileSync('.dev.vars','\nLOCAL_ADMIN_TOKEN='+randomBytes(32).toString('hex')+'\n');
const children=[];
function start(args){const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_LOG_PATH:'.wrangler/logs',WRANGLER_REGISTRY_PATH:'.wrangler/dev-registry'}});children.push(child);child.on('exit',code=>{if(code&&code!==0){shutdown();process.exitCode=code;}});}
function shutdown(){for(const child of children)if(!child.killed)child.kill();}
process.on('SIGINT',()=>{shutdown();process.exit(0);});process.on('SIGTERM',()=>{shutdown();process.exit(0);});
start(['node_modules/wrangler/bin/wrangler.js','dev','--config','wrangler.local.jsonc','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8787','--inspector-port','0']);
start(['node_modules/vite/bin/vite.js','--host','127.0.0.1']);
console.log('Portal preview: http://127.0.0.1:5173/spray-net-review-portal/');
