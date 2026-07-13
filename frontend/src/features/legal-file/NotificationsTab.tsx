import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';

const NotificationsTab = (): JSX.Element => {
  return (
    <EmptyState
      icon="notifications"
      title={ar.legalFile.empty.notifications.title}
      body={ar.legalFile.empty.notifications.body}
    />
  );
};

export default NotificationsTab;
