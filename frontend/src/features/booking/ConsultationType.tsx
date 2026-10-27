import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import ConsultationTypePicker from '../../shared/components/ConsultationTypePicker';
import Header from '../../shared/components/Header';
import ScreenShell from '../../shared/components/ScreenShell';

import BookingSummary from './BookingSummary';
import DateTimePicker from './DateTimePicker';
import { useBooking } from './useBooking';
import styles from './ConsultationType.module.css';

const ConsultationType = (): JSX.Element => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const {
    types,
    dates,
    slots,
    selectedType,
    selectedDateId,
    selectedTimeId,
    setSelectedType,
    setSelectedDateId,
    setSelectedTimeId,
    isLoadingSlots,
    isSubmitting,
    canContinue,
    errorMessage,
    submitBooking,
  } = useBooking(id);

  const handleContinue = async (): Promise<void> => {
    const consultationId = await submitBooking(id);
    if (consultationId) {
      navigate(`/booking/confirmed/${consultationId}`);
    }
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header title={ar.booking.headerTitle} onBack={() => navigate(-1)} />

        <div className={styles.content}>
          <ConsultationTypePicker
            options={types}
            selected={selectedType}
            onChange={setSelectedType}
          />

          <DateTimePicker
            title={ar.booking.scheduleTitle}
            dates={dates}
            slots={slots}
            selectedDateId={selectedDateId}
            selectedTimeId={selectedTimeId}
            isLoading={isLoadingSlots}
            onDateChange={setSelectedDateId}
            onTimeChange={setSelectedTimeId}
          />
        </div>

        <footer className={styles.footer}>
          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}
          <BookingSummary />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canContinue}
            onClick={() => {
              void handleContinue();
            }}
          >
            {isSubmitting ? ar.booking.submitting : ar.booking.cta}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default ConsultationType;
