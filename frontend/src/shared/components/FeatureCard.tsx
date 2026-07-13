import Icon from './Icon';
import styles from './FeatureCard.module.css';

type FeatureCardVariant = 'grid' | 'row';
type IconTone = 'primary' | 'blue' | 'warm' | 'neutral';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  iconTone?: IconTone;
  variant?: FeatureCardVariant;
  className?: string;
  onClick?: () => void;
}

const iconToneClassMap: Record<IconTone, string> = {
  primary: styles.iconPrimary,
  blue: styles.iconBlue,
  warm: styles.iconWarm,
  neutral: styles.iconNeutral,
};

const FeatureCard = ({
  title,
  description,
  icon,
  iconTone = 'primary',
  variant = 'grid',
  className = '',
  onClick,
}: FeatureCardProps): JSX.Element => {
  const variantClass = variant === 'row' ? styles.row : styles.grid;
  const Component = onClick ? 'button' : 'article';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`${styles.card} ${variantClass} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
    >
      <div className={`${styles.iconWrap} ${iconToneClassMap[iconTone]}`}>
        <Icon name={icon} size={24} className={styles.icon} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </Component>
  );
};

export default FeatureCard;
