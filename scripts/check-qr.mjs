import sharp from 'sharp';
import jsQR from 'jsqr';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url); // sharp is supplied by the starter's local dependencies.
const files=(await readdir('.sites-runtime/qa')).filter(f=>/^qr-render-\d+\.png$/.test(f)).sort();let decoded=[];
for(const file of files){const input=await readFile('.sites-runtime/qa/'+file);const meta=await sharp(input).metadata();const factor=meta.width/215.9;for(let row=0;row<10;row++)for(let col=0;col<3;col++){const left=Math.round((4.7625+col*(66.675+3.175))*factor),top=Math.round((12.7+row*25.4)*factor);const width=Math.min(Math.round(66.675*factor),meta.width-left),height=Math.min(Math.round(25.4*factor),meta.height-top);const {data,info}=await sharp(input).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const q=jsQR(new Uint8ClampedArray(data),info.width,info.height);if(q)decoded.push(q.data);}}
if(decoded.length!==100||new Set(decoded).size!==100||decoded.some(u=>!/^http:\/\/127\.0\.0\.1:5173\/q\/[\w-]{32}$/.test(u)))throw Error(`Expected 100 unique test links, decoded ${decoded.length}`);
await writeFile('.sites-runtime/qa/qr-validation.json',JSON.stringify({decoded:decoded.length,unique:new Set(decoded).size,renderDPI:300,physicalPrinterTest:false},null,2));console.log('Decoded all 100 distinct QR links from the rendered PDF.');
