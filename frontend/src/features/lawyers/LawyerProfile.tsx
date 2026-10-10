import { useNavigate, useParams } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import Button from '../../shared/components/Button';
import ScreenShell from '../../shared/components/ScreenShell';
import StatsRow from '../../shared/components/StatsRow';

import ExpertiseTags from './ExpertiseTags';
import LawyerProfileHeader from './LawyerProfileHeader';
import ProfileDiscountBanner from './ProfileDiscountBanner';
import { useLawyerProfile } from './useLawyerProfile';
import styles from './LawyerProfile.module.css';

const LawyerProfile = (): JSX.Element => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { profile, isLoading, errorMessage, isFavorite, toggleFavorite } =
    useLawyerProfile(id);

  return (
    <ScreenShell variant="primary" noNav>
      <div className={styles.screen}>
        {!isLoading && profile ? (
          <>
            <LawyerProfileHeader
              profile={profile}
              isFavorite={isFavorite}
              reviewsLabel={ar.lawyers.profile.reviewsLabel}
              onBack={() => navigate(-1)}
              onToggleFavorite={toggleFavorite}
            />

            <div className={styles.sheet}>
              <div className={styles.content}>
                <StatsRow stats={profile.stats} />

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    {ar.lawyers.profile.bioTitle}
                  </h2>
                  <p className={styles.bio}>{profile.bio}</p>
                </section>

                <ExpertiseTags
                  title={ar.lawyers.profile.expertiseTitle}
                  tags={profile.expertiseTags}
                />

                <ProfileDiscountBanner
                  title={profile.discount.title}
                  subtitle={profile.discount.subtitle}
                />
              </div>

              <div className={styles.footer}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => navigate(`/lawyers/${profile.id}/book`)}
                >
                  {profile.cta}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {!isLoading && !profile && errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </ScreenShell>
  );
};

export default LawyerProfile;
