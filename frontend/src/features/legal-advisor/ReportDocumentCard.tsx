import Icon from '../../shared/components/Icon';

import type { AdvisoryReportData } from './advisor.types';
import styles from './ReportDocumentCard.module.css';

interface ReportDocumentCardProps {
  report: AdvisoryReportData;
}

const ReportDocumentCard = ({
  report,
}: ReportDocumentCardProps): JSX.Element => {
  return (
    <article className={styles.card}>
      <div className={styles.watermark} aria-hidden="true">
        <span className={styles.watermarkText}>{report.watermark}</span>
      </div>

      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden="true">
          <Icon name="balance" size={24} />
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.brandTitle}>{report.brandTitle}</p>
          <p className={styles.brandSubtitle}>{report.brandSubtitle}</p>
        </div>
      </div>

      <hr className={styles.divider} />

      <div className={styles.meta}>
        <p className={styles.metaItem}>{report.reference}</p>
        <p className={styles.metaItem}>{report.dateHijri}</p>
      </div>

      <div className={styles.body}>
        {report.sections.map((section) => (
          <section key={section.id} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            <p className={styles.sectionBody}>{section.body}</p>
          </section>
        ))}
      </div>

      <div className={styles.disclaimer} role="note">
        <Icon name="info" size={20} className={styles.disclaimerIcon} />
        <p className={styles.disclaimerText}>{report.disclaimer}</p>
      </div>
    </article>
  );
};

export default ReportDocumentCard;
