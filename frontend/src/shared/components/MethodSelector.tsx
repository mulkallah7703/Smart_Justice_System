import Icon from './Icon';

import styles from './MethodSelector.module.css';

export type PaymentMethodId = 'APPLE_PAY' | 'MADA';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  kind: 'applePay' | 'mada';
}

interface MethodSelectorProps {
  options: PaymentMethodOption[];
  selected: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
  className?: string;
}

const MethodSelector = ({
  options,
  selected,
  onChange,
  className = '',
}: MethodSelectorProps): JSX.Element => {
  return (
    <div
      className={`${styles.list} ${className}`}
      role="radiogroup"
      aria-label="payment-method"
    >
      {options.map((option) => {
        const isSelected = option.id === selected;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.option} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(option.id)}
          >
            <div className={styles.brand}>
              {option.kind === 'applePay' ? (
                <span className={styles.applePayMark} aria-label={option.label}>
                  <span className={styles.appleGlyph} aria-hidden>
                    <svg
                      className={styles.appleSvg}
                      viewBox="0 0 14 17"
                      xmlns="http://www.w3.org/2000/svg"
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M10.95 8.96c-.02-2.04 1.66-3.02 1.74-3.07-0.95-1.39-2.43-1.58-2.95-1.6-1.25-.13-2.45.74-3.08.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.35 2.03-1.43 2.48-.37 6.15 1.03 8.16.68.98 1.5 2.08 2.56 2.04 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.7.65 1.12-.02 1.82-1 2.5-1.99.77-1.13 1.09-2.23 1.11-2.28-.02-.01-2.13-.82-2.15-3.31zM8.95 2.9c.56-.69.95-1.64.84-2.6-.81.03-1.8.54-2.38 1.22-.52.61-.98 1.58-.86 2.51.91.07 1.84-.46 2.4-1.13z"
                      />
                    </svg>
                  </span>
                  <span className={styles.applePayText}>Pay</span>
                </span>
              ) : (
                <>
                  <span className={styles.madaIcon} aria-hidden>
                    <Icon name="account_balance_wallet" size={20} />
                  </span>
                  <span className={styles.label}>{option.label}</span>
                </>
              )}
            </div>

            <span
              className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}
              aria-hidden
            >
              {isSelected ? (
                <Icon name="check" size={16} className={styles.checkIcon} />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default MethodSelector;
