import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Bootstrap a fresh local/CI database with every checked-in migration.
for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort()){
 const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.jsonc','--persist-to','.wrangler/state','--file',`drizzle/${file}`],{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status||1);
}
