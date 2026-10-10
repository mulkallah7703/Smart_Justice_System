import { useEffect, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import EmptyState from '../../shared/components/EmptyState';
import { getUserFacingBookingError } from '../../shared/api/errors';
import { formatDateTimeAr } from '../../shared/utils/dateFormatter';
import { listConsultations } from '../booking/bookingApi';

import type { BackendConsultation } from '../booking/booking.types';
import styles from './AppointmentsTab.module.css';

const AppointmentsTab = (): JSX.Element => {
  const [items, setItems] = useState<BackendConsultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await listConsultations();
        if (active) {
          setItems(
            [...data].sort(
              (left, right) =>
                Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt),
            ),
          );
        }
      } catch (error) {
        if (active) {
          setItems([]);
          setErrorMessage(getUserFacingBookingError(error));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

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

  if (items.length === 0) {
    return (
      <EmptyState
        icon="event"
        title={ar.legalFile.empty.appointments.title}
        body={ar.legalFile.empty.appointments.body}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <p className={styles.title}>
            {ar.booking.types[bookingTypeKey(item.type)].title}
          </p>
          <p className={styles.meta}>
            {item.lawyer.name ?? ar.payment.summary.lawyerFallback}
            {item.lawyer.city ? ` • ${item.lawyer.city}` : ''}
          </p>
          <p className={styles.meta}>{formatDateTimeAr(item.scheduledAt)}</p>
          <p className={styles.status}>
            {ar.legalFile.consultationStatus[item.status]}
          </p>
        </li>
      ))}
    </ul>
  );
};

const bookingTypeKey = (
  type: BackendConsultation['type'],
): 'instant' | 'written' | 'inPerson' | 'representation' => {
  switch (type) {
    case 'WRITTEN':
      return 'written';
    case 'IN_PERSON':
      return 'inPerson';
    case 'REPRESENTATION':
      return 'representation';
    default:
      return 'instant';
  }
};

export default AppointmentsTab;
