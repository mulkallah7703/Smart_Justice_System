import Icon from '../../shared/components/Icon';

import styles from './DurationCard.module.css';

interface DurationCardProps {
  label: string;
  value: string;
  days: number;
  unit: string;
}

const DurationCard = ({
  label,
  value,
  days,
  unit,
}: DurationCardProps): JSX.Element => {
  return (
    <article className={styles.card}>
      <div className={styles.iconWrap} aria-hidden="true">
        <Icon name="hourglass_empty" size={20} />
      </div>
      <div className={styles.copy}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
      <div className={styles.badge} aria-label={`${days} ${unit}`}>
        <span className={styles.badgeNumber}>{days}</span>
        <span className={styles.badgeUnit}>{unit}</span>
      </div>
    </article>
  );
};

export default DurationCard;
