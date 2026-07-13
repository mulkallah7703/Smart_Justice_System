import styles from './StatusBadge.module.css';

type StatusBadgeVariant = 'active' | 'pending' | 'closed' | 'appeal';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  className?: string;
}

const StatusBadge = ({
  label,
  variant = 'pending',
  className = '',
}: StatusBadgeProps): JSX.Element => {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>{label}</span>
  );
};

export default StatusBadge;
export type { StatusBadgeVariant };
