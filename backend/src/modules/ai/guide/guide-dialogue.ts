import type { GuideStage } from './guide-stage';
import {
  GUIDE_CLARIFY_REPLY_AR,
  GUIDE_GENERIC_REPLY_AR,
  GUIDE_SUMMARY_REPLY_AR,
  GUIDE_WELCOME_REPLY_AR,
} from './prompts/legal-guide.prompt';

import type { GuideSummaryResponseDto } from './dto/guide-summary-response.dto';

export interface GuideMessageSnapshot {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

/** Deterministic mock / fallback replies — never claim legal authority. */
export const buildDeterministicGuideReply = (
  stage: GuideStage,
  isWelcome: boolean,
): string => {
  if (isWelcome) {
    return GUIDE_WELCOME_REPLY_AR;
  }
  switch (stage) {
    case 'QUESTION':
      return GUIDE_CLARIFY_REPLY_AR;
    case 'SUMMARY':
      return GUIDE_SUMMARY_REPLY_AR;
    case 'CHAT':
    default:
      return GUIDE_GENERIC_REPLY_AR;
  }
};

const mentionsRental = (text: string): boolean =>
  /إيجار|مستأجر|مؤجر|rent|lease|tenant|landlord/i.test(text);

/**
 * Builds the summary DTO expected by the existing frontend.
 * Values are informational templates only — not legal conclusions.
 */
export const buildGuideSummary = (
  sessionId: string,
  messages: readonly GuideMessageSnapshot[],
): GuideSummaryResponseDto => {
  const joined = messages.map((m) => m.content).join('\n');
  const rental = mentionsRental(joined);

  return {
    sessionId,
    resultTitle: 'خلاصة إرشادك الاسترشادي',
    resultBody: rental
      ? 'بناءً على وصفك، قد يتعلق الأمر بنزاع إيجاري. هذه معلومات عامة فقط وليست حكماً قضائياً ولا استشارة قانونية ملزمة.'
      : 'بناءً على وصفك، هذه إرشادات عامة لمساعدتك على الفهم. القرار النهائي والتفسير النظامي يتطلب مراجعة مختص.',
    caseTypeLabel: 'نوع القضية (استرشادي)',
    caseTypeValue: rental
      ? 'نزاع إيجاري — وصف عام'
      : 'غير محدد بدقة — يُفضّل استشارة محامٍ',
    authorityLabel: 'الجهة المحتملة (معلومة عامة)',
    authorityValue: rental
      ? 'لجان المنازعات الإيجارية (معلومة عامة)'
      : 'يُحدد بحسب نوع النزاع بعد مراجعة مختص',
    durationLabel: 'مدة تقريبية للنظر (معلومة عامة)',
    durationValue: rental ? 'حتى ٦٠ يوماً تقريباً من القيد' : 'غير محددة',
    durationDays: rental ? 60 : 0,
    durationUnit: 'يوماً',
    docsTitle: 'مستندات يُستحسن تجهيزها',
    docs: rental
      ? [
          { id: 'doc-lease', label: 'عقد الإيجار إن وُجد', done: false },
          { id: 'doc-demand', label: 'إثبات المطالبة الودية إن وُجد', done: false },
          {
            id: 'doc-receipts',
            label: 'إيصالات أو كشوف السداد إن وُجدت',
            done: false,
          },
        ]
      : [
          {
            id: 'doc-identity',
            label: 'إثبات الهوية والمستندات ذات الصلة',
            done: false,
          },
          {
            id: 'doc-correspondence',
            label: 'المراسلات أو الإثباتات المتوفرة',
            done: false,
          },
        ],
    stepsTitle: 'خطوات عامة مقترحة',
    steps: [
      {
        number: 1,
        label: 'اجمع المستندات ذات الصلة وراجعها مع مختص عند الحاجة.',
      },
      {
        number: 2,
        label: 'لا تعتمد على هذا الإرشاد وحده لاتخاذ إجراء قضائي.',
      },
    ],
  };
};
