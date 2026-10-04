import {test,expect} from './test';
const site='http://127.0.0.1:4173/spray-net-review-portal/';

test('unconnected Pages preview supports drafts and real photo downloads without backend or Google requests',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).copiedPreviewReview=text;}}});});
 await page.goto(site);
 await expect(page.getByText('Online preview · sample project',{exact:true})).toHaveCount(0);
 await expect(page.getByText('AI formatting isn’t connected yet. You can type and try the photo flow; your wording will stay unchanged.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Type my review',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Automatically format my review'})).toHaveCount(0);
 const text='The cabinets look good. This is only a device test.';
 await page.getByLabel('Your review',{exact:true}).fill(text);
 await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();
 await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(text);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 const downloads:any[]=[];page.on('download',file=>downloads.push(file));
 await expect(page.locator('.photo-card img')).toHaveCount(2);
 await page.getByRole('button',{name:'Save and share all photos',exact:true}).click();
 await expect.poll(()=>downloads.length).toBe(2);expect(downloads.map(d=>d.suggestedFilename())).toEqual(['Spray-Net-before-01.jpg','Spray-Net-after-02.jpg']);
 await expect(page.getByRole('heading',{name:'Ready to share',exact:true})).toBeVisible();
 await expect(page.getByText('Import the 2 transformation photos you already downloaded.')).toBeVisible();
 await page.getByRole('button',{name:'Paste my review to Google',exact:true}).click();
 await expect(page.getByText('Review copied. This sample preview stops here; Google will open from a real customer page. Please don’t post sample feedback.')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).copiedPreviewReview)).toBe(text);expect(page.url()).toBe(site);
 await expect(page.getByText('Open Google without copying',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Already submitted your review?',{exact:true})).toHaveCount(0);
 expect(requests.every(url=>url.startsWith('http://127.0.0.1:4173/')||url.startsWith('blob:'))).toBe(true);
 expect(requests.some(url=>url.includes('/api/'))).toBe(false);
});

test('connecting the preview preserves its draft and Next uses the real editor path',async({page})=>{
 const token='B'.repeat(32),original='cabinets look great guys friendly but arrived late',edited='The cabinets look great after our project with Spray-Net South Charlotte. The crew was friendly, but arrived late.';
 await page.goto(site);await page.getByRole('button',{name:'Type my review',exact:true}).click();await page.getByLabel('Your review',{exact:true}).fill(original);
 await page.route('**/portal-config.json',route=>route.fulfill({json:{apiBaseURL:'https://api.example.test',portalURL:'https://benjamin41997-ctrl.github.io/spray-net-review-portal/',supabaseURL:'',supabasePublishableKey:'',localPreview:false}}));
 const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:4173'};
 await page.route('https://api.example.test/api/preview',route=>route.fulfill({headers,json:{token,settings:{transcription:true,cleanup:true}}}));
 let calls=0;await page.route('https://api.example.test/api/customer/'+token+'/cleanup',route=>{calls++;expect(route.request().postDataJSON()).toEqual({text:original});return route.fulfill({headers,json:{text:edited}});});
 await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
 await expect(page.getByRole('checkbox',{name:'Automatically format my review'})).toBeChecked();
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Check your review',exact:true})).toBeVisible();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(edited);expect(calls).toBe(1);
 await page.reload();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(edited);
 await page.getByRole('button',{name:'Use my original wording',exact:true}).click();await expect(page.getByLabel('Your review',{exact:true})).toHaveValue(original);
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
