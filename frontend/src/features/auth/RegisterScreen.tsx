import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ar } from '../../core/i18n/ar';
import { getUserFacingAuthError } from '../../shared/api/errors';
import Button from '../../shared/components/Button';
import Header from '../../shared/components/Header';
import Input from '../../shared/components/Input';
import ScreenShell from '../../shared/components/ScreenShell';

import { register } from './authApi';
import styles from './AuthForm.module.css';

const MIN_PASSWORD = 8;

const RegisterScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    setFieldError(null);
    setFormError(null);

    if (name.trim().length < 2) {
      setFieldError(ar.auth.register.nameError);
      return;
    }
    if (!email.trim().includes('@')) {
      setFieldError(ar.auth.register.emailError);
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFieldError(ar.auth.register.passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError(ar.auth.register.confirmError);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      navigate('/login', { replace: true });
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
          title={ar.auth.register.headerTitle}
          onBack={() => navigate('/login')}
        />
        <main className={styles.main}>
          <section className={styles.intro}>
            <h1 className={styles.title}>{ar.auth.register.title}</h1>
            <p className={styles.description}>{ar.auth.register.description}</p>
          </section>

          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
            <Input
              id="register-name"
              label={ar.auth.fields.name}
              value={name}
              onChange={setName}
              autoComplete="name"
              placeholder={ar.auth.fields.namePlaceholder}
              icon="person"
              error={fieldError ?? undefined}
            />
            <Input
              id="register-email"
              label={ar.auth.fields.email}
              value={email}
              onChange={setEmail}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={ar.auth.fields.emailPlaceholder}
              icon="mail"
            />
            <Input
              id="register-password"
              label={ar.auth.fields.password}
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
              placeholder={ar.auth.fields.passwordPlaceholder}
              icon="lock"
            />
            <Input
              id="register-confirm"
              label={ar.auth.fields.confirmPassword}
              value={confirmPassword}
              onChange={setConfirmPassword}
              type="password"
              autoComplete="new-password"
              placeholder={ar.auth.fields.confirmPasswordPlaceholder}
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
            {isSubmitting ? ar.auth.register.submitting : ar.auth.register.cta}
          </Button>
          <p className={styles.switchRow}>
            {ar.auth.register.hasAccount}
            <Link className={styles.switchLink} to="/login">
              {ar.auth.register.login}
            </Link>
          </p>
        </footer>
      </div>
    </ScreenShell>
  );
};

export default RegisterScreen;
