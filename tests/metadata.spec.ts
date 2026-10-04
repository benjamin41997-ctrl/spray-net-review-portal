import {test,expect} from './test';
import sharp from 'sharp';
import {login,browserAdmin,site,apiBase,fixture,patch} from './helpers';

test('admin upload removes source EXIF from the stored and customer-downloadable JPEG',async({page,request})=>{
 const {admin,token}=await login();
 const source=await sharp({create:{width:2400,height:1600,channels:3,background:'#347fb4'}}).jpeg().withExif({
  IFD0:{Make:'Synthetic test camera',Model:'Portal metadata QA',Artist:'Synthetic private author'},
  IFD2:{DateTimeOriginal:'2026:01:02 03:04:05'},
  IFD3:{GPSLatitudeRef:'N',GPSLatitude:'35/1 0/1 0/1',GPSLongitudeRef:'W',GPSLongitude:'80/1 0/1 0/1'}
 }).toBuffer();
 const original=await sharp(source).metadata();expect(original.exif).toBeTruthy();expect(original.exif!.includes(Buffer.from('Synthetic test camera'))).toBe(true);
 const j=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Metadata removal QA'}})).json();
 try{
  await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.getByLabel('Find a project').fill('Metadata removal QA');await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'metadata-input.jpg',mimeType:'image/jpeg',buffer:source});await expect(page.getByText('Photo uploaded.',{exact:true})).toBeVisible();
  const job=await(await admin.get('/api/admin/jobs/'+j.id)).json();expect(job.photos).toHaveLength(1);const id=job.photos[0].id;
  const stored=await admin.get('/api/admin/photos/'+id);expect(stored.status()).toBe(200);const bytes=await stored.body();const metadata=await sharp(bytes).metadata();
  expect(metadata.format).toBe('jpeg');expect(metadata.width).toBe(2048);expect(metadata.height).toBe(1365);expect(metadata.exif).toBeUndefined();expect(metadata.xmp).toBeUndefined();expect(metadata.iptc).toBeUndefined();expect(bytes.includes(Buffer.from('Synthetic private author'))).toBe(false);
  await admin.post('/api/admin/batch',{data:{count:1}});const d=await(await admin.get('/api/admin/dashboard')).json();const code=d.qrs.find((q:any)=>!q.assigned_at).token;await admin.post('/api/admin/assign',{data:{token:code,job_id:j.id}});await patch(admin,job,'active');
  expect((await request.get(apiBase+'/api/admin/photos/'+id)).status()).toBe(403);
  const download=await request.get(apiBase+'/api/customer/'+code+'/photo/'+id+'?download=1');expect(download.status()).toBe(200);expect(await download.body()).toEqual(bytes);expect(download.headers()['content-disposition']).toContain('attachment');
  const active=await(await admin.get('/api/admin/jobs/'+j.id)).json();await patch(admin,active,'archived');expect((await request.get(apiBase+'/api/customer/'+code+'/photo/'+id+'?download=1')).status()).toBe(404);
 }finally{await admin.delete('/api/admin/jobs/'+j.id);await admin.dispose();}
});
