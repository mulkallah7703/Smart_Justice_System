import { endpoints } from '../../shared/api/endpoints';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';
import type { AuthResponse } from '../../shared/api/types';

import type {
  LoginPayload,
  LoginResponse,
  NafathVerifyPayload,
  NafathVerifyResponse,
  RegisterPayload,
  RegisterResponse,
} from './auth.types';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const register = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  if (isMockApiMode()) {
    await wait(300);
    return {
      id: `dev-${payload.email}`,
      name: payload.name,
      email: payload.email.trim().toLowerCase(),
    };
  }

  return apiRequest<RegisterResponse>(endpoints.auth.register, {
    method: 'POST',
    body: {
      name: payload.name,
      email: payload.email,
      password: payload.password,
    },
    auth: false,
  });
};

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  if (isMockApiMode()) {
    await wait(300);
    return { accessToken: `dev-token-${payload.email.trim().toLowerCase()}` };
  }

  const data = await apiRequest<AuthResponse>(endpoints.auth.login, {
    method: 'POST',
    body: {
      email: payload.email,
      password: payload.password,
    },
    auth: false,
  });

  return { accessToken: data.accessToken };
};

/**
 * FUTURE Nafath client helper — not used by Login/Register screens.
 * Kept for a later official integration.
 */
export const verifyNafath = async (
  payload: NafathVerifyPayload,
): Promise<NafathVerifyResponse> => {
  if (isMockApiMode()) {
    await wait(400);
    return { accessToken: `dev-token-${payload.nationalId}` };
  }

  const data = await apiRequest<AuthResponse>(endpoints.auth.nafathVerify, {
    method: 'POST',
    body: {
      nationalId: payload.nationalId,
      nafathCode: payload.nafathCode,
    },
    auth: false,
  });

  return { accessToken: data.accessToken };
};
