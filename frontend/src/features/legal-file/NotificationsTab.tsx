import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';
import AlertCard from '../alerts/AlertCard';
import { useAlerts } from '../alerts/useAlerts';

import styles from './NotificationsTab.module.css';

const NotificationsTab = (): JSX.Element => {
  const { alerts, isLoading, errorMessage, handleRead } = useAlerts('all');

  if (isLoading) {
    return <div className={styles.tab} />;
  }

  if (errorMessage) {
    return (
      <p className={styles.error} role="alert">
        {errorMessage}
      </p>
    );
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon="notifications"
        title={ar.legalFile.empty.notifications.title}
        body={ar.legalFile.empty.notifications.body}
      />
    );
  }

  return (
    <div className={styles.list}>
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onRead={handleRead} />
      ))}
    </div>
  );
};

export default NotificationsTab;
