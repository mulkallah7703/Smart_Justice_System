import Icon from './Icon';

import styles from './TierCompare.module.css';

export type TierCompareId = 'NORMAL' | 'SILVER' | 'GOLD';

export interface TierCompareOption {
  id: TierCompareId;
  title: string;
  description: string;
  priceLabel: string;
  icon: string;
  badge?: 'featured' | 'current' | null;
  badgeLabel?: string;
}

interface TierCompareProps {
  options: TierCompareOption[];
  selected: TierCompareId;
  onChange: (id: TierCompareId) => void;
  className?: string;
}

const TierCompare = ({
  options,
  selected,
  onChange,
  className = '',
}: TierCompareProps): JSX.Element => {
  return (
    <div
      className={`${styles.list} ${className}`}
      role="radiogroup"
      aria-label="card-tier"
    >
      {options.map((option) => {
        const isSelected = option.id === selected;
        const isGold = option.id === 'GOLD';
        const isSilver = option.id === 'SILVER';

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.card} ${isSelected ? styles.selected : ''} ${isGold && isSelected ? styles.selectedGold : ''}`}
            onClick={() => onChange(option.id)}
          >
            <div className={styles.top}>
              <div className={styles.titleRow}>
                <span
                  className={`${styles.iconWrap} ${isGold ? styles.iconGold : isSilver ? styles.iconSilver : styles.iconNormal}`}
                  aria-hidden
                >
                  <Icon name={option.icon} size={24} />
                </span>
                <span
                  className={`${styles.title} ${isGold ? styles.titleGold : ''}`}
                >
                  {option.title}
                </span>
              </div>

              {option.badge && option.badgeLabel ? (
                <span
                  className={`${styles.badge} ${option.badge === 'featured' ? styles.badgeFeatured : styles.badgeCurrent}`}
                >
                  {option.badgeLabel}
                </span>
              ) : null}
            </div>

            <p className={styles.description}>{option.description}</p>
            <p className={styles.price}>{option.priceLabel}</p>
          </button>
        );
      })}
    </div>
  );
};

export default TierCompare;
