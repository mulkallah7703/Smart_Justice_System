import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { authInvalidToken, authUnauthorized } from '../auth.errors';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: { name?: string; message?: string } | undefined,
  ): TUser {
    if (user) {
      return user;
    }

    if (err) {
      throw err;
    }

    if (
      info?.name === 'TokenExpiredError' ||
      info?.name === 'JsonWebTokenError' ||
      info?.name === 'NotBeforeError'
    ) {
      throw authInvalidToken();
    }

    throw authUnauthorized();
  }
}
