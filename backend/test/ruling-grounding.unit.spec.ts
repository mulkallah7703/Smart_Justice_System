import { FACTUAL_RULINGS, scoreFactualRulings } from './fixtures/factual-rulings';
import {
  answerRulingQuestion,
  rewriteArabicLegalQuery,
} from '../src/modules/ai/providers/ruling-grounding';

describe('ruling grounding', () => {
  it('scores the synthetic rulings without mixing cases', () => {
    const texts = new Map(FACTUAL_RULINGS.map((ruling) => [ruling.id, ruling.clean]));
    const score = scoreFactualRulings(texts);
    expect(score.total).toBeGreaterThanOrEqual(24);
    expect(score.accuracy).toBe(1);
    expect(score.invertedRulingCount).toBe(0);
    expect(score.deadlinesFound).toBe(score.deadlineQuestions);
  });

  it('does not treat the claim section as the operative result', () => {
    const custody = FACTUAL_RULINGS.find((ruling) => ruling.id === 'custody')!;
    const outcome = custody.questions.find((question) => question.kind === 'outcome')!;
    expect(answerRulingQuestion(custody.clean, outcome)).toContain('حضانة الأب');
  });

  it('leaves an English retrieval query unchanged', () => {
    expect(rewriteArabicLegalQuery('  Exact legal query  ')).toBe('Exact legal query');
  });

  it('adds the operative heading to an Arabic outcome question', () => {
    expect(rewriteArabicLegalQuery('لمن الحضانة؟')).toContain('منطوق الحكم');
  });
});