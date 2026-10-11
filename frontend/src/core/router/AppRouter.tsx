import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { PublicOnly, RequireAuth } from './RequireAuth';

const SplashScreen = lazy(() => import('../../features/auth/SplashScreen'));
const OnboardingScreen = lazy(() => import('../../features/auth/OnboardingScreen'));
const LoginScreen = lazy(() => import('../../features/auth/LoginScreen'));
const RegisterScreen = lazy(() => import('../../features/auth/RegisterScreen'));
const HomeScreen = lazy(() => import('../../features/home/HomeScreen'));
const AlertsCenter = lazy(() => import('../../features/alerts/AlertsCenter'));
const LegalGuideChat = lazy(
  () => import('../../features/legal-guide/LegalGuideChat'),
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
const CaseDetailScreen = lazy(
  () => import('../../features/legal-file/CaseDetailScreen'),
);
const KioskScreen = lazy(() => import('../../features/kiosk/KioskScreen'));
const ProfileScreen = lazy(
  () => import('../../features/profile/ProfileScreen'),
);

const AppRouter = (): JSX.Element => {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginScreen />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterScreen />
            </PublicOnly>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <HomeScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireAuth>
              <AlertsCenter />
            </RequireAuth>
          }
        />
        <Route
          path="/guide"
          element={
            <RequireAuth>
              <LegalGuideChat />
            </RequireAuth>
          }
        />
        {/* Clarifications are asked in the chat, one model-chosen question at a time. */}
        <Route path="/guide/question" element={<Navigate to="/guide" replace />} />
        <Route
          path="/guide/summary/:sessionId"
          element={
            <RequireAuth>
              <GuidanceSummary />
            </RequireAuth>
          }
        />
        <Route
          path="/advisor"
          element={
            <RequireAuth>
              <DocumentUpload />
            </RequireAuth>
          }
        />
        <Route
          path="/advisor/analyzing"
          element={
            <RequireAuth>
              <AnalyzingLoader />
            </RequireAuth>
          }
        />
        <Route
          path="/advisor/opinion"
          element={
            <RequireAuth>
              <InitialOpinion />
            </RequireAuth>
          }
        />
        <Route
          path="/advisor/report/:jobId"
          element={
            <RequireAuth>
              <AdvisoryReport />
            </RequireAuth>
          }
        />
        <Route
          path="/lawyers"
          element={
            <RequireAuth>
              <LawyersList />
            </RequireAuth>
          }
        />
        <Route
          path="/lawyers/:id"
          element={
            <RequireAuth>
              <LawyerProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/lawyers/:id/book"
          element={
            <RequireAuth>
              <ConsultationType />
            </RequireAuth>
          }
        />
        <Route
          path="/payment/:consultationId"
          element={
            <RequireAuth>
              <PaymentScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/card"
          element={
            <RequireAuth>
              <JudicialCardScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/card/upgrade"
          element={
            <RequireAuth>
              <CardTierUpgrade />
            </RequireAuth>
          }
        />
        <Route
          path="/legal-file"
          element={
            <RequireAuth>
              <LegalFileScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/legal-file/:caseId"
          element={
            <RequireAuth>
              <CaseDetailScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/kiosk"
          element={
            <RequireAuth>
              <KioskScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfileScreen />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
