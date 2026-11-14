import {test,expect,type Locator} from './test';
import {browserAdmin,fixture,site} from './helpers';
import {PDFDocument} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import jsQR from 'jsqr';

const token=(char:string)=>char.repeat(32);
const first={token:token('A'),label:'SN-001',batch_id:'qa-batch',job_id:'qa-assigned',assigned_at:'2026-11-13'};
const second={token:token('B'),label:'SN-002',batch_id:'qa-batch',job_id:null,assigned_at:null};
const third={...second,token:token('C'),label:'SN-003'};
const project=(id:string,qrs:unknown[],customerToken:string)=>({...fixture,id,internal_name:id,status:'active',photos:[],qrs,customer_token:customerToken,visits:0,clicks:0});
const assigned=project('qa-assigned',[first],token('D'));
const direct=project('qa-direct',[],token('E'));
async function decode(image:Locator){
 await expect(image).toBeVisible();
 const source=(await image.getAttribute('src'))!;
 const {data,info}=await sharp(Buffer.from(source.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 return jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data;
}

test('project QR scans to the actual sticker link or the direct customer link',async({page})=>{
 await mockAdmin(page);
 for(const [job,code] of [[assigned,first.token],[direct,direct.customer_token]] as const){
  await page.locator('.project-row').filter({has:page.getByRole('heading',{name:job.id,exact:true})}).getByRole('button',{name:'Open project'}).click();
  await page.getByRole('button',{name:'Show customer QR code'}).click();
  const dialog=page.getByRole('dialog',{name:'Customer review QR code'});
  const image=dialog.getByRole('img');
  expect(await decode(image)).toBe(site+'?code='+code);
  await expect.poll(async()=>(await image.boundingBox())?.width||0).toBeGreaterThan(200);
  const bounds=(await image.boundingBox())!;
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await dialog.getByRole('button',{name:'Done'}).click();
  await page.getByRole('button',{name:'All projects'}).click();
 }
});

test('batch preview selects and downloads exactly one sticker on the configured paper',async({page},testInfo)=>{
 await mockAdmin(page);
 await page.getByRole('tab',{name:'QR stickers'}).click();
 await page.getByRole('button',{name:'Preview QR codes',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'QR sticker preview'});
 await dialog.getByLabel('Choose a QR code').selectOption(third.token);
 expect(await decode(dialog.getByRole('img',{name:'Scannable QR code for TEST · SN-003'}))).toBe(site+'?code='+third.token);
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download single-sticker PDF'}).click();
 const file=await download;expect(file.suggestedFilename()).toBe('spray-net-TEST-SN-003.pdf');
 const path=testInfo.outputPath('single-sticker.pdf');await file.saveAs(path);
 const pdf=await PDFDocument.load(await readFile(path));expect(pdf.getPageCount()).toBe(1);const {width,height}=pdf.getPage(0).getSize();expect(width).toBeCloseTo(612);expect(height).toBeCloseTo(792);
});

async function mockAdmin(page:import('@playwright/test').Page){
 await browserAdmin(page,'qa-local-admin');
 await page.route('**/api/admin/session',r=>r.fulfill({json:{allowed:true}}));
 await page.route('**/api/admin/dashboard',r=>r.fulfill({json:{jobs:[assigned,direct],qrs:[first,second,third],settings:{origin:site,local:true}}}));
 await page.route('**/api/admin/jobs/*',r=>r.fulfill({json:r.request().url().endsWith(assigned.id)?assigned:direct}));
 await page.goto(site+'?admin=1');
}
