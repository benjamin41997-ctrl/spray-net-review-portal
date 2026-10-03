import {test,expect} from './test';
const site='http://127.0.0.1:4173/spray-net-review-portal/';

test('unconnected Pages preview supports drafts and real photo downloads without backend or Google requests',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).copiedPreviewReview=text;}}});});
 await page.goto(site);
 await expect(page.getByText('Online preview · sample project',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Type my review',exact:true}).click();
 const text='The cabinets look good. This is only a device test.';
 await page.getByLabel('Your review',{exact:true}).fill(text);
 await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 const downloads:any[]=[];page.on('download',file=>downloads.push(file));
 await expect(page.locator('.photo-card img')).toHaveCount(2);
 await page.getByRole('button',{name:'Share all photos',exact:true}).click();
 await expect.poll(()=>downloads.length).toBe(2);expect(downloads.map(d=>d.suggestedFilename())).toEqual(['Spray-Net-before-01.jpg','Spray-Net-after-02.jpg']);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByText('Import the 2 transformation photos you already downloaded.')).toBeVisible();
 await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();
 await expect(page.getByText('Preview: your review was copied. Google was not opened. Please do not post sample feedback.')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).copiedPreviewReview)).toBe(text);expect(page.url()).toBe(site);
 await page.getByText('Open Google without copying',{exact:true}).click();
 await page.getByRole('button',{name:'Continue to Google',exact:true}).click();
 await expect(page.getByText('Google is disabled in this preview. Please do not post sample feedback.')).toBeVisible();
 expect(requests.every(url=>url.startsWith('http://127.0.0.1:4173/')||url.startsWith('blob:'))).toBe(true);
 expect(requests.some(url=>url.includes('/api/'))).toBe(false);
});

test('public preview cannot authorize admin or replace an unconfigured customer QR page',async({page})=>{
 await page.goto(site+'?admin=1&demo=1');
 await expect(page.getByRole('heading',{name:'Prepare their project card.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Enter local admin preview'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Email me a sign-in link'})).toBeDisabled();
 await page.goto(site+'?code='+'A'.repeat(32)+'&demo=1');
 await expect(page.getByRole('heading',{name:'The secure backend has not been configured.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Type my review',exact:true})).toHaveCount(0);
});
