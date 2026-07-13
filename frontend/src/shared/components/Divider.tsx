import styles from './Divider.module.css';

interface DividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const Divider = ({
  className = '',
  orientation = 'horizontal',
}: DividerProps): JSX.Element => {
  const orientationClass =
    orientation === 'vertical' ? styles.vertical : styles.horizontal;

  return (
    <div
      className={`${styles.divider} ${orientationClass} ${className}`}
      role="separator"
      aria-orientation={orientation}
    />
  );
};

export default Divider;
