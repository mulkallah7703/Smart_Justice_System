import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

const ToggleSwitch = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: ToggleSwitchProps): JSX.Element => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${styles.switch} ${checked ? styles.on : styles.off}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} aria-hidden />
    </button>
  );
};

export default ToggleSwitch;
