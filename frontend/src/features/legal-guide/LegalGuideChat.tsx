import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import ScreenShell from '../../shared/components/ScreenShell';

import ChatBubble from './ChatBubble';
import ChatComposer from './ChatComposer';
import GuideChatHeader from './GuideChatHeader';
import GuideQuickReplies, { type GuideQuickReplyOption } from './GuideQuickReplies';
import { useGuideChat } from './useGuideChat';
import styles from './LegalGuideChat.module.css';

const RETRY_ID = 'action:retry';
const SUMMARY_ID = 'action:summary';

const LegalGuideChat = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    messages,
    stage,
    sessionId,
    suggestedReplies,
    isTyping,
    isSending,
    errorMessage,
    canRetry,
    sendMessage,
    retry,
  } = useGuideChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /** Chips come only from the model's own question, a failed send, or available guidance. */
  const quickReplyOptions = useMemo<GuideQuickReplyOption[]>(() => {
    if (canRetry) {
      return [{ id: RETRY_ID, label: ar.guide.actions.retry }];
    }
    if (stage === 'QUESTION') {
      return suggestedReplies.map((label, index) => ({
        id: `reply-${index}`,
        label,
      }));
    }
    if (stage === 'ANSWER' && sessionId) {
      return [{ id: SUMMARY_ID, label: ar.guide.actions.viewSummary }];
    }
    return [];
  }, [canRetry, stage, suggestedReplies, sessionId]);

  const showQuickReplies =
    !isTyping && !isSending && quickReplyOptions.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showQuickReplies]);

  const handleQuickReply = (option: GuideQuickReplyOption): void => {
    if (option.id === RETRY_ID) {
      void retry();
      return;
    }
    if (option.id === SUMMARY_ID) {
      navigate(`/guide/summary/${encodeURIComponent(sessionId)}`);
      return;
    }
    void sendMessage(option.label);
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <GuideChatHeader
          title={ar.guide.title}
          subtitle={ar.guide.subtitle}
          onBack={() => navigate(-1)}
        />

        <div className={styles.chat}>
          <p className={styles.disclaimer}>{ar.guide.disclaimer}</p>

          {errorMessage ? (
            <p className={styles.errorBanner} role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className={styles.messages}>
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                text={message.text}
              />
            ))}
            {isTyping ? <ChatBubble typing /> : null}
            {showQuickReplies ? (
              <GuideQuickReplies
                options={quickReplyOptions}
                disabled={isSending}
                onSelect={handleQuickReply}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <ChatComposer
          placeholder={ar.guide.placeholder}
          sendAriaLabel={ar.guide.sendAria}
          micAriaLabel={ar.guide.micAria}
          disabled={isSending}
          onSend={(text) => {
            void sendMessage(text);
          }}
        />
      </div>
    </ScreenShell>
  );
};

export default LegalGuideChat;
