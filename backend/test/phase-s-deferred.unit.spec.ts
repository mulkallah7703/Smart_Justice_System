import { InactiveNafathAdapter } from '../src/modules/auth/adapters/nafath/inactive-nafath.adapter';
import { DeferredPaymentProvider } from '../src/modules/payments/providers/deferred-payment.provider';

describe('Phase S deferred integrations', () => {
  it('inactive Nafath never pretends verification succeeded', async () => {
    const adapter = new InactiveNafathAdapter();
    await expect(
      adapter.verify({ nationalId: '1000000000', nafathCode: 12 }),
    ).rejects.toMatchObject({ code: 'AUTH_NAFATH_PROVIDER_UNAVAILABLE' });
  });

  it('deferred payment never creates fake transactions', async () => {
    const provider = new DeferredPaymentProvider();
    await expect(
      provider.createPayment({
        paymentId: 'pay-1',
        amountMinor: 100,
        currency: 'SAR',
        method: 'MADA',
        idempotencyKey: 'key-1',
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_DEFERRED' });

    expect(() =>
      provider.verifyAndParseWebhook(Buffer.from('{}'), {}),
    ).toThrow(
      expect.objectContaining({ code: 'PAYMENT_DEFERRED' }),
    );
  });
});
