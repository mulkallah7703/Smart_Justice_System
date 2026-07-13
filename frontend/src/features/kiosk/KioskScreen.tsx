import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';

import KioskCardReader from './KioskCardReader';
import KioskQRScanner from './KioskQRScanner';
import KioskQuickServices from './KioskQuickServices';
import { useKiosk } from './useKiosk';
import styles from './KioskScreen.module.css';

const KioskScreen = (): JSX.Element => {
  const {
    services,
    isBusy,
    authMode,
    scanQr,
    tapCard,
    runQuickService,
    toggleLanguageLabel,
    languageLabel,
  } = useKiosk();

  return (
    <ScreenShell variant="dark" noNav>
      <div className={styles.viewport}>
        <div className={styles.canvas}>
          <main className={styles.main}>
            <header className={styles.brand}>
              <span className={styles.brandBadge} aria-hidden>
                <Icon name="balance" size={24} className={styles.brandIcon} />
              </span>
              <div className={styles.brandText}>
                <h1 className={styles.brandTitle}>{ar.kiosk.brandTitle}</h1>
                <p className={styles.brandSubtitle}>{ar.kiosk.brandSubtitle}</p>
              </div>
            </header>

            <section className={styles.welcome}>
              <h2 className={styles.welcomeTitle}>{ar.kiosk.welcomeTitle}</h2>
              <p className={styles.welcomeBody}>{ar.kiosk.welcomeBody}</p>
            </section>

            <div className={styles.actions}>
              <KioskQRScanner
                onScan={() => {
                  void scanQr();
                }}
                disabled={isBusy}
                active={authMode === 'qr'}
              />
              <KioskCardReader
                onTap={() => {
                  void tapCard();
                }}
                disabled={isBusy}
                active={authMode === 'card'}
              />
            </div>
          </main>

          <KioskQuickServices
            services={services}
            languageLabel={languageLabel}
            onService={runQuickService}
            onToggleLanguage={toggleLanguageLabel}
          />
        </div>
      </div>
    </ScreenShell>
  );
};

export default KioskScreen;
