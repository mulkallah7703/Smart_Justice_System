/** Shown unless the production build explicitly turns the flag off. */
export const advisorExperimentalEnabled = (): boolean => {
  const raw = import.meta.env.VITE_AI_ADVISOR_EXPERIMENTAL;
  if (raw === undefined || raw === '') {
    return true;
  }
  return raw !== 'false' && raw !== '0';
};
