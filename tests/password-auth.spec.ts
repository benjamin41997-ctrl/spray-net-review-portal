import {test,expect,type Page} from './test';
import AxeBuilder from '@axe-core/playwright';
import {site} from './helpers';

const email='ben.hessler@spray-net.com';
const qaPassword='Test-only-password-42!';
const user={id:'qa-admin',aud:'authenticated',role:'authenticated',email,email_confirmed_at:'2026-10-08T00:00:00Z'};
function session(){const exp=Math.floor(Date.now()/1000)+3600;const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({exp,sub:user.id,aud:'authenticated'})).toString('base64url')+'.qa-signature';return {access_token:token,refresh_token:'qa-refresh-token',token_type:'bearer',expires_in:3600,expires_at:exp,user};}
test.beforeEach(async({page})=>{
 // Provider stubs: no actual passwords/accounts are changed or emails sent.
 await page.route('**/portal-config.json',async route=>{const response=await route.fetch();const config=await response.json();await route.fulfill({json:{...config,portalURL:site,supabaseURL:'https://portal-auth-qa.supabase.co',supabasePublishableKey:'sb_publishable_test'}});});
 await page.route('https://portal-auth-qa.supabase.co/auth/v1/**',route=>route.fulfill({json:user}));
 await page.route('**/api/admin/session',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/admin/dashboard',r=>r.fulfill({json:{jobs:[],qrs:[],settings:{local:false}}}));
});
async function signedIn(page:Page){await page.addInitScript(value=>localStorage.setItem('spraynet-review-admin',JSON.stringify(value)),session());}
function recoveryURL(){const s=session();return site+'?admin=1#'+new URLSearchParams({access_token:s.access_token,refresh_token:s.refresh_token,token_type:s.token_type,expires_in:'3600',type:'recovery'});}

test('password login preserves session and sticker context without sending emails or storing the password',async({page})=>{
 let signed=0;let emails=0;
 await page.route('**/auth/v1/otp**',r=>{emails++;return r.fulfill({json:{}});});
 await page.route('**/auth/v1/token?grant_type=password',r=>{signed++;expect(r.request().postDataJSON()).toMatchObject({email,password:qaPassword});return r.fulfill({json:session()});});
 await page.goto(site+'?admin=1&assign=qa-sticker');
 await page.getByLabel('Administrator email',{exact:true}).fill('Ben.Hessler@Spray-Net.com');await page.getByLabel('Password',{exact:true}).fill(qaPassword);
 await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('autocomplete','current-password');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:`.sites-runtime/qa/password-login-${test.info().project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('dialog',{name:'Assign a preprinted sticker',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(signed).toBe(1);expect(emails).toBe(0);
 expect(page.url()).toContain('assign=qa-sticker');expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(qaPassword);
 await page.reload();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(signed).toBe(1);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test('incorrect credentials do not admit an administrator and can be corrected',async({page})=>{
 let denied=true;await page.route('**/auth/v1/token?grant_type=password',r=>denied?r.fulfill({status:400,json:{error_code:'invalid_credentials',msg:'Invalid login credentials'}}):r.fulfill({json:session()}));
 await page.goto(site+'?admin=1');await page.getByLabel('Administrator email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(qaPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');await expect(page.getByRole('button',{name:'New project',exact:true})).toHaveCount(0);
 denied=false;await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
});

test('password setup email uses the existing allowed callback and a resend cooldown',async({page})=>{
 let sent=0;await page.clock.install();await page.route('**/auth/v1/recover**',r=>{sent++;expect(new URL(r.request().url()).searchParams.get('redirect_to')).toBe(site+'?admin=1');expect(r.request().postDataJSON().email).toBe(email);return r.fulfill({json:{}});});
 await page.goto(site+'?admin=1');await page.getByRole('button',{name:'Set up or reset my password',exact:true}).click();
 await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);await page.getByLabel('Administrator email',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Email me a password setup link',exact:true}).click();await expect(page.getByRole('status')).toContainText('If this email has an administrator account');
 const resend=page.getByRole('button',{name:/Send another link|Email me a password setup link/});await expect(resend).toBeDisabled();await page.clock.fastForward(61000);await expect(resend).toBeEnabled();await resend.click();expect(sent).toBe(2);
 await page.getByRole('button',{name:'Back to sign in',exact:true}).click();await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
});

test('recovery callback goes directly to password setup, survives refresh, and saves through Supabase',async({page})=>{
 let changes=0;await page.route('**/auth/v1/user',r=>{if(r.request().method()==='PUT'){changes++;expect(r.request().postDataJSON().password).toBe(qaPassword);}return r.fulfill({json:user});});
 await page.goto(recoveryURL());await expect(page.getByRole('heading',{name:'Set your admin password.',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Set your admin password.',exact:true})).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.getByLabel('New password',{exact:true}).fill(qaPassword);await page.getByLabel('Confirm password',{exact:true}).fill(qaPassword+'different');
 await page.getByRole('button',{name:'Save password and open admin',exact:true}).click();await expect(page.getByRole('alert')).toContainText('don’t match');expect(changes).toBe(0);
 await page.getByLabel('Confirm password',{exact:true}).fill(qaPassword);await page.getByRole('button',{name:'Show passwords',exact:true}).click();await expect(page.getByLabel('New password',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Hide passwords',exact:true}).click();await page.getByRole('button',{name:'Save password and open admin',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(changes).toBe(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('spraynet-review-password-recovery'))).toBeNull();expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(qaPassword);
});

test('password update failures retain the form and retry, without claiming success',async({page})=>{
 await signedIn(page);let fail=true;
 await page.route('**/auth/v1/user',r=>r.request().method()==='PUT'&&fail?r.fulfill({status:422,json:{error_code:'weak_password',msg:'Password does not meet requirements'}}):r.fulfill({json:user}));
 await page.goto(site+'?admin=1&password=1');await page.getByLabel('New password',{exact:true}).fill(qaPassword);await page.getByLabel('Confirm password',{exact:true}).fill(qaPassword);await page.getByRole('button',{name:'Save password and open admin',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('does not meet requirements');await expect(page.getByRole('heading',{name:'Set your admin password.',exact:true})).toBeVisible();
 fail=false;await page.getByRole('button',{name:'Save password and open admin',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
});

test('unsigned setup URLs and denied administrator identities cannot access password setup',async({page})=>{
 await page.goto(site+'?admin=1&password=1');await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
 await page.route('**/api/admin/session',r=>r.fulfill({status:403,json:{error:'Administrator access required.'}}));
 await page.goto(recoveryURL());await expect(page.getByRole('heading',{name:'Administrator access unavailable',exact:true})).toBeVisible();await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
});

test('expired email links show a useful retry message and never request another email automatically',async({page})=>{
 let sent=0;await page.route('**/auth/v1/recover**',r=>{sent++;return r.fulfill({json:{}});});
 await page.goto(site+'?admin=1#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid');
 await expect(page.getByRole('alert')).toContainText('expired or was already used');expect(sent).toBe(0);
 await page.getByRole('button',{name:'Set up or reset my password',exact:true}).click();await page.getByLabel('Administrator email',{exact:true}).fill(email);await page.getByRole('button',{name:'Email me a password setup link',exact:true}).click();expect(sent).toBe(1);
});
