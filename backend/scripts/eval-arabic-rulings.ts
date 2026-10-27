import { evaluateCorruptedRulings } from '../test/fixtures/corrupted-rulings';

const main = async (): Promise<void> => {
  const report = await evaluateCorruptedRulings();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.chosenAccuracy <= report.textLayerAccuracy || report.chosenAccuracy < 0.75) {
    process.exitCode = 1;
  }
};

void main();
