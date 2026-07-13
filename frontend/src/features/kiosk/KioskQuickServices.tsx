import { ar } from '../../core/i18n/ar';
import Icon from '../../shared/components/Icon';

import type { KioskQuickService, KioskQuickServiceId } from './kiosk.types';
import styles from './KioskQuickServices.module.css';

interface KioskQuickServicesProps {
  services: KioskQuickService[];
  languageLabel: string;
  onService: (id: KioskQuickServiceId) => void;
  onToggleLanguage: () => void;
}

const KioskQuickServices = ({
  services,
  languageLabel,
  onService,
  onToggleLanguage,
}: KioskQuickServicesProps): JSX.Element => {
  return (
    <aside className={styles.sidebar} aria-label={ar.kiosk.servicesTitle}>
      <h2 className={styles.title}>{ar.kiosk.servicesTitle}</h2>

      <div className={styles.list}>
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            className={styles.card}
            onClick={() => onService(service.id)}
          >
            <span className={styles.iconWrap} aria-hidden>
              <Icon name={service.icon} size={24} className={styles.icon} />
            </span>
            <span className={styles.label}>{service.label}</span>
            <Icon
              name="chevron_left"
              size={20}
              className={styles.chevron}
              ariaHidden
            />
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.sync}>
          <Icon name="sync" size={16} className={styles.syncIcon} />
          <span>{ar.kiosk.syncLabel}</span>
        </p>
        <button
          type="button"
          className={styles.lang}
          onClick={onToggleLanguage}
        >
          <Icon name="language" size={16} className={styles.langIcon} />
          <span>{languageLabel}</span>
        </button>
      </div>
    </aside>
  );
};

export default KioskQuickServices;
