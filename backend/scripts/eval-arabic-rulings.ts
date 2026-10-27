import { evaluateRenderedRulings } from '../test/fixtures/rendered-ruling-eval';

const main = async (): Promise<void> => {
  const report = await evaluateRenderedRulings();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.tessdata === 'missing' || report.ocrAccuracy <= 0 || report.qaAccuracy <= 0) {
    process.exitCode = 1;
  }
};

void main();
