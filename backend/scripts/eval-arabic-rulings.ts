import {
  evaluateFactualRulings,
  evaluateRenderedRulings,
} from '../test/fixtures/rendered-ruling-eval';

const main = async (): Promise<void> => {
  const rendered = await evaluateRenderedRulings();
  const factual = await evaluateFactualRulings();
  process.stdout.write(
    `${JSON.stringify({ rendered, factual }, null, 2)}\n`,
  );
  const failed =
    rendered.tessdata === 'missing' ||
    rendered.ocrAccuracy <= 0 ||
    rendered.qaAccuracy <= 0 ||
    factual.cleanAccuracy < 0.8 ||
    factual.ocrAccuracy < 0.8 ||
    factual.invertedRulingCount > 0 ||
    factual.deadlinesFound < factual.deadlineQuestions;
  if (failed) {
    process.exitCode = 1;
  }
};

void main();
