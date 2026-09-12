import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it in .env.local (dev) or your Vercel project env vars (prod).');
}

export const sql = neon(process.env.DATABASE_URL);
