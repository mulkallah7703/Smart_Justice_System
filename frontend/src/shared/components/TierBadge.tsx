import styles from './TierBadge.module.css';

type TierBadgeVariant = 'normal' | 'silver' | 'gold';

interface TierBadgeProps {
  label: string;
  variant?: TierBadgeVariant;
  className?: string;
}

const TierBadge = ({
  label,
  variant = 'normal',
  className = '',
}: TierBadgeProps): JSX.Element => {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>{label}</span>
  );
};

export default TierBadge;
