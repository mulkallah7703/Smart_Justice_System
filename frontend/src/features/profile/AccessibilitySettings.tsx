import { ar } from '../../core/i18n/ar';
import ToggleSwitch from '../../shared/components/ToggleSwitch';
import { settingsStore } from '../../shared/store/settingsStore';

import SettingsRow from './SettingsRow';
import SettingsSection from './SettingsSection';

const AccessibilitySettings = (): JSX.Element => {
  const largeFont = settingsStore((s) => s.largeFont);
  const highContrast = settingsStore((s) => s.highContrast);
  const darkMode = settingsStore((s) => s.darkMode);
  const setLargeFont = settingsStore((s) => s.setLargeFont);
  const setHighContrast = settingsStore((s) => s.setHighContrast);
  const setDarkMode = settingsStore((s) => s.setDarkMode);

  return (
    <SettingsSection title={ar.profile.sections.accessibility}>
      <SettingsRow icon="format_size" label={ar.profile.fields.largeFont}>
        <ToggleSwitch
          checked={largeFont}
          onChange={setLargeFont}
          ariaLabel={ar.profile.fields.largeFont}
        />
      </SettingsRow>
      <SettingsRow
        icon="contrast"
        label={ar.profile.fields.highContrast}
      >
        <ToggleSwitch
          checked={highContrast}
          onChange={setHighContrast}
          ariaLabel={ar.profile.fields.highContrast}
        />
      </SettingsRow>
      <SettingsRow icon="dark_mode" label={ar.profile.fields.darkMode}>
        <ToggleSwitch
          checked={darkMode}
          onChange={setDarkMode}
          ariaLabel={ar.profile.fields.darkMode}
        />
      </SettingsRow>
    </SettingsSection>
  );
};

export default AccessibilitySettings;
