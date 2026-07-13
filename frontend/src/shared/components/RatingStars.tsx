import Icon from './Icon';
import styles from './RatingStars.module.css';

interface RatingStarsProps {
  rating: number;
  showValue?: boolean;
  className?: string;
}

const RatingStars = ({
  rating,
  showValue = true,
  className = '',
}: RatingStarsProps): JSX.Element => {
  return (
    <span className={`${styles.stars} ${className}`} aria-label={`تقييم ${rating}`}>
      <Icon name="star" size={16} filled />
      {showValue ? <span className={styles.value}>{rating.toFixed(1)}</span> : null}
    </span>
  );
};

export default RatingStars;
