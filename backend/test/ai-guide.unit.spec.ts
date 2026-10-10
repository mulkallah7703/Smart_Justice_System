import { resolveGuideStage } from '../src/modules/ai/guide/guide-stage';
import {
  buildDeterministicGuideReply,
  buildGuideSummary,
} from '../src/modules/ai/guide/guide-dialogue';
import { GUIDE_WELCOME_REPLY_AR } from '../src/modules/ai/guide/prompts/legal-guide.prompt';
import { mapGuideAnswer, mapGuideStart } from '../src/modules/ai/guide/mappers/guide.mapper';

describe('guide stage machine', () => {
  it('maps user message counts to CHAT / QUESTION / SUMMARY', () => {
    expect(resolveGuideStage(0)).toBe('CHAT');
    expect(resolveGuideStage(1)).toBe('QUESTION');
    expect(resolveGuideStage(2)).toBe('SUMMARY');
    expect(resolveGuideStage(5)).toBe('SUMMARY');
  });
});

describe('guide dialogue', () => {
  it('returns deterministic welcome and stage replies', () => {
    expect(buildDeterministicGuideReply('CHAT', true)).toBe(
      GUIDE_WELCOME_REPLY_AR,
    );
    expect(buildDeterministicGuideReply('QUESTION', false)).toContain('عقد');
    expect(buildDeterministicGuideReply('SUMMARY', false)).toContain('محامياً');
  });

  it('builds a rental-aware informational summary without fabricating case numbers', () => {
    const summary = buildGuideSummary('sess_1', [
      { role: 'USER', content: 'المستأجر تأخر عن دفع الإيجار' },
      { role: 'ASSISTANT', content: 'clarifying' },
    ]);

    expect(summary.sessionId).toBe('sess_1');
    expect(summary.caseTypeValue).toMatch(/إيجار/);
    expect(summary.resultBody).toMatch(/عامة|استرشاد/);
    expect(JSON.stringify(summary)).not.toMatch(/userId|nationalId|JWT|sk-/i);
    expect(summary.docs.length).toBeGreaterThan(0);
    expect(summary.steps.length).toBeGreaterThan(0);
  });

  it('builds a generic summary when no rental signal exists', () => {
    const summary = buildGuideSummary('sess_2', [
      { role: 'USER', content: 'لدي مشكلة عامة' },
    ]);
    expect(summary.caseTypeValue).toMatch(/غير محدد/);
    expect(summary.durationDays).toBe(0);
  });
});

describe('guide mappers', () => {
  it('maps start and answer without leaking identity fields', () => {
    expect(mapGuideStart('s1', 'hello')).toEqual({
      sessionId: 's1',
      reply: 'hello',
    });
    expect(mapGuideAnswer('s1', 'r', 'QUESTION')).toEqual({
      sessionId: 's1',
      reply: 'r',
      stage: 'QUESTION',
    });
  });
});
