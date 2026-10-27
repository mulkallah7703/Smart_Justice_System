import { useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import BottomNav from '../../shared/components/BottomNav';
import ScreenShell from '../../shared/components/ScreenShell';
import ScrollContent from '../../shared/components/ScrollContent';

import ActiveCasesList from './ActiveCasesList';
import HomeHeader from './HomeHeader';
import JudicialCardPreview from './JudicialCardPreview';
import ProactiveAlertBanner from './ProactiveAlertBanner';
import ServicesGrid from './ServicesGrid';
import { useHomeData } from './useHomeData';
import styles from './HomeScreen.module.css';

const HomeScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const { user, card, alert, services, cases, isLoading } = useHomeData();

  return (
    <ScreenShell variant="default">
      <div className={styles.screen}>
        <HomeHeader
          screenTitle={ar.home.screenTitle}
          greeting={user.greeting}
          userName={user.name}
        />

        {card ? (
          <div className={styles.cardWrap}>
            <JudicialCardPreview card={card} onClick={() => navigate('/card')} />
          </div>
        ) : null}

        <ScrollContent className={styles.content}>
          {alert ? (
            <ProactiveAlertBanner
              title={alert.title}
              subtitle={alert.subtitle}
              onClick={() => navigate('/alerts')}
            />
          ) : null}

          <ServicesGrid services={services} />

          {isLoading ? (
            <p role="status">{ar.home.loading}</p>
          ) : (
            <ActiveCasesList cases={cases} />
          )}
        </ScrollContent>

        <BottomNav />
      </div>
    </ScreenShell>
  );
};

export default HomeScreen;
