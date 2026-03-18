import { env } from './env.js';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function objectUrl(key: string): string {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${key}`;
}

export async function uploadBufferToStorage(params: {
  keyPrefix: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const key = `${params.keyPrefix}/${Date.now()}-${sanitizeFilename(params.fileName)}`;
  const uploadUrl = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${key}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': params.contentType,
      'x-upsert': 'false',
    },
    body: new Uint8Array(params.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${response.status} ${errorText}`);
  }

  return {
    key,
    url: objectUrl(key),
  };
}