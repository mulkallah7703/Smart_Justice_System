import { useCallback, useEffect, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { getUserFacingGuideError } from '../../shared/api/errors';
import { isDomainLive } from '../../shared/api/mode';

import { sendGuideAnswer, startGuideSession } from './guideApi';
import { loadGuideSessionId, saveGuideSessionId } from './guideSession';

import type { GuideMessage, GuideStage } from './guide.types';

interface UseGuideChatResult {
  messages: GuideMessage[];
  stage: GuideStage;
  sessionId: string;
  isTyping: boolean;
  isSending: boolean;
  errorMessage: string | null;
  sendMessage: (text: string) => Promise<void>;
}

const createId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialMockMessages = (): GuideMessage[] => [
  {
    id: 'welcome',
    role: 'ai',
    text: ar.guide.messages.welcome,
  },
  {
    id: 'user-sample',
    role: 'user',
    text: ar.guide.messages.userSample,
  },
  {
    id: 'ai-followup',
    role: 'ai',
    text: ar.guide.messages.aiFollowUp,
  },
];

export const useGuideChat = (): UseGuideChatResult => {
  const live = isDomainLive('guide');
  const [sessionId, setSessionId] = useState<string>(
    () => loadGuideSessionId() ?? '',
  );
  const [messages, setMessages] = useState<GuideMessage[]>(() =>
    live ? [] : initialMockMessages(),
  );
  const [stage, setStage] = useState<GuideStage>('CHAT');
  const [isTyping, setIsTyping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      try {
        const session = await startGuideSession();
        if (cancelled) {
          return;
        }
        setSessionId(session.sessionId);
        saveGuideSessionId(session.sessionId);
        if (live) {
          setMessages([
            {
              id: createId(),
              role: 'ai',
              text: session.reply,
            },
          ]);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(getUserFacingGuideError(error));
        }
      } finally {
        if (!cancelled) {
          window.setTimeout(() => {
            if (!cancelled) {
              setIsTyping(false);
            }
          }, live ? 400 : 1400);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [live]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || isSending) {
        return;
      }

      const userMessage: GuideMessage = {
        id: createId(),
        role: 'user',
        text: trimmed,
      };

      setMessages((current) => [...current, userMessage]);
      setIsSending(true);
      setIsTyping(true);
      setErrorMessage(null);

      try {
        let activeSessionId = sessionId;
        if (!activeSessionId) {
          const started = await startGuideSession();
          activeSessionId = started.sessionId;
          setSessionId(activeSessionId);
          saveGuideSessionId(activeSessionId);
        }

        const response = await sendGuideAnswer(activeSessionId, trimmed);

        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: 'ai',
            text: response.reply,
          },
        ]);
        setStage(response.stage);
      } catch (error: unknown) {
        setErrorMessage(getUserFacingGuideError(error));
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: 'ai',
            text: ar.guide.errorReply,
          },
        ]);
      } finally {
        setIsTyping(false);
        setIsSending(false);
      }
    },
    [isSending, sessionId],
  );

  return {
    messages,
    stage,
    sessionId,
    isTyping,
    isSending,
    errorMessage,
    sendMessage,
  };
};
