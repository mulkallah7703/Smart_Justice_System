import Icon from '../../shared/components/Icon';

import styles from './SummaryFieldCard.module.css';

interface SummaryFieldCardProps {
  label: string;
  value: string;
  icon: string;
}

const SummaryFieldCard = ({
  label,
  value,
  icon,
}: SummaryFieldCardProps): JSX.Element => {
  return (
    <article className={styles.card}>
      <div className={styles.iconWrap} aria-hidden="true">
        <Icon name={icon} size={20} />
      </div>
      <div className={styles.copy}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
    </article>
  );
};

export default SummaryFieldCard;
