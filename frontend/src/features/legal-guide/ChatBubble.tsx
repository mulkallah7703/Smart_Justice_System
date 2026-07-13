import Icon from '../../shared/components/Icon';

import type { BubbleRole } from './guide.types';
import styles from './ChatBubble.module.css';

interface ChatBubbleProps {
  role?: BubbleRole;
  text?: string;
  typing?: boolean;
}

const ChatBubble = ({
  role = 'ai',
  text = '',
  typing = false,
}: ChatBubbleProps): JSX.Element => {
  if (typing) {
    return (
      <div className={`${styles.row} ${styles.ai}`} aria-label="جاري الكتابة">
        <div className={styles.avatar} aria-hidden="true">
          <Icon name="auto_awesome" size={16} filled className={styles.avatarIcon} />
        </div>
        <div className={`${styles.bubble} ${styles.bubbleAi} ${styles.typing}`}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
    );
  }

  const isAi = role === 'ai';

  return (
    <div className={`${styles.row} ${isAi ? styles.ai : styles.user}`}>
      {isAi ? (
        <div className={styles.avatar} aria-hidden="true">
          <Icon name="auto_awesome" size={16} filled className={styles.avatarIcon} />
        </div>
      ) : null}
      <div
        className={`${styles.bubble} ${isAi ? styles.bubbleAi : styles.bubbleUser}`}
      >
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  );
};

export default ChatBubble;
