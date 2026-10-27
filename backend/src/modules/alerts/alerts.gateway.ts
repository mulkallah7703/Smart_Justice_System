import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { verify } from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';

import { originAllowed } from '../../config/env.validation';

export interface AlertPush {
  alertId: string;
  caseId: string | null;
}

interface JwtAccessClaims {
  sub?: string;
}

/**
 * Realtime alert push on the API HTTP server.
 * Path: `/api/v1/alerts/ws?access_token=`. The worker never calls `bind`,
 * so analysis jobs only persist alerts.
 */
@Injectable()
export class AlertsGateway implements OnModuleDestroy {
  private readonly logger = new Logger(AlertsGateway.name);
  private readonly sockets = new Map<string, Set<WebSocket>>();
  private server: WebSocketServer | null = null;
  private upgradeHandler:
    | ((request: IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;

  bind(
    httpServer: {
      on: (
        event: 'upgrade',
        listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
      ) => void;
    },
    accessSecret: string,
    allowedOrigins?: readonly string[],
  ): void {
    if (this.server) {
      return;
    }
    this.server = new WebSocketServer({ noServer: true });
    this.upgradeHandler = (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/api/v1/alerts/ws') {
        return;
      }
      const originHeader = request.headers.origin;
      const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (
        origin &&
        allowedOrigins &&
        !originAllowed(origin, allowedOrigins)
      ) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const token = url.searchParams.get('access_token') ?? '';
      const userId = this.readUserId(token, accessSecret);
      if (!userId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      this.server?.handleUpgrade(request, socket, head, (client) => {
        this.track(userId, client);
      });
    };
    httpServer.on('upgrade', this.upgradeHandler);
  }

  notify(userId: string, alertId: string, caseId?: string | null): void {
    const clients = this.sockets.get(userId);
    const open = [...(clients ?? [])].filter(
      (client) => client.readyState === WebSocket.OPEN,
    );
    if (open.length === 0) {
      this.logger.log(
        `alert.notify userId=${userId} alertId=${alertId} socket=absent`,
      );
      return;
    }
    const payload = JSON.stringify({
      alertId,
      caseId: caseId ?? null,
    } satisfies AlertPush);
    for (const client of open) {
      client.send(payload);
    }
  }

  onModuleDestroy(): void {
    for (const clients of this.sockets.values()) {
      for (const client of clients) {
        client.close();
      }
    }
    this.sockets.clear();
    this.server?.close();
    this.server = null;
  }

  private readUserId(token: string, accessSecret: string): string | null {
    if (!token || !accessSecret) {
      return null;
    }
    try {
      const payload = verify(token, accessSecret, {
        algorithms: ['HS256'],
      }) as JwtAccessClaims;
      return typeof payload.sub === 'string' && payload.sub.length > 0
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }

  private track(userId: string, client: WebSocket): void {
    const clients = this.sockets.get(userId) ?? new Set<WebSocket>();
    clients.add(client);
    this.sockets.set(userId, clients);
    client.on('close', () => {
      clients.delete(client);
      if (clients.size === 0) {
        this.sockets.delete(userId);
      }
    });
  }
}
