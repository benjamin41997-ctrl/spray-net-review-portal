import sharp from 'sharp';
import jsQR from 'jsqr';
import {readdir,readFile,writeFile} from 'node:fs/promises';
const dir=process.argv[2]||'.sites-runtime/qa';const prefix=process.argv[3]||'pages-qr-render';
const files=(await readdir(dir)).filter(f=>f.startsWith(prefix+'-')&&f.endsWith('.png')).sort();let decoded=[];
for(const file of files){const input=await readFile(dir+'/'+file);const meta=await sharp(input).metadata();const factor=meta.width/215.9;for(let row=0;row<10;row++)for(let col=0;col<3;col++){const left=Math.round((4.7625+col*(66.675+3.175))*factor),top=Math.round((12.7+row*25.4)*factor);const width=Math.min(Math.round(66.675*factor),meta.width-left),height=Math.min(Math.round(25.4*factor),meta.height-top);const {data,info}=await sharp(input).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const q=jsQR(new Uint8ClampedArray(data),info.width,info.height);if(q)decoded.push(q.data);}}
if(decoded.length!==100||new Set(decoded).size!==100||decoded.some(u=>{const url=new URL(u);return !/^[\w-]{32}$/.test(url.searchParams.get('code')||'')||!url.pathname.endsWith('/spray-net-review-portal/')||url.pathname.includes('/q/');}))throw Error(`Expected 100 unique Pages query-token links, decoded ${decoded.length}`);
await writeFile(dir+'/'+prefix+'-validation.json',JSON.stringify({decoded:decoded.length,unique:new Set(decoded).size,renderDPI:300,physicalPrinterTest:false,example:decoded[0]},null,2));console.log('Decoded all 100 distinct Pages query-token links from the PDF.');
