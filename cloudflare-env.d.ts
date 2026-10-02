declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PUBLIC_ORIGIN?: string;
    ADMIN_EMAILS?: string;
    OPENAI_API_KEY?: string;
    ENABLE_AI_CLEANUP?: string;
  }
}
