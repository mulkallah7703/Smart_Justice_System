import { ar } from '../../core/i18n/ar';
import Avatar from '../../shared/components/Avatar';
import Button from '../../shared/components/Button';
import RatingStars from '../../shared/components/RatingStars';

import type { Lawyer } from './lawyers.types';
import styles from './LawyerCard.module.css';

interface LawyerCardProps {
  lawyer: Lawyer;
  onOpen: (id: string) => void;
  onBook: (id: string) => void;
}

const LawyerCard = ({
  lawyer,
  onOpen,
  onBook,
}: LawyerCardProps): JSX.Element => {
  const badgeClass =
    lawyer.availabilityTone === 'available'
      ? styles.badgeAvailable
      : styles.badgeSoon;

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.top}
        onClick={() => onOpen(lawyer.id)}
      >
        <Avatar
          name={lawyer.name}
          tone={lawyer.avatarTone}
          verified={lawyer.isVerified}
          size={56}
        />
        <div className={styles.main}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{lawyer.name}</h3>
            <span className={`${styles.badge} ${badgeClass}`}>
              {lawyer.availabilityLabel}
            </span>
          </div>
          <p className={styles.title}>{lawyer.title}</p>
          <div className={styles.meta}>
            <RatingStars rating={lawyer.rating} />
            <span className={styles.reviews}>
              ({lawyer.reviewCount} {ar.lawyers.reviews})
            </span>
            <span className={styles.experience}>
              {lawyer.experienceYrs} {ar.lawyers.experienceYears}
            </span>
          </div>
        </div>
      </button>

      <div className={styles.footer}>
        <p className={styles.price}>
          {ar.lawyers.priceFrom}{' '}
          <span className={styles.priceValue}>{lawyer.priceFrom}</span>{' '}
          {ar.lawyers.currency}
        </p>
        <Button
          variant="primary"
          size="sm"
          fullWidth={false}
          className={styles.bookBtn}
          onClick={() => onBook(lawyer.id)}
        >
          {ar.lawyers.book}
        </Button>
      </div>
    </article>
  );
};

export default LawyerCard;
