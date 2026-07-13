import type { ButtonHTMLAttributes, ReactNode } from 'react';

import Icon from './Icon';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'ai' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
type IconTone = 'default' | 'gold';
type IconPosition = 'start' | 'end';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconFilled?: boolean;
  iconTone?: IconTone;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  children: ReactNode;
}

const Button = ({
  variant = 'primary',
  size = 'lg',
  icon,
  iconFilled = false,
  iconTone = 'default',
  iconPosition = 'start',
  fullWidth = true,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element => {
  const iconToneClass = iconTone === 'gold' ? styles.iconGold : '';
  const iconElement = icon ? (
    <Icon
      name={icon}
      size={20}
      filled={iconFilled}
      className={`${styles.icon} ${iconToneClass} ${iconPosition === 'end' ? styles.iconEnd : ''}`}
      ariaHidden
    />
  ) : null;

  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
      {...rest}
    >
      {iconPosition === 'start' ? iconElement : null}
      <span className={styles.label}>{children}</span>
      {iconPosition === 'end' ? iconElement : null}
    </button>
  );
};

export default Button;
