import { ar } from '../../core/i18n/ar';
import BottomNav from '../../shared/components/BottomNav';
import ScreenShell from '../../shared/components/ScreenShell';
import TabBar from '../../shared/components/TabBar';

import AppointmentsTab from './AppointmentsTab';
import CasesTab from './CasesTab';
import DocumentsTab from './DocumentsTab';
import NotificationsTab from './NotificationsTab';
import { useLegalFile } from './useLegalFile';

import type { LegalFileTabId } from './legalFile.types';
import styles from './LegalFileScreen.module.css';

const tabs = [
  { id: 'cases' as const, label: ar.legalFile.tabs.cases },
  { id: 'appointments' as const, label: ar.legalFile.tabs.appointments },
  { id: 'documents' as const, label: ar.legalFile.tabs.documents },
  { id: 'notifications' as const, label: ar.legalFile.tabs.notifications },
];

const LegalFileScreen = (): JSX.Element => {
  const { activeTab, setActiveTab, cases, isLoading } = useLegalFile();

  return (
    <ScreenShell variant="default">
      <div className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>{ar.legalFile.headerTitle}</h1>
        </header>

        <div className={styles.tabs}>
          <TabBar
            tabs={tabs}
            active={activeTab}
            onChange={(id) => setActiveTab(id as LegalFileTabId)}
            ariaLabel={ar.legalFile.tabsAria}
          />
        </div>

        <div className={styles.content}>
          {activeTab === 'cases' ? (
            <CasesTab cases={cases} isLoading={isLoading} />
          ) : null}
          {activeTab === 'appointments' ? <AppointmentsTab /> : null}
          {activeTab === 'documents' ? <DocumentsTab /> : null}
          {activeTab === 'notifications' ? <NotificationsTab /> : null}
        </div>

        <BottomNav />
      </div>
    </ScreenShell>
  );
};

export default LegalFileScreen;
