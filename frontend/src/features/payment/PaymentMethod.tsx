import { ar } from '../../core/i18n/ar';
import MethodSelector from '../../shared/components/MethodSelector';

import type { PaymentMethodId } from './payment.types';
import styles from './PaymentMethod.module.css';

interface PaymentMethodProps {
  selected: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
}

const PaymentMethod = ({
  selected,
  onChange,
}: PaymentMethodProps): JSX.Element => {
  const options = [
    {
      id: 'APPLE_PAY' as const,
      label: ar.payment.methods.applePay,
      kind: 'applePay' as const,
    },
    {
      id: 'MADA' as const,
      label: ar.payment.methods.mada,
      kind: 'mada' as const,
    },
  ];

  return (
    <section className={styles.section} aria-label={ar.payment.methodsTitle}>
      <h2 className={styles.title}>{ar.payment.methodsTitle}</h2>
      <MethodSelector
        options={options}
        selected={selected}
        onChange={onChange}
      />
    </section>
  );
};

export default PaymentMethod;
