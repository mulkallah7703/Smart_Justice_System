import { ar } from '../../core/i18n/ar';

import SettingsRow from './SettingsRow';

const SecuritySettings = (): JSX.Element => {
  return (
    <SettingsRow
      icon="fingerprint"
      label={ar.profile.fields.biometric}
      showChevron
      onClick={() => undefined}
    />
  );
};

export default SecuritySettings;
