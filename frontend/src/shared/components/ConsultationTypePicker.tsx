import Icon from './Icon';

import styles from './ConsultationTypePicker.module.css';

export type ConsultationTypeId =
  | 'INSTANT'
  | 'WRITTEN'
  | 'IN_PERSON'
  | 'REPRESENTATION';

type IconTone = 'primary' | 'blue' | 'warm' | 'gold';

export interface ConsultationTypeOption {
  id: ConsultationTypeId;
  title: string;
  subtitle: string;
  icon: string;
  iconTone: IconTone;
}

interface ConsultationTypePickerProps {
  options: ConsultationTypeOption[];
  selected: ConsultationTypeId;
  onChange: (id: ConsultationTypeId) => void;
  className?: string;
}

const iconToneClassMap: Record<IconTone, string> = {
  primary: styles.iconPrimary,
  blue: styles.iconBlue,
  warm: styles.iconWarm,
  gold: styles.iconGold,
};

const ConsultationTypePicker = ({
  options,
  selected,
  onChange,
  className = '',
}: ConsultationTypePickerProps): JSX.Element => {
  return (
    <div
      className={`${styles.list} ${className}`}
      role="radiogroup"
      aria-label="consultation-type"
    >
      {options.map((option) => {
        const isSelected = option.id === selected;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(option.id)}
          >
            <div
              className={`${styles.iconWrap} ${iconToneClassMap[option.iconTone]}`}
            >
              <Icon name={option.icon} size={24} />
            </div>

            <div className={styles.content}>
              <span className={styles.title}>{option.title}</span>
              <span className={styles.subtitle}>{option.subtitle}</span>
            </div>

            <span
              className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`}
              aria-hidden
            >
              {isSelected ? <span className={styles.radioDot} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ConsultationTypePicker;
