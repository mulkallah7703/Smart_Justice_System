import { ar } from '../../core/i18n/ar';
import { formatCountdownAr, toArabicNumerals } from '../../shared/utils/arabicNumerals';
import Icon from '../../shared/components/Icon';

import styles from './NafathCodeCard.module.css';

interface NafathCodeCardProps {
  code: number;
  secondsLeft: number;
  isExpired: boolean;
}

const NafathCodeCard = ({
  code,
  secondsLeft,
  isExpired,
}: NafathCodeCardProps): JSX.Element => {
  const timerLabel = isExpired
    ? ar.nafath.expired
    : `${ar.nafath.expiresIn} ${formatCountdownAr(secondsLeft)}`;

  return (
    <section className={styles.card} aria-live="polite">
      <p className={styles.instruction}>{ar.nafath.codeInstruction}</p>
      <p className={styles.code}>{toArabicNumerals(code)}</p>
      <div className={styles.timerRow}>
        <Icon name="schedule" size={16} className={styles.timerIcon} />
        <span className={`${styles.timerText} ${isExpired ? styles.expired : ''}`}>
          {timerLabel}
        </span>
      </div>
    </section>
  );
};

export default NafathCodeCard;
