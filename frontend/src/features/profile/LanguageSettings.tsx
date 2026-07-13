import { ar } from '../../core/i18n/ar';
import SegmentedControl from '../../shared/components/SegmentedControl';
import { settingsStore } from '../../shared/store/settingsStore';

import SettingsRow from './SettingsRow';
import SettingsSection from './SettingsSection';

const LanguageSettings = (): JSX.Element => {
  const language = settingsStore((s) => s.language);
  const calendar = settingsStore((s) => s.calendar);
  const numerals = settingsStore((s) => s.numerals);
  const setCalendar = settingsStore((s) => s.setCalendar);
  const setNumerals = settingsStore((s) => s.setNumerals);

  return (
    <SettingsSection title={ar.profile.sections.languageDisplay}>
      <SettingsRow
        icon="translate"
        label={ar.profile.fields.language}
        trailingText={
          language === 'ar'
            ? ar.profile.values.arabic
            : ar.profile.values.english
        }
        showChevron
        onClick={() => undefined}
      />
      <SettingsRow icon="calendar_month" label={ar.profile.fields.calendar}>
        <SegmentedControl
          ariaLabel={ar.profile.fields.calendar}
          value={calendar}
          onChange={setCalendar}
          options={[
            { id: 'hijri', label: ar.profile.values.hijri },
            { id: 'gregorian', label: ar.profile.values.gregorian },
          ]}
        />
      </SettingsRow>
      <SettingsRow icon="pin" label={ar.profile.fields.numerals}>
        <SegmentedControl
          ariaLabel={ar.profile.fields.numerals}
          value={numerals}
          onChange={setNumerals}
          options={[
            { id: 'arabic', label: ar.profile.values.numeralsArabic },
            { id: 'western', label: ar.profile.values.numeralsWestern },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  );
};

export default LanguageSettings;
