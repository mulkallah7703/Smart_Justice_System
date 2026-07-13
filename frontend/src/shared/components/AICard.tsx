import type { ReactNode } from 'react';

import Icon from './Icon';
import styles from './AICard.module.css';

interface AICardProps {
  title: string;
  body: string;
  icon?: string;
  glowing?: boolean;
  children?: ReactNode;
  className?: string;
}

const AICard = ({
  title,
  body,
  icon = 'auto_awesome',
  glowing = false,
  children,
  className = '',
}: AICardProps): JSX.Element => {
  return (
    <article
      className={`${styles.card} ${glowing ? styles.glowing : ''} ${className}`}
    >
      <div className={styles.header}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon name={icon} size={20} filled />
        </div>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <p className={styles.body}>{body}</p>
      {children ? <div className={styles.footer}>{children}</div> : null}
    </article>
  );
};

export default AICard;
