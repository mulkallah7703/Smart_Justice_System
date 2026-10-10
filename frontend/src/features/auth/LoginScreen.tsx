import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { getUserFacingAuthError } from '../../shared/api/errors';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Input from '../../shared/components/Input';
import ScreenShell from '../../shared/components/ScreenShell';

import { login } from './authApi';
import { authStore } from './authStore';
import styles from './AuthForm.module.css';

const LoginScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    setFieldError(null);
    setFormError(null);

    if (!email.trim() || !password) {
      setFieldError(ar.auth.login.required);
      return;
    }

    setIsSubmitting(true);
    try {
      const { accessToken } = await login({ email: email.trim(), password });
      authStore.getState().setTokens(accessToken);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(getUserFacingAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell noNav variant="default">
      <div className={styles.screen}>
        <Header
          title={ar.auth.login.headerTitle}
          onBack={() => navigate('/onboarding')}
        />
        <main className={styles.main}>
          <section className={styles.intro}>
            <h1 className={styles.title}>{ar.auth.login.title}</h1>
            <p className={styles.description}>{ar.auth.login.description}</p>
          </section>

          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
            <Input
              id="login-email"
              label={ar.auth.fields.email}
              value={email}
              onChange={setEmail}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={ar.auth.fields.emailPlaceholder}
              icon="mail"
              error={fieldError ?? undefined}
            />
            <Input
              id="login-password"
              label={ar.auth.fields.password}
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              placeholder={ar.auth.fields.passwordPlaceholder}
              icon="lock"
            />
            {formError ? (
              <p className={styles.errorBanner} role="alert">
                {formError}
              </p>
            ) : null}
          </form>
        </main>

        <footer className={styles.footer}>
          <Button
            variant="primary"
            size="xl"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? ar.auth.login.submitting : ar.auth.login.cta}
          </Button>
          <p className={styles.switchRow}>
            {ar.auth.login.noAccount}
            <Link className={styles.switchLink} to="/register">
              {ar.auth.login.createAccount}
            </Link>
          </p>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default LoginScreen;
