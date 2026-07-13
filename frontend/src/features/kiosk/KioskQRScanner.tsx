import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './KioskQRScanner.module.css';

interface KioskQRScannerProps {
  onScan: () => void;
  disabled?: boolean;
  active?: boolean;
}

const KioskQRScanner = ({
  onScan,
  disabled = false,
  active = false,
}: KioskQRScannerProps): JSX.Element => {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ''}`}
      onClick={onScan}
      disabled={disabled}
    >
      <span className={styles.iconWrap} aria-hidden>
        <Icon name="qr_code_scanner" size={32} className={styles.icon} />
      </span>
      <span className={styles.label}>{ar.kiosk.actions.scanQr}</span>
    </button>
  );
};

export default KioskQRScanner;
