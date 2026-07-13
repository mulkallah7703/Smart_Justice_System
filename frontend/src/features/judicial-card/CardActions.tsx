import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import styles from './CardActions.module.css';

interface CardActionsProps {
  onShowIdentity: () => void;
  onAddToWallet: () => void;
  onUpgrade: () => void;
}

const CardActions = ({
  onShowIdentity,
  onAddToWallet,
  onUpgrade,
}: CardActionsProps): JSX.Element => {
  return (
    <div className={styles.row} role="group" aria-label={ar.judicialCard.actionsAria}>
      <button type="button" className={styles.action} onClick={onShowIdentity}>
        <Icon name="qr_code_2" size={24} className={styles.actionIcon} />
        <span className={styles.actionLabel}>
          {ar.judicialCard.actions.showIdentity}
        </span>
      </button>

      <button type="button" className={styles.action} onClick={onAddToWallet}>
        <Icon
          name="account_balance_wallet"
          size={24}
          className={styles.actionIcon}
        />
        <span className={styles.actionLabel}>
          {ar.judicialCard.actions.addToWallet}
        </span>
      </button>

      <button
        type="button"
        className={`${styles.action} ${styles.upgrade}`}
        onClick={onUpgrade}
      >
        <Icon name="arrow_upward" size={24} className={styles.upgradeIcon} />
        <span className={styles.upgradeLabel}>
          {ar.judicialCard.actions.upgrade}
        </span>
      </button>
    </div>
  );
};

export default CardActions;
