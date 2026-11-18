import { Injectable, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

@Injectable()
export class R2QuarantineStorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async storeInQuarantine(input: {
    providerUserId: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ storageKey: string; sizeBytes: number }> {
    const maxBytes = Number(this.config.get('DOCUMENT_UPLOAD_MAX_BYTES') ?? 10 * 1024 * 1024);
    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      throw new BadRequestException('Arquivo vazio ou inválido.');
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || input.buffer.length > maxBytes) {
      throw new BadRequestException('Arquivo excede o limite permitido.');
    }
    if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
      throw new BadRequestException('Tipo de arquivo não permitido.');
    }

    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) throw new ServiceUnavailableException('Armazenamento de documentos não configurado.');

    const storageKey = `quarantine/providers/${input.providerUserId}/${randomUUID()}`;
    try {
      await this.getClient().send(new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentLength: input.buffer.length,
        ContentType: input.contentType,
        CacheControl: 'private, no-store',
        Metadata: { providerid: input.providerUserId, scanstatus: 'pending' },
      }));
    } catch {
      throw new ServiceUnavailableException('Não foi possível armazenar o documento.');
    }

    return { storageKey, sizeBytes: input.buffer.length };
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION') ?? 'auto';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('Credenciais do armazenamento não configuradas.');
    }

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }
}
