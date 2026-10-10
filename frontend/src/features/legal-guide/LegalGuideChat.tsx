import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { isDomainLive } from '../../shared/api/mode';
import ScreenShell from '../../shared/components/ScreenShell';

import ChatBubble from './ChatBubble';
import ChatComposer from './ChatComposer';
import GuideChatHeader from './GuideChatHeader';
import GuideQuickReplies from './GuideQuickReplies';
import { useGuideChat } from './useGuideChat';
import styles from './LegalGuideChat.module.css';

const LegalGuideChat = (): JSX.Element => {
  const navigate = useNavigate();
  const live = isDomainLive('guide');
  const {
    messages,
    stage,
    sessionId,
    isTyping,
    isSending,
    errorMessage,
    sendMessage,
  } = useGuideChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const quickReplyOptions = useMemo(
    () => [
      { id: 'documented', label: ar.guide.quickReplies.documented },
      { id: 'not-documented', label: ar.guide.quickReplies.notDocumented },
    ],
    [],
  );

  const lastMessage = messages[messages.length - 1];
  const showQuickReplies =
    !live &&
    !isTyping &&
    !isSending &&
    lastMessage?.id === 'ai-followup';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showQuickReplies]);

  useEffect(() => {
    if (!live || !sessionId) {
      return;
    }
    if (stage === 'SUMMARY') {
      navigate(`/guide/summary/${encodeURIComponent(sessionId)}`, {
        replace: true,
      });
      return;
    }
    if (stage === 'QUESTION') {
      navigate('/guide/question', { replace: true });
    }
  }, [live, stage, sessionId, navigate]);

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
                onSelect={(label) => {
                  void sendMessage(label);
                }}
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
