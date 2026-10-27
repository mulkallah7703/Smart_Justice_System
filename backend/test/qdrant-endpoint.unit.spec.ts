import {
  parseQdrantUrl,
  qdrantClientOptions,
  qdrantReadyRequest,
} from '../src/modules/ai/vector/qdrant-endpoint';

describe('parseQdrantUrl', () => {
  it('keeps an explicit https port of 443', () => {
    const endpoint = parseQdrantUrl(
      'https://cluster.eu-central.aws.cloud.qdrant.io:443',
    );
    expect(endpoint.port).toBe(443);
    expect(endpoint.restBase).toBe(
      'https://cluster.eu-central.aws.cloud.qdrant.io:443',
    );
  });

  it('defaults a bare https URL to port 443', () => {
    const endpoint = parseQdrantUrl(
      'https://cluster.eu-central.aws.cloud.qdrant.io/',
    );
    expect(endpoint.port).toBe(443);
    expect(endpoint.url).toBe(
      'https://cluster.eu-central.aws.cloud.qdrant.io',
    );
  });

  it('keeps the local http port', () => {
    expect(parseQdrantUrl('http://127.0.0.1:6333').port).toBe(6333);
    expect(parseQdrantUrl('http://127.0.0.1').port).toBe(6333);
  });

  it('builds client options and a keyed readiness request', () => {
    expect(
      qdrantClientOptions(
        'https://cluster.eu-central.aws.cloud.qdrant.io:443',
        '  cloud-key  ',
      ),
    ).toEqual({
      url: 'https://cluster.eu-central.aws.cloud.qdrant.io:443',
      port: 443,
      apiKey: 'cloud-key',
      checkCompatibility: false,
    });
    expect(
      qdrantReadyRequest(
        'https://cluster.eu-central.aws.cloud.qdrant.io:443',
        'cloud-key',
      ),
    ).toEqual({
      url: 'https://cluster.eu-central.aws.cloud.qdrant.io:443/readyz',
      headers: { 'api-key': 'cloud-key' },
    });
  });
});
