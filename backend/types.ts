export interface Env {
 DB?: D1Database;
 BUCKET?: R2Bucket;
 ENVIRONMENT?: string;
 LOCAL_ADMIN_TOKEN?: string;
 ADMIN_EMAILS?: string;
 PUBLIC_PORTAL_URL?: string;
 ALLOWED_ORIGINS?: string;
 SUPABASE_URL?: string;
 SUPABASE_PUBLISHABLE_KEY?: string;
 OPENAI_API_KEY?: string;
 TRANSCRIPTION_MODEL?: string;
 REVIEW_EDITOR_MODEL?: string;
 ENABLE_AI_CLEANUP?: string;
 PREVIEW_QR_TOKEN?: string;
}
