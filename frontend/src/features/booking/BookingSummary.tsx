import { ar } from '../../core/i18n/ar';

import styles from './BookingSummary.module.css';

/** Payment is deferred. The summary must not show a payable total. */
const BookingSummary = (): JSX.Element => {
  return (
    <p className={styles.note} role="note">
      {ar.booking.paymentLater}
    </p>
  );
};

export default BookingSummary;
