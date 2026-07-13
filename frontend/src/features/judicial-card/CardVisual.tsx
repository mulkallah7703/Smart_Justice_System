import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';
import TierBadge from '../../shared/components/TierBadge';

import CardQRCode from './CardQRCode';

import type { JudicialCardData } from './card.types';
import styles from './CardVisual.module.css';

interface CardVisualProps {
  card: JudicialCardData;
  isFlipped: boolean;
  qrPayload: string;
  onFlip: () => void;
}

const tierVariantMap = {
  NORMAL: 'normal',
  SILVER: 'silver',
  GOLD: 'gold',
} as const;

const CardVisual = ({
  card,
  isFlipped,
  qrPayload,
  onFlip,
}: CardVisualProps): JSX.Element => {
  return (
    <button
      type="button"
      className={styles.wrap}
      onClick={onFlip}
      aria-pressed={isFlipped}
      aria-label={ar.judicialCard.flipAria}
    >
      <div
        className={`${styles.inner} ${isFlipped ? styles.flipped : ''}`}
      >
        <div className={`${styles.face} ${styles.front}`}>
          <div className={styles.glowA} aria-hidden />
          <div className={styles.glowB} aria-hidden />

          <div className={styles.topRow}>
            <div className={styles.brand}>
              <span className={styles.brandIcon} aria-hidden>
                <Icon name="balance" size={20} />
              </span>
              <span className={styles.brandName}>{card.brandName}</span>
            </div>
            <TierBadge
              label={card.tierLabel}
              variant={tierVariantMap[card.tier]}
              className={styles.tier}
            />
          </div>

          <div className={styles.chipRow}>
            <span className={styles.chip} aria-hidden>
              <span className={styles.chipGrid} />
            </span>
          </div>

          <div className={styles.numberBlock}>
            <span className={styles.numberLabel}>
              {ar.judicialCard.fileNumberLabel}
            </span>
            <span className={styles.number}>{card.cardNumber}</span>
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.holderBlock}>
              <span className={styles.holderLabel}>
                {ar.judicialCard.holderLabel}
              </span>
              <span className={styles.holderName}>{card.holderName}</span>
            </div>
            <span className={styles.qrStamp} aria-hidden>
              <Icon name="qr_code_2" size={28} />
            </span>
          </div>
        </div>

        <div className={`${styles.face} ${styles.back}`}>
          <CardQRCode
            payload={qrPayload}
            holderName={card.holderName}
            cardNumber={card.cardNumber}
          />
        </div>
      </div>
    </button>
  );
};

export default CardVisual;
