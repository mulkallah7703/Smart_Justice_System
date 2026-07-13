import { useNavigate } from 'react-router-dom';

import FeatureCard from '../../shared/components/FeatureCard';

import type { HomeService } from './home.types';
import styles from './ServicesGrid.module.css';

interface ServicesGridProps {
  services: HomeService[];
}

const ServicesGrid = ({ services }: ServicesGridProps): JSX.Element => {
  const navigate = useNavigate();

  return (
    <div className={styles.grid}>
      {services.map((service) => (
        <FeatureCard
          key={service.title}
          title={service.title}
          description={service.description}
          icon={service.icon}
          iconTone={service.iconTone}
          variant="grid"
          className={styles.card}
          onClick={() => navigate(service.route)}
        />
      ))}
    </div>
  );
};

export default ServicesGrid;
