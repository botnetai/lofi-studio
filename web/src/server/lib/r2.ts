import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

let s3Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (s3Client) return s3Client;
  const endpoint = requireEnv('R2_S3_ENDPOINT');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return s3Client;
}

export async function putObjectToR2(params: {
  key: string;
  body: AsyncIterable<Uint8Array> | Buffer | Uint8Array | Blob | string;
  contentType?: string;
}): Promise<{ key: string }> {
  const bucket = requireEnv('R2_BUCKET');
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body as any,
    ContentType: params.contentType,
  });
  await client.send(command);
  return { key: params.key };
}

export async function deleteObjectFromR2(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const bucket = requireEnv('R2_BUCKET');
    const client = getR2Client();
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await client.send(command);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export function publicR2Url(key: string): string {
  const endpoint = requireEnv('R2_S3_ENDPOINT').replace(/\/$/, '');
  const bucket = requireEnv('R2_BUCKET');
  return `${endpoint}/${bucket}/${key}`;
}


