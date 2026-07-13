import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const SectionHeader = ({
  title,
  actionLabel,
  onAction,
  className = '',
}: SectionHeaderProps): JSX.Element => {
  return (
    <div className={`${styles.header} ${className}`}>
      <h2 className={styles.title}>{title}</h2>
      {actionLabel && onAction ? (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};

export default SectionHeader;
