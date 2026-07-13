import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import BottomNav from '../../shared/components/BottomNav';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';
import ScrollContent from '../../shared/components/ScrollContent';

import AlertCard from './AlertCard';
import AlertsFilter from './AlertsFilter';
import { useAlerts } from './useAlerts';

import type { AlertFilterId } from './alerts.types';
import styles from './AlertsCenter.module.css';

const AlertsCenter = (): JSX.Element => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AlertFilterId>('all');
  const { alerts, totalCount, isLoading, handleRead } = useAlerts(filter);

  return (
    <ScreenShell variant="default">
      <div className={styles.screen}>
        <Header
          title={ar.alerts.title}
          onBack={() => navigate(-1)}
        />

        <AlertsFilter
          activeFilter={filter}
          totalCount={totalCount}
          onChange={setFilter}
        />

        <ScrollContent className={styles.content}>
          <div className={styles.list}>
            {!isLoading
              ? alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onRead={handleRead}
                  />
                ))
              : null}
          </div>

          <p className={styles.footer}>{ar.alerts.footerNote}</p>
        </ScrollContent>

        <BottomNav />
      </div>
    </ScreenShell>
  );
};

export default AlertsCenter;
