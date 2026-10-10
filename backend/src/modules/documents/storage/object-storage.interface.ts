export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface StoredObject {
  body: Buffer;
  contentType?: string;
  contentLength?: number;
}

export interface ObjectStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  /** Returns false when storage is not configured or unreachable. */
  ping(): Promise<boolean>;
}
