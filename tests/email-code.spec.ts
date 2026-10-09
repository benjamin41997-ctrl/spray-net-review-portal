import {test,expect} from './test';
import AxeBuilder from '@axe-core/playwright';
import {site} from './helpers';

test.beforeEach(async({page})=>{
 // Mock the provider: these checks send no emails and use no real auth tokens.
 await page.route('**/portal-config.json',async route=>{
  const response=await route.fetch();const config=await response.json();
  await route.fulfill({json:{...config,supabaseURL:'https://portal-auth-qa.supabase.co',supabasePublishableKey:'sb_publishable_test',adminEmailCodes:true}});
 });
 await page.route('https://portal-auth-qa.supabase.co/auth/v1/**',route=>route.fulfill({json:{}}));
});

test('email code can be pasted, verified and persisted without opening an email link',async({page})=>{
 let sent=0;let verified:any;
 await page.route('**/auth/v1/otp**',route=>{
  const body=route.request().postDataJSON();expect(body.email).toBe('ben.hessler@spray-net.com');expect(body.create_user).toBe(false);sent++;
  return route.fulfill({json:{}});
 });
 await page.route('**/auth/v1/verify',route=>{
  verified=route.request().postDataJSON();
  return route.fulfill({json:{access_token:'qa-access-token',refresh_token:'qa-refresh-token',token_type:'bearer',expires_in:3600,user:{id:'qa-admin',aud:'authenticated',role:'authenticated',email:'ben.hessler@spray-net.com',email_confirmed_at:'2026-10-08T00:00:00Z'}}});
 });
 await page.route('**/api/admin/session',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/admin/dashboard',r=>r.fulfill({json:{jobs:[],qrs:[],settings:{local:false}}}));
 await page.goto(site+'?admin=1&assign=keep-this-sticker');
 await page.getByLabel('Administrator email',{exact:true}).fill('Ben.Hessler@Spray-Net.com');
 await page.getByRole('button',{name:'Email me a sign-in code',exact:true}).click();
 expect(sent).toBe(1);const field=page.getByLabel('Email sign-in code',{exact:true});
 await expect(field).toHaveAttribute('autocomplete','one-time-code');await expect(field).toHaveAttribute('inputmode','numeric');
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeDisabled();
 await page.reload();await expect(field).toBeVisible();expect(sent).toBe(1);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/email-code-${test.info().project.name}.png`,fullPage:true});
 await field.fill('12 34 56 78');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Assign a preprinted sticker',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(verified).toMatchObject({email:'ben.hessler@spray-net.com',token:'12345678',type:'email'});
 expect(page.url()).toContain('assign=keep-this-sticker');
 expect(await page.evaluate(()=>sessionStorage.getItem('spraynet-review-pending-signin'))).toBeNull();
 await page.reload();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(sent).toBe(1);
});

test('expired codes stay on code entry and resend has a cooldown',async({page})=>{
 let sent=0;await page.clock.install();
 await page.route('**/auth/v1/otp**',r=>{sent++;return r.fulfill({json:{}});});
 await page.route('**/auth/v1/verify',r=>r.fulfill({status:403,json:{error_code:'otp_expired',msg:'Token has expired or is invalid'}}));
 await page.goto(site+'?admin=1');await page.getByLabel('Administrator email',{exact:true}).fill('ben.hessler@spray-net.com');
 await page.getByRole('button',{name:'Email me a sign-in code',exact:true}).click();
 const resend=page.getByRole('button',{name:/Send another code/});await expect(resend).toBeDisabled();
 await page.getByLabel('Email sign-in code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('expired or isn’t valid');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeDisabled();
 await page.clock.fastForward(61000);await expect(resend).toBeEnabled();await resend.click();expect(sent).toBe(2);
 await expect(resend).toBeDisabled();await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'Use a different email',exact:true}).click();await expect(page.getByLabel('Administrator email',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('spraynet-review-pending-signin'))).toBeNull();
});

test('email delivery errors do not advance or automatically retry sending',async({page})=>{
 let sent=0;await page.route('**/auth/v1/otp**',r=>{sent++;return r.fulfill({status:429,json:{code:'over_email_send_rate_limit',msg:'Email rate limit exceeded. Please try later.'}});});
 await page.goto(site+'?admin=1');await page.getByLabel('Administrator email',{exact:true}).fill('ben.hessler@spray-net.com');
 await page.getByRole('button',{name:'Email me a sign-in code',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Email rate limit');await expect(page.getByLabel('Email sign-in code',{exact:true})).toHaveCount(0);
 await page.reload();expect(sent).toBe(1);
});

test('a valid email code still requires the Worker administrator allowlist',async({page})=>{
 await page.route('**/auth/v1/verify',r=>r.fulfill({json:{access_token:'qa-unapproved-token',refresh_token:'qa-refresh-token',token_type:'bearer',expires_in:3600,user:{id:'qa-other',email:'other@example.com'}}}));
 await page.route('**/api/admin/session',r=>r.fulfill({status:403,json:{error:'Administrator access required.'}}));
 await page.goto(site+'?admin=1');await page.getByLabel('Administrator email',{exact:true}).fill('other@example.com');
 await page.getByRole('button',{name:'Email me a sign-in code',exact:true}).click();await page.getByLabel('Email sign-in code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Administrator access unavailable',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'New project',exact:true})).toHaveCount(0);
});

test('production keeps working email links until code delivery is configured',async({page})=>{
 await page.route('**/portal-config.json',async route=>{const response=await route.fetch();const config=await response.json();await route.fulfill({json:{...config,supabaseURL:'https://portal-auth-qa.supabase.co',supabasePublishableKey:'sb_publishable_test',adminEmailCodes:false}});});
 await page.goto(site+'?admin=1');await page.getByLabel('Administrator email',{exact:true}).fill('ben.hessler@spray-net.com');
 await page.getByRole('button',{name:'Email me a sign-in link',exact:true}).click();await expect(page.getByRole('status')).toContainText('Check your email for a sign-in link');
 await expect(page.getByLabel('Email sign-in code',{exact:true})).toHaveCount(0);
});
