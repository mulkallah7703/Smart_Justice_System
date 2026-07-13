import Icon from '../../shared/components/Icon';

import type { FindingTone } from './advisor.types';
import styles from './FindingCard.module.css';

interface FindingCardProps {
  title: string;
  subtitle: string;
  icon: string;
  tone: FindingTone;
}

const toneClassMap: Record<FindingTone, string> = {
  success: styles.success,
  warning: styles.warning,
  info: styles.info,
};

const FindingCard = ({
  title,
  subtitle,
  icon,
  tone,
}: FindingCardProps): JSX.Element => {
  return (
    <article className={styles.card}>
      <div className={`${styles.iconWrap} ${toneClassMap[tone]}`} aria-hidden="true">
        <Icon name={icon} size={20} filled={tone !== 'info'} />
      </div>
      <div className={styles.copy}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </article>
  );
};

export default FindingCard;
