import Button from '../../shared/components/Button';
import Icon from '../../shared/components/Icon';

import AlertCountdown from './AlertCountdown';

import type { Alert, AlertActionVariant } from './alerts.types';
import styles from './AlertCard.module.css';

interface AlertCardProps {
  alert: Alert;
  onRead: (id: string) => void;
  onAction?: (id: string) => void;
}

const severityClassMap = {
  URGENT: styles.urgent,
  WARNING: styles.warning,
  INFO: styles.info,
} as const;

const iconWrapClassMap = {
  URGENT: styles.iconWrapUrgent,
  WARNING: styles.iconWrapWarning,
  INFO: styles.iconWrapInfo,
} as const;

const iconClassMap = {
  URGENT: styles.iconUrgent,
  WARNING: styles.iconWarning,
  INFO: styles.iconInfo,
} as const;

const badgeClassMap = {
  URGENT: styles.badgeUrgent,
  WARNING: styles.badgeWarning,
} as const;

const actionClassMap: Record<AlertActionVariant, string> = {
  'danger-solid': styles.actionDanger,
  'warning-outline': styles.actionWarning,
};

const AlertCard = ({ alert, onRead, onAction }: AlertCardProps): JSX.Element => {
  const handleCardClick = (): void => {
    if (!alert.isRead) {
      onRead(alert.id);
    }
  };

  const handleActionClick = (): void => {
    onRead(alert.id);
    onAction?.(alert.id);
  };

  return (
    <article
      className={`${styles.card} ${severityClassMap[alert.severity]} ${alert.isRead ? '' : styles.unread}`}
      onClick={handleCardClick}
    >
      <div className={styles.topRow}>
        {alert.severityLabelAr &&
        (alert.severity === 'URGENT' || alert.severity === 'WARNING') ? (
          <span className={`${styles.badge} ${badgeClassMap[alert.severity]}`}>
            {alert.severityLabelAr}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className={`${styles.iconWrap} ${iconWrapClassMap[alert.severity]}`}>
          <Icon
            name={alert.icon}
            size={20}
            filled={alert.severity === 'URGENT'}
            className={iconClassMap[alert.severity]}
          />
        </div>
      </div>

      <div className={styles.body}>
        <h2 className={styles.title}>{alert.titleAr}</h2>
        <p className={styles.description}>{alert.bodyAr}</p>
      </div>

      {alert.timeLeft && alert.countdownLabel ? (
        <AlertCountdown timeLeft={alert.timeLeft} label={alert.countdownLabel} />
      ) : null}

      {alert.action ? (
        <Button
          variant={alert.action.variant === 'danger-solid' ? 'primary' : 'secondary'}
          size="md"
          fullWidth
          className={actionClassMap[alert.action.variant]}
          onClick={(event) => {
            event.stopPropagation();
            handleActionClick();
          }}
        >
          {alert.action.label}
        </Button>
      ) : null}
    </article>
  );
};

export default AlertCard;
