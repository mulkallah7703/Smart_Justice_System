import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Icon from '../../shared/components/Icon';
import ScreenShell from '../../shared/components/ScreenShell';

import ReportDocumentCard from './ReportDocumentCard';
import { downloadAdvisoryReportPdf } from './advisorApi';
import { useAdvisoryReport } from './useAdvisoryReport';
import styles from './AdvisoryReport.module.css';

const AdvisoryReport = (): JSX.Element => {
  const navigate = useNavigate();
  const { jobId = 'demo' } = useParams<{ jobId: string }>();
  const { report, isLoading } = useAdvisoryReport(jobId);

  const handleShare = async (): Promise<void> => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: ar.advisor.report.headerTitle,
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
      return;
    }
    void navigator.clipboard?.writeText(shareUrl);
  };

  const handleDownloadPdf = async (): Promise<void> => {
    const url = await downloadAdvisoryReportPdf(jobId);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <ScreenShell variant="default" noNav>
      <div className={styles.screen}>
        <Header
          title={ar.advisor.report.headerTitle}
          onBack={() => navigate(-1)}
          trailing={
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={ar.advisor.report.shareAria}
                onClick={() => {
                  void handleShare();
                }}
              >
                <Icon name="ios_share" size={20} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={ar.advisor.report.downloadAria}
                onClick={() => {
                  void handleDownloadPdf();
                }}
              >
                <Icon name="download" size={20} />
              </button>
            </div>
          }
        />

        <div className={styles.content}>
          {!isLoading && report ? <ReportDocumentCard report={report} /> : null}
        </div>

        <div className={styles.footer}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/legal-file')}
          >
            {ar.advisor.report.saveToFile}
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon="picture_as_pdf"
            className={styles.pdfBtn}
            onClick={() => {
              void handleDownloadPdf();
            }}
          >
            {ar.advisor.report.downloadPdf}
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
};

export default AdvisoryReport;
