import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

import type { AppConfig } from '../src/config/env.validation';
import { QdrantVectorStore } from '../src/modules/ai/vector/qdrant-vector.store';

jest.mock('@qdrant/js-client-rest', () => {
  const client = {
    collectionExists: jest.fn(),
    getCollection: jest.fn(),
    createCollection: jest.fn(),
    createPayloadIndex: jest.fn(),
    deletePayloadIndex: jest.fn(),
  };
  const QdrantClient = jest.fn(() => client);
  return { QdrantClient };
});

const mockedClient = QdrantClient as unknown as jest.Mock & {
  mock: { results: Array<{ value: QdrantDouble }> };
};

interface QdrantDouble {
  collectionExists: jest.Mock;
  getCollection: jest.Mock;
  createCollection: jest.Mock;
  createPayloadIndex: jest.Mock;
  deletePayloadIndex: jest.Mock;
}

const collectionInfo = {
  config: { params: { vectors: { size: 1536, distance: 'Cosine' } } },
};

const config = {
  get: () => ({
    qdrantCollection: 'legal_chunks_v1',
    embeddingDimensions: 1536,
    vectorStoreMode: 'qdrant',
    qdrantUrl: 'https://cluster.eu-central.aws.cloud.qdrant.io:443',
    qdrantApiKey: 'cloud-key',
  }),
} as unknown as ConfigService<AppConfig, true>;

describe('QdrantVectorStore collection bootstrap', () => {
  const clientOf = (): QdrantDouble => {
    const created = mockedClient.mock.results.at(-1)?.value;
    if (!created) {
      throw new Error('QdrantClient was not constructed');
    }
    return created;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens Qdrant Cloud on the https port from the URL', () => {
    new QdrantVectorStore(config);
    expect(QdrantClient).toHaveBeenCalledWith({
      url: 'https://cluster.eu-central.aws.cloud.qdrant.io:443',
      port: 443,
      apiKey: 'cloud-key',
      checkCompatibility: false,
    });
  });

  it('creates legal_chunks_v1 and payload indexes on an empty cluster', async () => {
    const store = new QdrantVectorStore(config);
    const client = clientOf();
    client.collectionExists.mockResolvedValue({ exists: false });
    client.createCollection.mockResolvedValue(true);
    client.getCollection.mockResolvedValue(collectionInfo);
    client.createPayloadIndex.mockResolvedValue({ status: 'completed' });

    await store.ensureCollection();

    expect(client.createCollection).toHaveBeenCalledWith('legal_chunks_v1', {
      timeout: 60,
      vectors: { size: 1536, distance: 'Cosine' },
    });
    const fields = client.createPayloadIndex.mock.calls.map(
      (call: unknown[]) => (call[1] as { field_name: string }).field_name,
    );
    expect(fields).toEqual([
      'userId',
      'trust',
      'embeddingModel',
      'documentId',
      'pipelineVersion',
    ]);
    expect(client.createPayloadIndex).toHaveBeenCalledWith(
      'legal_chunks_v1',
      expect.objectContaining({
        field_name: 'pipelineVersion',
        field_schema: 'integer',
        wait: true,
      }),
    );
  });

  it('is idempotent when the collection and indexes already exist', async () => {
    const store = new QdrantVectorStore(config);
    const client = clientOf();
    client.collectionExists.mockResolvedValue({ exists: true });
    client.getCollection.mockResolvedValue(collectionInfo);
    client.createPayloadIndex.mockRejectedValue(
      new Error(
        'Unexpected Response: 400 (Bad Request)\nRaw response content:\n{"status":{"error":"Wrong input: Payload index with name userId already exists"}}',
      ),
    );

    await store.ensureCollection();
    await store.ensureCollection();

    expect(client.createCollection).not.toHaveBeenCalled();
    expect(client.deletePayloadIndex).not.toHaveBeenCalled();
    expect(client.createPayloadIndex).toHaveBeenCalled();
  });

  it('continues when a parallel boot already created the collection', async () => {
    const store = new QdrantVectorStore(config);
    const client = clientOf();
    client.collectionExists.mockResolvedValue({ exists: false });
    client.createCollection.mockRejectedValue(
      new Error('Collection `legal_chunks_v1` already exists'),
    );
    client.getCollection.mockResolvedValue(collectionInfo);
    client.createPayloadIndex.mockResolvedValue({ status: 'completed' });

    await expect(store.ensureCollection()).resolves.toBeUndefined();
    expect(client.createPayloadIndex).toHaveBeenCalled();
  });
});
