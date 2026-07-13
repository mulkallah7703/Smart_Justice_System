import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const SplashScreen = lazy(() => import('../../features/auth/SplashScreen'));
const OnboardingScreen = lazy(() => import('../../features/auth/OnboardingScreen'));
const NafathVerification = lazy(() => import('../../features/auth/NafathVerification'));
const FileCreatedSuccess = lazy(() => import('../../features/auth/FileCreatedSuccess'));
const HomeScreen = lazy(() => import('../../features/home/HomeScreen'));
const AlertsCenter = lazy(() => import('../../features/alerts/AlertsCenter'));
const LegalGuideChat = lazy(
  () => import('../../features/legal-guide/LegalGuideChat'),
);
const ClarifyingQuestion = lazy(
  () => import('../../features/legal-guide/ClarifyingQuestion'),
);
const GuidanceSummary = lazy(
  () => import('../../features/legal-guide/GuidanceSummary'),
);
const DocumentUpload = lazy(
  () => import('../../features/legal-advisor/DocumentUpload'),
);
const AnalyzingLoader = lazy(
  () => import('../../features/legal-advisor/AnalyzingLoader'),
);
const InitialOpinion = lazy(
  () => import('../../features/legal-advisor/InitialOpinion'),
);
const AdvisoryReport = lazy(
  () => import('../../features/legal-advisor/AdvisoryReport'),
);
const LawyersList = lazy(() => import('../../features/lawyers/LawyersList'));
const LawyerProfile = lazy(() => import('../../features/lawyers/LawyerProfile'));
const ConsultationType = lazy(
  () => import('../../features/booking/ConsultationType'),
);
const PaymentScreen = lazy(
  () => import('../../features/payment/PaymentScreen'),
);
const JudicialCardScreen = lazy(
  () => import('../../features/judicial-card/JudicialCardScreen'),
);
const CardTierUpgrade = lazy(
  () => import('../../features/judicial-card/CardTierUpgrade'),
);
const LegalFileScreen = lazy(
  () => import('../../features/legal-file/LegalFileScreen'),
);
const KioskScreen = lazy(() => import('../../features/kiosk/KioskScreen'));
const ProfileScreen = lazy(
  () => import('../../features/profile/ProfileScreen'),
);

const AppRouter = (): JSX.Element => {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/alerts" element={<AlertsCenter />} />
        <Route path="/guide" element={<LegalGuideChat />} />
        <Route path="/guide/question" element={<ClarifyingQuestion />} />
        <Route
          path="/guide/summary/:sessionId"
          element={<GuidanceSummary />}
        />
        <Route path="/advisor" element={<DocumentUpload />} />
        <Route path="/advisor/analyzing" element={<AnalyzingLoader />} />
        <Route path="/advisor/opinion" element={<InitialOpinion />} />
        <Route path="/advisor/report/:jobId" element={<AdvisoryReport />} />
        <Route path="/lawyers" element={<LawyersList />} />
        <Route path="/lawyers/:id" element={<LawyerProfile />} />
        <Route path="/lawyers/:id/book" element={<ConsultationType />} />
        <Route
          path="/payment/:consultationId"
          element={<PaymentScreen />}
        />
        <Route path="/card" element={<JudicialCardScreen />} />
        <Route path="/card/upgrade" element={<CardTierUpgrade />} />
        <Route path="/legal-file" element={<LegalFileScreen />} />
        <Route path="/kiosk" element={<KioskScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/auth/verify" element={<NafathVerification />} />
        <Route path="/auth/success" element={<FileCreatedSuccess />} />
        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
