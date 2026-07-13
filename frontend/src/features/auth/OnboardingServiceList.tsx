import { ar } from '../../core/i18n/ar';
import FeatureCard from '../../shared/components/FeatureCard';

import styles from './OnboardingServiceList.module.css';

const serviceConfig = [
  { icon: 'explore', iconTone: 'primary' as const },
  { icon: 'auto_awesome', iconTone: 'blue' as const },
  { icon: 'groups', iconTone: 'warm' as const },
  { icon: 'credit_card', iconTone: 'neutral' as const },
];

const OnboardingServiceList = (): JSX.Element => {
  return (
    <ul className={styles.list}>
      {ar.onboarding.services.map((service, index) => (
        <li key={service.title} className={styles.item}>
          <FeatureCard
            title={service.title}
            description={service.description}
            icon={serviceConfig[index].icon}
            iconTone={serviceConfig[index].iconTone}
            variant="row"
          />
        </li>
      ))}
    </ul>
  );
};

export default OnboardingServiceList;
