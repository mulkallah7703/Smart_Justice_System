import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import BackButton from '../../shared/components/BackButton';
import Button from '../../shared/components/Button';
import ScreenShell from '../../shared/components/ScreenShell';
import TierCompare from '../../shared/components/TierCompare';

import { useCardUpgrade } from './useCardUpgrade';

import type { CardTier } from './card.types';
import styles from './CardTierUpgrade.module.css';

const CardTierUpgrade = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    selectedTier,
    setSelectedTier,
    tiers,
    isLoading,
    isSubmitting,
    canUpgrade,
    errorMessage,
    submitUpgrade,
  } = useCardUpgrade();

  const ctaLabel =
    selectedTier === 'GOLD'
      ? ar.judicialCard.upgrade.ctaGold
      : selectedTier === 'SILVER'
        ? ar.judicialCard.upgrade.ctaSilver
        : ar.judicialCard.upgrade.ctaNormal;

  const handleUpgrade = async (): Promise<void> => {
    const ok = await submitUpgrade();
    if (ok) {
      navigate('/card');
    }
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <BackButton onClick={() => navigate(-1)} />
            <h1 className={styles.title}>
              {ar.judicialCard.upgrade.headerTitle}
            </h1>
          </div>
          <p className={styles.subtitle}>{ar.judicialCard.upgrade.subtitle}</p>
        </header>

        <div className={styles.content}>
          {errorMessage ? (
            <p className={styles.subtitle} role="alert">
              {errorMessage}
            </p>
          ) : null}
          {!isLoading ? (
            <TierCompare
              options={tiers}
              selected={selectedTier}
              onChange={(id) => setSelectedTier(id as CardTier)}
            />
          ) : null}
        </div>

        <footer className={styles.footer}>
          <Button
            variant="gold"
            size="lg"
            fullWidth
            icon="workspace_premium"
            iconFilled
            disabled={!canUpgrade}
            onClick={() => {
              void handleUpgrade();
            }}
          >
            {isSubmitting ? ar.judicialCard.upgrade.submitting : ctaLabel}
          </Button>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default CardTierUpgrade;
