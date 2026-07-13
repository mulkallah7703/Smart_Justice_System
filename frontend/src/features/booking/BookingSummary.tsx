import { ar } from '../../core/i18n/ar';
import { toArabicNumerals } from '../../shared/utils/arabicNumerals';

import styles from './BookingSummary.module.css';

interface BookingSummaryProps {
  discountedPrice: number;
  originalPrice: number;
}

const BookingSummary = ({
  discountedPrice,
  originalPrice,
}: BookingSummaryProps): JSX.Element => {
  return (
    <div className={styles.summary}>
      <span className={styles.label}>{ar.booking.totalAfterDiscount}</span>
      <div className={styles.prices}>
        <span className={styles.discounted}>
          {toArabicNumerals(discountedPrice)} {ar.booking.currency}
        </span>
        <span className={styles.original}>
          {toArabicNumerals(originalPrice)}
        </span>
      </div>
    </div>
  );
};

export default BookingSummary;
