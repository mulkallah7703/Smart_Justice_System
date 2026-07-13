import styles from './TabBar.module.css';

export interface TabBarItem {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: TabBarItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  ariaLabel?: string;
  className?: string;
}

const TabBar = ({
  tabs,
  active,
  onChange,
  variant = 'pill',
  ariaLabel,
  className = '',
}: TabBarProps): JSX.Element => {
  return (
    <div
      className={`${styles.bar} ${variant === 'underline' ? styles.underline : styles.pill} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
