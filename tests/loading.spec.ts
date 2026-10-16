import {test,expect} from './test';
import {site} from './helpers';

for(const phase of ['configuration','project'] as const){
 test(`slow ${phase} loading offers retry and still recovers when the response arrives`,async({page})=>{
  await page.clock.install();
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  let received=false;
  const code='L'.repeat(32);
  if(phase==='configuration'){
   await page.route('**/portal-config.json',async route=>{received=true;await pending;await route.fulfill({json:{apiBaseURL:'http://127.0.0.1:8787',portalURL:site,supabaseURL:'',supabasePublishableKey:'',localPreview:true}});});
  }
  await page.route('**/api/customer/'+code,async route=>{
   if(phase==='project'){received=true;await pending;}
   await route.fulfill({json:{id:'loading-qa',title:'We loved working with you, Sam!',source:'direct',links:{},photos:[],settings:{cleanup:false,transcription:false}}});
  });
  try{
   await page.goto(site+'?code='+code);
   await expect.poll(()=>received).toBe(true);
   await expect(page.getByText('Loading your page…',{exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Try again',exact:true})).toHaveCount(0);
   await page.clock.fastForward(16000);
   await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
   await expect(page.getByText('This is taking longer than expected.',{exact:false})).toBeVisible();
   release();
   await expect(page.getByRole('heading',{name:'We loved working with you, Sam!',exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Try again',exact:true})).toHaveCount(0);
  }finally{release();}
 });
}

test('failed startup offers a reload rather than a permanent configuration dead end',async({page})=>{
 await page.route('**/portal-config.json',r=>r.fulfill({status:503,body:'Temporarily unavailable'}));
 await page.goto(site);
 await expect(page.getByRole('heading',{name:'The portal could not connect.',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
 await page.unroute('**/portal-config.json');
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your project. Your experience.',exact:true})).toBeVisible();
});
