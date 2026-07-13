import { NavLink } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Icon from './Icon';
import styles from './BottomNav.module.css';

const navItems = [
  { id: 'home', label: ar.home.nav.home, icon: 'home', to: '/' },
  { id: 'guide', label: ar.home.nav.guide, icon: 'explore', to: '/guide' },
  { id: 'advisor', label: ar.home.nav.advisor, icon: 'auto_awesome', to: '/advisor' },
  { id: 'lawyers', label: ar.home.nav.lawyers, icon: 'groups', to: '/lawyers' },
  { id: 'card', label: ar.home.nav.card, icon: 'credit_card', to: '/card' },
] as const;

const BottomNav = (): JSX.Element => {
  return (
    <nav className={styles.nav} aria-label={ar.home.nav.ariaLabel}>
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.active : ''}`
          }
          end={item.to === '/'}
        >
          {({ isActive }) => (
            <>
              <Icon
                name={item.icon}
                size={24}
                filled={isActive}
                className={styles.icon}
              />
              <span className={styles.label}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
