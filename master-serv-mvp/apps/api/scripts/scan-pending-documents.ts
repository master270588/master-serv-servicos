import { PrismaClient } from '@prisma/client';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Socket, createConnection } from 'node:net';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createStorageClient(): S3Client {
  return new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'auto',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
  });
}

async function writeChunk(socket: Socket, chunk: Buffer): Promise<void> {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(chunk.length, 0);
  if (!socket.write(header)) await new Promise<void>((resolve) => socket.once('drain', resolve));
  if (!socket.write(chunk)) await new Promise<void>((resolve) => socket.once('drain', resolve));
}

async function scanStreamWithClamAv(body: AsyncIterable<Uint8Array>): Promise<'clean' | 'infected'> {
  const socket = createConnection({
    host: required('CLAMAV_HOST'),
    port: Number(process.env.CLAMAV_PORT ?? 3310),
  });
  socket.setTimeout(120_000);

  const responsePromise = new Promise<string>((resolve, reject) => {
    let response = '';
    socket.once('error', reject);
    socket.once('timeout', () => reject(new Error('ClamAV scan timed out')));
    socket.on('data', (data: Buffer) => {
      response += data.toString('utf8');
      if (response.includes('\\0')) resolve(response);
    });
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  try {
    socket.write(Buffer.from('zINSTREAM\\0', 'ascii'));
    for await (const part of body) {
      const chunk = Buffer.from(part);
      if (chunk.length) await writeChunk(socket, chunk);
    }
    const end = Buffer.alloc(4);
    end.writeUInt32BE(0, 0);
    socket.write(end);

    const response = await responsePromise;
    if (response.includes('FOUND')) return 'infected';
    if (response.includes('OK')) return 'clean';
    throw new Error(`Unexpected ClamAV response: ${response.slice(0, 160)}`);
  } finally {
    socket.destroy();
  }
}

async function main(): Promise<void> {
  const bucket = required('S3_BUCKET');
  const batchSize = Math.min(Math.max(Number(process.env.SCAN_BATCH_SIZE ?? 10), 1), 50);
  const storage = createStorageClient();

  const pending = await prisma.providerDocument.findMany({
    where: { scanStatus: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: { id: true, providerUserId: true, storageKey: true },
  });

  for (const document of pending) {
    let result: 'clean' | 'infected' | 'error' = 'error';
    try {
      const object = await storage.send(new GetObjectCommand({
        Bucket: bucket,
        Key: document.storageKey,
      }));
      if (!object.Body) throw new Error('Storage returned an empty object body');
      result = await scanStreamWithClamAv(object.Body as AsyncIterable<Uint8Array>);
    } catch (error) {
      // Fail closed: scanner/storage errors never result in a clean status.
      process.stderr.write(`Document ${document.id} scan failed: ${error instanceof Error ? error.message : 'unknown error'}\\n`);
    }

    await prisma.$transaction(async (tx) => {
      const changed = await tx.providerDocument.updateMany({
        where: { id: document.id, scanStatus: 'pending' },
        data: { scanStatus: result },
      });
      if (changed.count !== 1) return;

      await tx.auditEvent.create({
        data: {
          action: `provider_document.scan_${result}`,
          entityType: 'provider_document',
          entityId: document.id,
          metadata: {
            providerUserId: document.providerUserId,
            scanner: 'clamav',
            scanStatus: result,
          },
        },
      });
    });
  }

  process.stdout.write(`Scanned ${pending.length} pending document(s).\\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Document scan worker failed: ${error instanceof Error ? error.message : 'unknown error'}\\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
