import { createServer, type Server } from 'node:http';
import { once } from 'node:events';

import { sign } from 'jsonwebtoken';
import { WebSocket } from 'ws';

import { AlertsGateway } from '../src/modules/alerts/alerts.gateway';

const SECRET = 'unit-test-jwt-access-secret-32chars';

const listen = async (server: Server): Promise<number> => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('test server has no port');
  }
  return address.port;
};

describe('AlertsGateway', () => {
  it('logs socket=absent when nobody is connected', () => {
    const gateway = new AlertsGateway();
    const log = jest.spyOn(
      (gateway as unknown as { logger: { log: (message: string) => void } }).logger,
      'log',
    );
    gateway.notify('user-1', 'alert-1', 'case-1');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('socket=absent'));
  });

  it('pushes alertId and caseId to an authenticated socket', async () => {
    const gateway = new AlertsGateway();
    const server = createServer((_request, response) => {
      response.statusCode = 404;
      response.end();
    });
    gateway.bind(server, SECRET);
    const port = await listen(server);
    const token = sign({ sub: 'user-1', role: 'CITIZEN' }, SECRET, {
      algorithm: 'HS256',
    });
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/v1/alerts/ws?access_token=${encodeURIComponent(token)}`,
    );
    await once(socket, 'open');
    const received = once(socket, 'message');
    gateway.notify('user-1', 'alert-9', 'case-9');
    const [data] = await received;
    expect(JSON.parse(String(data))).toEqual({
      alertId: 'alert-9',
      caseId: 'case-9',
    });
    socket.close();
    await gateway.onModuleDestroy();
    server.close();
    await once(server, 'close');
  });

  it('accepts a browser origin that is on the allow list', async () => {
    const gateway = new AlertsGateway();
    const server = createServer();
    gateway.bind(server, SECRET, ['https://app.vercel.app']);
    const port = await listen(server);
    const token = sign({ sub: 'user-1', role: 'CITIZEN' }, SECRET, {
      algorithm: 'HS256',
    });
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/v1/alerts/ws?access_token=${encodeURIComponent(token)}`,
      { headers: { Origin: 'https://app.vercel.app' } },
    );
    await once(socket, 'open');
    socket.close();
    await gateway.onModuleDestroy();
    server.close();
    await once(server, 'close');
  });

  it('rejects a browser origin that is not allowed', async () => {
    const gateway = new AlertsGateway();
    const server = createServer();
    gateway.bind(server, SECRET, ['https://app.vercel.app']);
    const port = await listen(server);
    const token = sign({ sub: 'user-1', role: 'CITIZEN' }, SECRET, {
      algorithm: 'HS256',
    });
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/api/v1/alerts/ws?access_token=${encodeURIComponent(token)}`,
      { headers: { Origin: 'https://evil.example' } },
    );
    const [error] = (await once(socket, 'error')) as [Error];
    expect(error.message).toContain('403');
    await gateway.onModuleDestroy();
    server.close();
  });

  it('rejects a socket without a valid access token', async () => {
    const gateway = new AlertsGateway();
    const server = createServer();
    gateway.bind(server, SECRET);
    const port = await listen(server);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/alerts/ws`);
    const [error] = (await once(socket, 'error')) as [Error];
    expect(error.message).toContain('401');
    await gateway.onModuleDestroy();
    server.close();
  });
});
