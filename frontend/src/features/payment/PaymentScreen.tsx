import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';
import { formatMoneyAr } from '../../shared/utils/arabicNumerals';

import PaymentMethod from './PaymentMethod';
import PaymentSecurityBanner from './PaymentSecurityBanner';
import PaymentSummary from './PaymentSummary';
import { usePayment } from './usePayment';
import styles from './PaymentScreen.module.css';

const PaymentScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const { consultationId = 'consult-demo' } = useParams<{
    consultationId: string;
  }>();
  const {
    summary,
    isLoading,
    selectedMethod,
    setSelectedMethod,
    isPaying,
    canPay,
    statusMessage,
    errorMessage,
    canRetry,
    pay,
    retry,
  } = usePayment(consultationId);

  const handlePay = async (): Promise<void> => {
    const ok = await pay();
    if (ok) {
      navigate('/');
    }
  };

  const ctaLabel = summary
    ? `${ar.payment.cta} ${formatMoneyAr(summary.totalAmount)} ${summary.currency}`
    : ar.payment.cta;

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.payment.headerTitle}
          onBack={() => navigate(-1)}
          trailing={
            <span className={styles.lockBadge} aria-hidden>
              <Icon name="lock" size={20} className={styles.lockIcon} />
            </span>
          }
        />

        <div className={styles.content}>
          {!isLoading && summary ? (
            <>
              <PaymentSummary summary={summary} />
              <PaymentMethod
                selected={selectedMethod}
                onChange={setSelectedMethod}
              />
              <PaymentSecurityBanner />
            </>
          ) : null}
        </div>

        <footer className={styles.footer}>
          {statusMessage ? (
            <p className={styles.status} role="status">
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}

          {canRetry ? (
            <Button variant="primary" size="lg" fullWidth onClick={retry}>
              {ar.payment.retry}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon="lock"
              iconFilled
              disabled={!canPay}
              onClick={() => {
                void handlePay();
              }}
            >
              {isPaying ? ar.payment.paying : ctaLabel}
            </Button>
          )}
        </footer>
      </div>
    </ScreenShell>
  );
};

export default PaymentScreen;
