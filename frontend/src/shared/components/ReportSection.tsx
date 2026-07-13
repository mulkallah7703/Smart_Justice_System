import type { ReactNode } from 'react';

import Icon from './Icon';
import styles from './ReportSection.module.css';

interface ReportSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}

const ReportSection = ({
  title,
  icon,
  children,
  className = '',
}: ReportSectionProps): JSX.Element => {
  return (
    <section className={`${styles.section} ${className}`}>
      <div className={styles.header}>
        {icon ? (
          <div className={styles.iconWrap} aria-hidden="true">
            <Icon name={icon} size={20} />
          </div>
        ) : null}
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
};

export default ReportSection;
