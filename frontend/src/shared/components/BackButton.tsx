import Icon from './Icon';
import styles from './BackButton.module.css';

interface BackButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

const BackButton = ({
  onClick,
  ariaLabel = 'العودة للخلف',
  className = '',
}: BackButtonProps): JSX.Element => {
  return (
    <button
      type="button"
      className={`${styles.button} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Icon name="arrow_back" size={24} className={styles.icon} />
    </button>
  );
};

export default BackButton;
