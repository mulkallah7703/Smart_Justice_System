import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './PaymentSecurityBanner.module.css';

const PaymentSecurityBanner = (): JSX.Element => {
  return (
    <div className={styles.banner} role="note">
      <Icon name="verified_user" size={20} className={styles.icon} />
      <p className={styles.text}>{ar.payment.securityNote}</p>
    </div>
  );
};

export default PaymentSecurityBanner;
