import Icon from './Icon';
import styles from './Avatar.module.css';

type AvatarTone = 'primary' | 'neutral' | 'gold';
type AvatarSize = 48 | 56 | 72;

interface AvatarProps {
  name?: string;
  src?: string;
  tone?: AvatarTone;
  size?: AvatarSize;
  verified?: boolean;
  className?: string;
}

const toneClassMap: Record<AvatarTone, string> = {
  primary: styles.primary,
  neutral: styles.neutral,
  gold: styles.gold,
};

const sizeClassMap: Record<AvatarSize, string> = {
  48: styles.size48,
  56: styles.size56,
  72: styles.size72,
};

const Avatar = ({
  name,
  src,
  tone = 'primary',
  size = 56,
  verified = false,
  className = '',
}: AvatarProps): JSX.Element => {
  return (
    <div
      className={`${styles.avatar} ${sizeClassMap[size]} ${toneClassMap[tone]} ${className}`}
      aria-label={name}
    >
      {src ? (
        <img className={styles.image} src={src} alt="" />
      ) : (
        <Icon name="person" size={28} />
      )}
      {verified ? (
        <span className={styles.badge} aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
      ) : null}
    </div>
  );
};

export default Avatar;
