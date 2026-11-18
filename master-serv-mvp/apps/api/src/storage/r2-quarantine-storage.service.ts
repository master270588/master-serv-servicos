import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const FILE_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'application/pdf': (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/jpeg': (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
};

export function assertAllowedFileSignature(buffer: Buffer, contentType: string): void {
  const matches = FILE_SIGNATURES[contentType];
  if (!matches || !matches(buffer)) {
    throw new BadRequestException('O conteúdo do arquivo não corresponde a um tipo permitido.');
  }
}

@Injectable()
export class R2QuarantineStorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async storeInQuarantine(input: {
    providerUserId: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ storageKey: string; sizeBytes: number }> {
    const maxBytes = Number(
      this.config.get('DOCUMENT_UPLOAD_MAX_BYTES') ?? 10 * 1024 * 1024,
    );

    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      throw new BadRequestException('Arquivo vazio ou inválido.');
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || input.buffer.length > maxBytes) {
      throw new BadRequestException('Arquivo excede o limite permitido.');
    }

    // O MIME informado pelo cliente não é confiável: confira também a assinatura binária.
    assertAllowedFileSignature(input.buffer, input.contentType);

    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) {
      throw new ServiceUnavailableException('Armazenamento de documentos não configurado.');
    }

    const storageKey = `quarantine/providers/${input.providerUserId}/${randomUUID()}`;
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: input.buffer,
          ContentLength: input.buffer.length,
          ContentType: input.contentType,
          CacheControl: 'private, no-store',
          Metadata: {
            providerid: input.providerUserId,
            scanstatus: 'pending',
          },
        }),
      );
    } catch {
      throw new ServiceUnavailableException('Não foi possível armazenar o documento.');
    }

    return { storageKey, sizeBytes: input.buffer.length };
  }


  async deleteFromQuarantine(storageKey: string): Promise<void> {
    if (!storageKey.startsWith('quarantine/providers/')) {
      throw new BadRequestException('Chave de armazenamento inválida.');
    }
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) {
      throw new ServiceUnavailableException('Armazenamento de documentos não configurado.');
    }
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    } catch {
      throw new ServiceUnavailableException('Não foi possível remover o arquivo da quarentena.');
    }
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
