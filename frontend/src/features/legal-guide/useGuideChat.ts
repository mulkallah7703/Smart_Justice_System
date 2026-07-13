import { useCallback, useEffect, useState } from 'react';

import { ar } from '../../core/i18n/ar';

import { sendGuideAnswer, startGuideSession } from './guideApi';

import type { GuideMessage, GuideStage } from './guide.types';

interface UseGuideChatResult {
  messages: GuideMessage[];
  stage: GuideStage;
  isTyping: boolean;
  isSending: boolean;
  sendMessage: (text: string) => Promise<void>;
}

const createId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialMessages = (): GuideMessage[] => [
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
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<GuideMessage[]>(initialMessages);
  const [stage, setStage] = useState<GuideStage>('CHAT');
  const [isTyping, setIsTyping] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      try {
        const session = await startGuideSession();
        if (cancelled) {
          return;
        }
        setSessionId(session.sessionId);
      } finally {
        if (!cancelled) {
          window.setTimeout(() => {
            if (!cancelled) {
              setIsTyping(false);
            }
          }, 1400);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

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

      try {
        const activeSessionId =
          sessionId || (await startGuideSession()).sessionId;

        if (!sessionId) {
          setSessionId(activeSessionId);
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
      } catch {
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
    isTyping,
    isSending,
    sendMessage,
  };
};
