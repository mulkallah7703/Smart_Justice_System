import styles from './Icon.module.css';

type IconSize = 16 | 20 | 24 | 28 | 32 | 40 | 48;

interface IconProps {
  name: string;
  size?: IconSize;
  filled?: boolean;
  className?: string;
  ariaHidden?: boolean;
}

const sizeClassMap: Record<IconSize, string> = {
  16: styles.size16,
  20: styles.size20,
  24: styles.size24,
  28: styles.size28,
  32: styles.size32,
  40: styles.size40,
  48: styles.size48,
};

const Icon = ({
  name,
  size = 24,
  filled = false,
  className = '',
  ariaHidden = true,
}: IconProps): JSX.Element => {
  return (
    <span
      className={`material-symbols-rounded ${styles.icon} ${sizeClassMap[size]} ${filled ? styles.filled : ''} ${className}`}
      aria-hidden={ariaHidden}
    >
      {name}
    </span>
  );
};

export default Icon;
