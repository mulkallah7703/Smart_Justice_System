/**
 * Conversation state returned to the frontend, derived from the validated model turn
 * (never from a message count):
 *
 * CHAT     → session open, no legal turn yet (welcome only)
 * QUESTION → the model needs one material fact; the reply is that question
 * ANSWER   → the reply is guidance; the user may continue, add facts, or correct them
 */
export type GuideStage = 'CHAT' | 'QUESTION' | 'ANSWER';
