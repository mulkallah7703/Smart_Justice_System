import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { authStore } from '../auth/authStore';

import SettingsRow from './SettingsRow';

const SecuritySettings = (): JSX.Element => {
  const navigate = useNavigate();

  const handleLogout = (): void => {
    authStore.getState().clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <SettingsRow
        icon="fingerprint"
        label={ar.profile.fields.biometric}
        showChevron
        onClick={() => undefined}
      />
      <SettingsRow
        icon="logout"
        label={ar.profile.fields.logout}
        showChevron
        onClick={handleLogout}
      />
    </>
  );
};

export default SecuritySettings;
