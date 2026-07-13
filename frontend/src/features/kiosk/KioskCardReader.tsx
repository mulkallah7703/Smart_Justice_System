import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './KioskCardReader.module.css';

interface KioskCardReaderProps {
  onTap: () => void;
  disabled?: boolean;
  active?: boolean;
}

const KioskCardReader = ({
  onTap,
  disabled = false,
  active = false,
}: KioskCardReaderProps): JSX.Element => {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ''}`}
      onClick={onTap}
      disabled={disabled}
    >
      <span className={styles.iconWrap} aria-hidden>
        <Icon name="contactless" size={28} className={styles.icon} />
      </span>
      <span className={styles.label}>{ar.kiosk.actions.tapCard}</span>
    </button>
  );
};

export default KioskCardReader;
