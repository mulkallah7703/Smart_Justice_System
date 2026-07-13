import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Badge from '../../shared/components/Badge';
import Icon from '../../shared/components/Icon';

import { alertsStore } from '../alerts/alertsStore';
import styles from './HomeHeader.module.css';

interface HomeHeaderProps {
  screenTitle: string;
  greeting: string;
  userName: string;
  hasNotifications?: boolean;
}

const HomeHeader = ({
  screenTitle,
  greeting,
  userName,
  hasNotifications = false,
}: HomeHeaderProps): JSX.Element => {
  const navigate = useNavigate();
  const unreadCount = alertsStore((state) => state.unreadCount);
  const showDot = hasNotifications || unreadCount > 0;

  return (
    <header className={styles.header}>
      <p className={styles.screenTitle}>{screenTitle}</p>

      <div className={styles.row}>
        <div className={styles.greetingBlock}>
          <p className={styles.greeting}>{greeting}</p>
          <h1 className={styles.userName}>{userName}</h1>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            aria-label={ar.home.notificationsAria}
            onClick={() => navigate('/alerts')}
          >
            <Icon name="notifications" size={24} className={styles.actionIcon} />
            {showDot ? <Badge className={styles.notificationDot} /> : null}
          </button>
          <button
            type="button"
            className={styles.actionButton}
            aria-label={ar.home.profileAria}
            onClick={() => navigate('/profile')}
          >
            <Icon name="person" size={24} className={styles.actionIcon} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default HomeHeader;
