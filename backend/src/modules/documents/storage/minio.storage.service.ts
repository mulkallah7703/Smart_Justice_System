import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { AppConfig, S3Config } from '../../../config/env.validation';
import { documentStorageError } from '../errors/documents.errors';
import type { ObjectStorage, StoredObject } from './object-storage.interface';

@Injectable()
export class MinioStorageService
  implements ObjectStorage, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MinioStorageService.name);
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const s3 = this.configService.get('s3', { infer: true });
    const nodeEnv = this.configService.get('nodeEnv', { infer: true });
    if (!s3) {
      return;
    }

    this.bucket = s3.bucket;
    this.client = this.createClient(s3);

    if (nodeEnv === 'development' || nodeEnv === 'test') {
      await this.ensureBucket();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.destroy();
    this.client = null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        }),
      );
    } catch {
      throw documentStorageError();
    }
  }

  async getObject(key: string): Promise<StoredObject> {
    const { client, bucket } = this.requireClient();
    try {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      const bytes = result.Body ? await result.Body.transformToByteArray() : new Uint8Array();
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    } catch {
      throw documentStorageError();
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch {
      throw documentStorageError();
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client || !this.bucket) {
      return false;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  private createClient(s3: S3Config): S3Client {
    return new S3Client({
      region: s3.region,
      endpoint: s3.endpoint,
      forcePathStyle: s3.forcePathStyle,
      credentials: {
        accessKeyId: s3.accessKey,
        secretAccessKey: s3.secret,
      },
    });
  }

  private async ensureBucket(): Promise<void> {
    const { client, bucket } = this.requireClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch {
      // Bucket missing in local development/test — create it. Production must provision explicitly.
    }

    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log('Created local object-storage bucket');
    } catch {
      this.logger.error('Failed to initialize local object-storage bucket');
    }
  }

  private requireClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw documentStorageError();
    }
    return { client: this.client, bucket: this.bucket };
  }
}
