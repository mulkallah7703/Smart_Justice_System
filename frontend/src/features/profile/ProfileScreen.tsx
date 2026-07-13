import { ar } from '../../core/i18n/ar';
import ScreenShell from '../../shared/components/ScreenShell';

import AccessibilitySettings from './AccessibilitySettings';
import LanguageSettings from './LanguageSettings';
import NotificationSettings from './NotificationSettings';
import ProfileHeader from './ProfileHeader';
import SecuritySettings from './SecuritySettings';
import SettingsSection from './SettingsSection';
import { useProfile } from './useProfile';
import styles from './ProfileScreen.module.css';

const ProfileScreen = (): JSX.Element => {
  const { profile, isLoading } = useProfile();

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        {!isLoading && profile ? (
          <>
            <ProfileHeader
              profile={profile}
              onEdit={() => undefined}
            />

            <div className={styles.content}>
              <LanguageSettings />
              <AccessibilitySettings />
              <SettingsSection title={ar.profile.sections.securityNotifications}>
                <NotificationSettings />
                <SecuritySettings />
              </SettingsSection>
            </div>
          </>
        ) : null}
      </div>
    </ScreenShell>
  );
};

export default ProfileScreen;
