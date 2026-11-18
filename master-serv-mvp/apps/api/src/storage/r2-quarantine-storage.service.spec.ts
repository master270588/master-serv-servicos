import { BadRequestException } from '@nestjs/common';
import { assertAllowedFileSignature, R2QuarantineStorageService } from './r2-quarantine-storage.service';

describe('R2QuarantineStorageService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'DOCUMENT_UPLOAD_MAX_BYTES') return '10';
      return undefined;
    }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('accepts PDF content with a matching signature', () => {
    expect(() => assertAllowedFileSignature(Buffer.from('%PDF-1.7'), 'application/pdf')).not.toThrow();
  });

  it('accepts JPEG content with a matching signature', () => {
    expect(() => assertAllowedFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).not.toThrow();
  });

  it('accepts PNG content with a matching signature', () => {
    expect(() => assertAllowedFileSignature(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    )).not.toThrow();
  });

  it('rejects a spoofed MIME type before contacting storage', async () => {
    const storage = new R2QuarantineStorageService(config as any);
    await expect(storage.storeInQuarantine({
      providerUserId: 'provider-id',
      buffer: Buffer.from('not a real pdf'),
      contentType: 'application/pdf',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a file larger than the configured limit', async () => {
    const storage = new R2QuarantineStorageService(config as any);
    await expect(storage.storeInQuarantine({
      providerUserId: 'provider-id',
      buffer: Buffer.from('%PDF-123456'),
      contentType: 'application/pdf',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
