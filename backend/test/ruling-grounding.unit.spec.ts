import { FACTUAL_RULINGS, scoreFactualRulings } from './fixtures/factual-rulings';
import {
  answerRulingQuestion,
  guardGroundedAnswer,
  rewriteArabicLegalQuery,
  UNSURE_ANSWER_AR,
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

  it('rewrites an appealable claim when the operative text is final', () => {
    const guarded = guardGroundedAnswer({
      query: 'هل الحكم ابتدائي؟',
      answer: 'الحكم ابتدائي وقابل للاستئناف',
      claims: [{ text: 'الحكم ابتدائي وقابل للاستئناف', evidenceIds: ['E1'] }],
      insufficientEvidence: false,
      evidence: [
        {
          evidenceId: 'E1',
          text: 'منطوق الحكم\nحكمت المحكمة برفض الدعوى.\nالحكم نهائي غير قابل للاعتراض.',
        },
      ],
    });
    expect(guarded.answer).toBe('الحكم نهائي غير قابل للاعتراض.');
    expect(guarded.answer).not.toContain('ابتدائي');
  });

  it('withholds finality and a case number the body does not state', () => {
    const guarded = guardGroundedAnswer({
      query: 'ما نتيجة الحكم؟',
      answer: 'الحكم نهائي ورقم القضية 33337',
      claims: [],
      insufficientEvidence: false,
      evidence: [{ evidenceId: 'E1', text: 'حكمت المحكمة برفض الدعوى.' }],
    });
    expect(guarded.answer).toBe(UNSURE_ANSWER_AR);
  });

  it('withholds a Hijri month that is not the month written in the body', () => {
    const guarded = guardGroundedAnswer({
      query: 'ما تاريخ الحكم؟',
      answer: 'تاريخ الحكم 15 ربيع الأول 1446',
      claims: [],
      insufficientEvidence: false,
      evidence: [
        { evidenceId: 'E1', text: 'تاريخ الحكم 15 ربيع الآخر 1446' },
      ],
    });
    expect(guarded.answer).toBe(UNSURE_ANSWER_AR);
  });
});