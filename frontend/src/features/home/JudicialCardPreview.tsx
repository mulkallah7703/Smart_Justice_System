import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';
import Icon from '../../shared/components/Icon';
import TierBadge from '../../shared/components/TierBadge';

import type { HomeJudicialCard } from './home.types';
import styles from './JudicialCardPreview.module.css';

interface JudicialCardPreviewProps {
  card: HomeJudicialCard;
  onClick?: () => void;
}

const tierVariantMap = {
  normal: 'normal',
  silver: 'silver',
  gold: 'gold',
} as const;

const JudicialCardPreview = ({ card, onClick }: JudicialCardPreviewProps): JSX.Element => {
  const discountLabel = `%${toArabicNumerals(card.discountPct)}`;

  const content = (
    <>
      <div className={styles.topRow}>
        <div className={styles.titleRow}>
          <Icon name="credit_card" size={20} className={styles.titleIcon} />
          <span className={styles.cardTitle}>{ar.home.card.title}</span>
        </div>
        <TierBadge label={card.tierLabel} variant={tierVariantMap[card.tier]} />
      </div>

      <div className={styles.details}>
        <div className={styles.detailBlock}>
          <span className={styles.detailLabel}>{ar.home.card.fileNumberLabel}</span>
          <span className={styles.fileNumber}>{card.cardNumber}</span>
        </div>
        <div className={styles.detailBlock}>
          <span className={styles.detailLabel}>{ar.home.card.discountLabel}</span>
          <span className={styles.discount}>{discountLabel}</span>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`${styles.card} ${styles.clickable}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={styles.card}>{content}</article>;
};

export default JudicialCardPreview;
