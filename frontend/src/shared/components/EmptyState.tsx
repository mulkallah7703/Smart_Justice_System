import Icon from './Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: string;
  title: string;
  body?: string;
  className?: string;
}

const EmptyState = ({
  icon,
  title,
  body,
  className = '',
}: EmptyStateProps): JSX.Element => {
  return (
    <div className={`${styles.state} ${className}`} role="status">
      <span className={styles.iconWrap} aria-hidden>
        <Icon name={icon} size={28} className={styles.icon} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {body ? <p className={styles.body}>{body}</p> : null}
    </div>
  );
};

export default EmptyState;
