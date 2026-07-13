import { endpoints } from '../../shared/api/endpoints';

import type { NafathVerifyPayload, NafathVerifyResponse } from './auth.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const verifyNafath = async (
  payload: NafathVerifyPayload,
): Promise<NafathVerifyResponse> => {
  if (!API_BASE_URL) {
    await wait(400);
    return { accessToken: `dev-token-${payload.nationalId}` };
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.auth.nafathVerify}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nationalId: payload.nationalId,
      nafathCode: payload.nafathCode,
    }),
  });

  if (!response.ok) {
    throw new Error('NAFATH_VERIFY_FAILED');
  }

  const json = (await response.json()) as { data: NafathVerifyResponse };
  return json.data;
};
