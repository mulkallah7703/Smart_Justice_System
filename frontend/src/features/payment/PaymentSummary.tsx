import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';
import { formatMoneyAr } from '../../shared/utils/arabicNumerals';

import type { PaymentSummaryData } from './payment.types';
import styles from './PaymentSummary.module.css';

interface PaymentSummaryProps {
  summary: PaymentSummaryData;
}

const PaymentSummary = ({ summary }: PaymentSummaryProps): JSX.Element => {
  return (
    <section className={styles.card} aria-label={ar.payment.summary.title}>
      <h2 className={styles.title}>{ar.payment.summary.title}</h2>

      <p className={styles.meta}>
        {summary.serviceLabel}
        <span className={styles.dot} aria-hidden>
          •
        </span>
        {summary.lawyerName}
      </p>
      <p className={styles.schedule}>{summary.scheduleLabel}</p>

      <div className={styles.divider} />

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>
            {ar.payment.summary.consultationValue}
          </span>
          <span className={styles.rowValue}>
            {formatMoneyAr(summary.consultationAmount)} {summary.currency}
          </span>
        </div>

        {summary.discountPct > 0 ? (
          <div className={`${styles.row} ${styles.discountRow}`}>
            <span className={styles.discountLabel}>
              <Icon name="sell" size={16} className={styles.discountIcon} />
              {summary.discountLabel}
            </span>
            <span className={styles.discountValue}>
              −{formatMoneyAr(summary.discountAmount)} {summary.currency}
            </span>
          </div>
        ) : null}

        <div className={`${styles.row} ${styles.totalRow}`}>
          <span className={styles.totalLabel}>{ar.payment.summary.total}</span>
          <span className={styles.totalValue}>
            {formatMoneyAr(summary.totalAmount)} {summary.currency}
          </span>
        </div>
      </div>
    </section>
  );
};

export default PaymentSummary;
