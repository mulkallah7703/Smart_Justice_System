import { ar } from '../../core/i18n/ar';
import ToggleSwitch from '../../shared/components/ToggleSwitch';
import { settingsStore } from '../../shared/store/settingsStore';

import SettingsRow from './SettingsRow';

const NotificationSettings = (): JSX.Element => {
  const alertsEnabled = settingsStore((s) => s.alertsEnabled);
  const setAlertsEnabled = settingsStore((s) => s.setAlertsEnabled);

  return (
    <SettingsRow
      icon="notifications_active"
      label={ar.profile.fields.proactiveAlerts}
    >
      <ToggleSwitch
        checked={alertsEnabled}
        onChange={setAlertsEnabled}
        ariaLabel={ar.profile.fields.proactiveAlerts}
      />
    </SettingsRow>
  );
};

export default NotificationSettings;
