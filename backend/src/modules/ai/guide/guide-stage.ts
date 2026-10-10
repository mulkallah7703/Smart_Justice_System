/** Stages expected by the existing Legal Guide frontend. */
export type GuideStage = 'CHAT' | 'QUESTION' | 'SUMMARY';

/**
 * Deterministic stage machine from the count of USER messages in the session.
 * No persisted stage column is required.
 *
 * 0 user turns → CHAT (welcome only)
 * 1 user turn  → QUESTION (clarification)
 * 2+           → SUMMARY (informational wrap-up)
 */
export const resolveGuideStage = (userMessageCount: number): GuideStage => {
  if (userMessageCount <= 0) {
    return 'CHAT';
  }
  if (userMessageCount === 1) {
    return 'QUESTION';
  }
  return 'SUMMARY';
};
