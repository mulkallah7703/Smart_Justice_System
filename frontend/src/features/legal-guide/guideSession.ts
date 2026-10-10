const SESSION_KEY = 'guide:sessionId';

/** Persist Guide session across /guide → /guide/question → /guide/summary. */
export const saveGuideSessionId = (sessionId: string): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, sessionId);
  } catch {
    /* storage may be unavailable */
  }
};

export const loadGuideSessionId = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

export const clearGuideSessionId = (): void => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};
