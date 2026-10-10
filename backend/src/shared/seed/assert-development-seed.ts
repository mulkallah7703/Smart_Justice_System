/**
 * Demo seed creates a known citizen password and synthetic national IDs.
 * It must never run against a production (or otherwise non-local) database.
 */
export const assertDevelopmentSeed = (env: NodeJS.ProcessEnv): void => {
  const nodeEnv = env.NODE_ENV?.trim();
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return;
  }

  const shown = nodeEnv && nodeEnv.length > 0 ? nodeEnv : '(unset)';
  throw new Error(
    `Refusing to create demo seed credentials when NODE_ENV=${shown}. Seed is allowed only when NODE_ENV is development or test.`,
  );
};
