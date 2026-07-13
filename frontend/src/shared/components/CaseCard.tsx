import Icon from './Icon';
import StatusBadge, { type StatusBadgeVariant } from './StatusBadge';
import styles from './CaseCard.module.css';

type CaseAccent = 'warning' | 'success';
type CaseFooterTone = 'danger' | 'success';

interface CaseFooter {
  tone: CaseFooterTone;
  icon: string;
  text: string;
}

interface CaseCardProps {
  title: string;
  caseNumber: string;
  status: string;
  statusVariant?: StatusBadgeVariant;
  icon?: string;
  onClick?: () => void;
  className?: string;
  layout?: 'compact' | 'detailed';
  accent?: CaseAccent;
  footer?: CaseFooter;
}

const CaseCard = ({
  title,
  caseNumber,
  status,
  statusVariant = 'pending',
  icon = 'domain',
  onClick,
  className = '',
  layout = 'compact',
  accent,
  footer,
}: CaseCardProps): JSX.Element => {
  const isDetailed = layout === 'detailed';

  const content = isDetailed ? (
    <>
      <div className={styles.detailedTop}>
        <div className={styles.detailedContent}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.subtitle}>{caseNumber}</p>
        </div>
        <StatusBadge
          label={status}
          variant={statusVariant}
          className={styles.badge}
        />
      </div>
      {footer ? (
        <div
          className={`${styles.footer} ${footer.tone === 'danger' ? styles.footerDanger : styles.footerSuccess}`}
        >
          <Icon name={footer.icon} size={16} className={styles.footerIcon} />
          <span className={styles.footerText}>{footer.text}</span>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <div className={styles.iconWrap}>
        <Icon name={icon} size={24} className={styles.icon} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.number}>{caseNumber}</p>
      </div>
      <StatusBadge
        label={status}
        variant={statusVariant}
        className={styles.badge}
      />
    </>
  );

  const accentClass =
    isDetailed && accent
      ? accent === 'warning'
        ? styles.accentWarning
        : styles.accentSuccess
      : '';

  const cardClass = `${styles.card} ${isDetailed ? styles.detailed : ''} ${accentClass} ${onClick ? styles.clickable : ''} ${className}`;

  if (onClick) {
    return (
      <button type="button" className={cardClass} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={cardClass}>{content}</article>;
};

export default CaseCard;
