import type {
  GuideAnswerResponseDto,
  GuideStartResponseDto,
  GuideTurnDto,
} from '../dto/guide-response.dto';
import type { GuideSummaryResponseDto } from '../dto/guide-summary-response.dto';
import type { GuideStage } from '../guide-stage';
import {
  GUIDE_DOMAIN_LABELS_AR,
  inferDurationDays,
  renderGuideReply,
  type GuideTurn,
} from '../guide-turn';

export const guideStageFor = (turn: GuideTurn): GuideStage =>
  turn.needsClarification ? 'QUESTION' : 'ANSWER';

export const mapGuideTurn = (
  turn: GuideTurn,
  clarificationCount: number,
): GuideTurnDto => ({
  domains: turn.domains,
  understanding: turn.understanding,
  knownFacts: turn.knownFacts,
  missingFacts: turn.missingFacts,
  needsClarification: turn.needsClarification,
  clarificationQuestion: turn.clarificationQuestion,
  suggestedReplies: turn.suggestedReplies,
  guidance: turn.guidance,
  nextSteps: turn.nextSteps,
  uncertainty: turn.uncertainty,
  urgent: turn.urgent,
  clarificationCount,
  sourcesAvailable: false,
  sources: [],
});

export const mapGuideWelcome = (
  sessionId: string,
  reply: string,
): GuideStartResponseDto => ({
  sessionId,
  reply,
});

export const mapGuideAnswer = (
  sessionId: string,
  turn: GuideTurn,
  clarificationCount: number,
): GuideAnswerResponseDto => ({
  sessionId,
  reply: renderGuideReply(turn),
  stage: guideStageFor(turn),
  turn: mapGuideTurn(turn, clarificationCount),
});

const guideDurationDays = (turn: GuideTurn, transcript = ''): number =>
  turn.durationDays ??
  inferDurationDays(
    [turn.guidance ?? '', turn.understanding, ...turn.knownFacts, transcript].join(
      '\n',
    ),
  ) ??
  0;

const guideDurationValue = (turn: GuideTurn, transcript = ''): string => {
  const days = guideDurationDays(turn, transcript);
  if (days > 0) {
    return `${days} يوماً حسب ما ورد في الحوار`;
  }
  return 'غير محددة — لا تتوفر مصادر موثّقة لتحديد المدد أو المواعيد';
};

const UNVERIFIED_NOTE =
  'معلومات عامة استرشادية غير مستندة إلى مصادر نظامية موثّقة، وليست حكماً قضائياً ولا استشارة قانونية ملزمة.';

/** Summary derived only from the latest validated guidance turn. */
export const mapGuideSummary = (
  sessionId: string,
  turn: GuideTurn,
  transcript = '',
): GuideSummaryResponseDto => ({
  sessionId,
  resultTitle: turn.urgent
    ? 'خلاصة إرشادك — مسألة تستدعي المبادرة'
    : 'خلاصة إرشادك الاسترشادي',
  resultBody: [turn.understanding, turn.guidance ?? '', turn.uncertainty ?? '', UNVERIFIED_NOTE]
    .filter((p) => p.length > 0)
    .join('\n\n'),
  caseTypeLabel: 'طبيعة المسألة (استرشادي)',
  caseTypeValue: turn.domains.map((d) => GUIDE_DOMAIN_LABELS_AR[d]).join('، '),
  authorityLabel: 'الجهة المحتملة (معلومة عامة غير موثّقة)',
  authorityValue:
    turn.likelyAuthority ?? 'تُحدد بحسب تفاصيل المسألة بعد مراجعة مختص',
  durationLabel: 'المدة النظامية',
  durationValue: guideDurationValue(turn, transcript),
  durationDays: guideDurationDays(turn, transcript),
  durationUnit: 'يوماً',
  docsTitle: 'مستندات يُستحسن تجهيزها',
  docs: turn.suggestedDocuments.map((label, index) => ({
    id: `doc-${index + 1}`,
    label,
    done: false,
  })),
  stepsTitle: 'خطوات مقترحة',
  steps: turn.nextSteps.map((label, index) => ({ number: index + 1, label })),
});
