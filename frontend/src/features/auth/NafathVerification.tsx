import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import AlertBanner from '../../shared/components/AlertBanner';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Input from '../../shared/components/Input';
import ScreenShell from '../../shared/components/ScreenShell';
import {
  formatNationalId,
  isValidNationalId,
  sanitizeNationalId,
} from '../../shared/utils/validators';

import { verifyNafath } from './authApi';
import { authStore } from './authStore';
import NafathCodeCard from './NafathCodeCard';
import { useNafathCountdown } from './useNafathCountdown';
import styles from './NafathVerification.module.css';

const NAFATH_CODE = 72;
const COUNTDOWN_SECONDS = 58;

const NafathVerification = (): JSX.Element => {
  const navigate = useNavigate();
  const { secondsLeft, isExpired } = useNafathCountdown(COUNTDOWN_SECONDS);
  const [nationalId, setNationalId] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedNationalId = useMemo(
    () => formatNationalId(nationalId),
    [nationalId],
  );

  const handleNationalIdChange = (value: string): void => {
    setNationalId(sanitizeNationalId(value));
    setInputError(null);
    setSubmitError(null);
  };

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!isValidNationalId(nationalId)) {
      setInputError(ar.nafath.idError);
      return;
    }

    setIsSubmitting(true);
    setInputError(null);
    setSubmitError(null);

    try {
      const { accessToken } = await verifyNafath({
        nationalId: sanitizeNationalId(nationalId),
        nafathCode: NAFATH_CODE,
      });

      authStore.getState().setTokens(accessToken);
      navigate('/auth/success', { replace: true });
    } catch {
      setSubmitError(ar.nafath.verifyError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting || !isValidNationalId(nationalId) || isExpired;

  return (
    <ScreenShell noNav variant="default">
      <div className={styles.screen}>
        <Header title={ar.nafath.headerTitle} onBack={handleBack} />

        <main className={styles.main}>
          <section className={styles.intro}>
            <h2 className={styles.title}>{ar.nafath.title}</h2>
            <p className={styles.description}>{ar.nafath.description}</p>
          </section>

          <Input
            id="national-id"
            label={ar.nafath.idLabel}
            value={formattedNationalId}
            onChange={handleNationalIdChange}
            placeholder={ar.nafath.idPlaceholder}
            icon="badge"
            inputMode="numeric"
            error={inputError ?? undefined}
          />

          <NafathCodeCard
            code={NAFATH_CODE}
            secondsLeft={secondsLeft}
            isExpired={isExpired}
          />

          {submitError ? (
            <AlertBanner message={submitError} variant="danger" />
          ) : null}

          <AlertBanner
            message={ar.nafath.securityNotice}
            variant="neutral"
            icon="lock"
          />
        </main>

        <footer className={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? ar.nafath.submitting : ar.nafath.cta}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default NafathVerification;
