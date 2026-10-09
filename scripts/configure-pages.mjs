import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('public/portal-config.json','utf8'));
const mapping={REVIEW_API_BASE_URL:'apiBaseURL',REVIEW_PORTAL_URL:'portalURL',REVIEW_SUPABASE_URL:'supabaseURL',REVIEW_SUPABASE_PUBLISHABLE_KEY:'supabasePublishableKey'};
for(const [name,key] of Object.entries(mapping))if(process.env[name])config[key]=process.env[name];
config.localPreview=false;
for(const key of ['apiBaseURL','portalURL','supabaseURL']){if(!config[key])continue;const url=new URL(config[key]);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error(`${key} must be a public HTTPS URL without credentials, query, or fragment.`);}
if(config.supabasePublishableKey.startsWith('sb_secret_'))throw Error('Private Supabase keys must never be included in Pages.');
if(config.supabasePublishableKey.startsWith('eyJ')){let role;try{role=JSON.parse(Buffer.from(config.supabasePublishableKey.split('.')[1],'base64url').toString()).role;}catch{}if(role!=='anon')throw Error('Only Supabase publishable or legacy anon keys can be included in Pages.');}
if(process.argv.includes('--require-connected')&&['apiBaseURL','portalURL','supabaseURL','supabasePublishableKey'].some(key=>!config[key]))throw Error('Configure the backend URL, Pages URL, and public Supabase settings before publishing.');
if(process.argv.includes('--require-preview-api')){
 if(!config.apiBaseURL||!config.portalURL)throw Error('Configure the backend and Pages URL before publishing the AI preview.');
 if(config.supabaseURL||config.supabasePublishableKey)throw Error('Use connected mode once admin authentication settings are supplied.');
}
await writeFile('public/portal-config.json',JSON.stringify(config,null,2)+'\n');console.log('Public Pages configuration validated. No private credentials are written.');
