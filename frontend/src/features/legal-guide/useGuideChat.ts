import { useCallback, useEffect, useRef, useState } from 'react';

import { getUserFacingGuideError } from '../../shared/api/errors';

import { sendGuideAnswer, startGuideSession } from './guideApi';
import { saveGuideSessionId } from './guideSession';

import type { GuideMessage, GuideStage } from './guide.types';

interface UseGuideChatResult {
  messages: GuideMessage[];
  stage: GuideStage;
  sessionId: string;
  suggestedReplies: string[];
  isTyping: boolean;
  isSending: boolean;
  errorMessage: string | null;
  canRetry: boolean;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
}

interface FailedSend {
  messageId: string;
  text: string;
}

const createId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * One inquiry per mount: a fresh backend session is started, so a new visit never
 * inherits an earlier conversation's facts or questions.
 */
export const useGuideChat = (): UseGuideChatResult => {
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [stage, setStage] = useState<GuideStage>('CHAT');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedSend | null>(null);
  const sessionRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      try {
        const session = await startGuideSession();
        if (cancelled) {
          return;
        }
        sessionRef.current = session.sessionId;
        setSessionId(session.sessionId);
        saveGuideSessionId(session.sessionId);
        setMessages((current) => [
          { id: createId(), role: 'ai', text: session.reply },
          ...current,
        ]);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(getUserFacingGuideError(error));
        }
      } finally {
        if (!cancelled) {
          setIsTyping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (text: string): Promise<void> => {
    setIsSending(true);
    setIsTyping(true);
    setErrorMessage(null);
    setSuggestedReplies([]);

    try {
      let activeSessionId = sessionRef.current;
      if (!activeSessionId) {
        const started = await startGuideSession();
        activeSessionId = started.sessionId;
        sessionRef.current = activeSessionId;
        setSessionId(activeSessionId);
        saveGuideSessionId(activeSessionId);
      }

      const response = await sendGuideAnswer(activeSessionId, text);

      setFailed(null);
      setMessages((current) => [
        ...current,
        { id: createId(), role: 'ai', text: response.reply },
      ]);
      setStage(response.stage);
      setSuggestedReplies(response.suggestedReplies);
    } catch (error: unknown) {
      setErrorMessage(getUserFacingGuideError(error));
      throw error;
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || isSending) {
        return;
      }

      const messageId = createId();
      setMessages((current) => [
        // The backend stores nothing for a failed send, so an unretried bubble is dropped.
        ...current.filter((m) => m.id !== failed?.messageId),
        { id: messageId, role: 'user', text: trimmed },
      ]);
      setFailed(null);

      try {
        await submit(trimmed);
      } catch {
        setFailed({ messageId, text: trimmed });
      }
    },
    [failed, isSending, submit],
  );

  const retry = useCallback(async (): Promise<void> => {
    if (!failed || isSending) {
      return;
    }
    try {
      await submit(failed.text);
    } catch {
      /* failed stays set so the user can retry again */
    }
  }, [failed, isSending, submit]);

  return {
    messages,
    stage,
    sessionId,
    suggestedReplies,
    isTyping,
    isSending,
    errorMessage,
    canRetry: failed !== null && !isSending,
    sendMessage,
    retry,
  };
};
