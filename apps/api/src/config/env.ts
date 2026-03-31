import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(16).default(12),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  PARENT_INVITE_BASE_URL: z.string().url().default('http://localhost:3000/parent/invite'),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  WATI_API_BASE_URL: z.string().url().optional(),
  WATI_API_TOKEN: z.string().min(1).optional(),
  WATI_TEMPLATE_NAME: z.string().min(1).optional(),
  FEE_REMINDER_CRON: z.string().default('0 9 * * *'),
  FEE_REMINDER_DEFAULT_TEMPLATE: z
    .string()
    .default('Reminder: {{student_name}} has pending fee of INR {{amount}} due on {{due_date}}.'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
