import type { ReactNode } from 'react';

import styles from './SettingsSection.module.css';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

const SettingsSection = ({
  title,
  children,
}: SettingsSectionProps): JSX.Element => {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.card}>{children}</div>
    </section>
  );
};

export default SettingsSection;
