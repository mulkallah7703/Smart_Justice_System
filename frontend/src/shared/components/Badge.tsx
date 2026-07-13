import styles from './Badge.module.css';

type BadgeVariant = 'danger' | 'primary' | 'gold';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  ariaLabel?: string;
}

const Badge = ({
  variant = 'danger',
  className = '',
  ariaLabel = 'إشعار جديد',
}: BadgeProps): JSX.Element => {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${className}`}
      aria-label={ariaLabel}
    />
  );
};

export default Badge;
