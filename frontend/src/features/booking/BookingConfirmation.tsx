import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';

import styles from './BookingConfirmation.module.css';

const BookingConfirmation = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.booking.confirmedTitle}
          onBack={() => navigate('/lawyers')}
        />
        <div className={styles.content}>
          <h2 className={styles.title}>{ar.booking.confirmedTitle}</h2>
          <p className={styles.body}>{ar.booking.confirmedBody}</p>
        </div>
        <footer className={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/')}
          >
            {ar.payment.backHome}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default BookingConfirmation;
