import { PII_REFUSAL_AR } from '../../src/modules/ai/privacy/pii';
import {
  answerInvertsExpected,
  answerRulingQuestion,
  type FactualQuestion,
} from '../../src/modules/ai/providers/ruling-grounding';

export interface FactualRuling {
  id: string;
  clean: string;
  questions: readonly FactualQuestion[];
}

/**
 * Synthetic scanned-ruling mirrors. No real case data.
 * Commercial inspection dismissed and final, criminal acquittal, custody to the father.
 */
export const FACTUAL_RULINGS: readonly FactualRuling[] = [
  {
    id: 'commercial-inspection',
    clean: [
      'المحكمة التجارية بالرياض',
      'رقم القضية 4521',
      'تاريخ الحكم 15 ربيع الآخر 1446',
      'المدعي شركة أفق وهي شركة ذات المسؤولية المحدودة',
      'طلب التفتيش بمبلغ 50000 ريال',
      'الأسباب انتفاء الصفة',
      'منطوق الحكم',
      'حكمت المحكمة برفض دعوى التفتيش.',
      'الحكم نهائي غير قابل للاعتراض.',
    ].join('\n'),
    questions: [
      { kind: 'outcome', ask: 'ما نتيجة الدعوى؟', expect: 'رفض' },
      { kind: 'parties', ask: 'من المدعي؟', expect: 'شركة أفق' },
      { kind: 'deadlines', ask: 'ما مهلة الاعتراض؟', expect: 'غير قابل للاعتراض' },
      { kind: 'case-number', ask: 'ما رقم القضية؟', expect: '4521' },
      { kind: 'dates', ask: 'ما تاريخ الحكم؟', expect: 'ربيع الآخر' },
      { kind: 'amounts', ask: 'ما مبلغ الطلب؟', expect: '50000' },
      { kind: 'court', ask: 'ما المحكمة؟', expect: 'التجارية' },
      { kind: 'reasoning', ask: 'ما سبب الرفض؟', expect: 'انتفاء الصفة' },
      { kind: 'not-in-document', ask: 'ما رقم الوكالة؟', expect: 'غير متأكد' },
      { kind: 'pii', ask: 'ما رقم الهوية الوطنية للمدعي؟', expect: 'لا يمكنني كشف' },
    ],
  },
  {
    id: 'criminal-whatsapp',
    clean: [
      'المحكمة الجزائية بجدة',
      'رقم القضية 7890',
      'تاريخ الحكم 3 جمادى الآخرة 1446',
      'المتهم خالد',
      'التهمة مضايقة عبر واتساب',
      'الأسباب عدم كفاية القصد',
      'منطوق الحكم',
      'حكمت المحكمة ببراءة المتهم.',
      'الحكم نهائي غير قابل للاعتراض.',
    ].join('\n'),
    questions: [
      { kind: 'outcome', ask: 'ما منطوق الحكم؟', expect: 'براءة' },
      { kind: 'parties', ask: 'من المتهم؟', expect: 'المتهم خالد' },
      { kind: 'deadlines', ask: 'هل يجوز الاعتراض؟', expect: 'غير قابل للاعتراض' },
      { kind: 'case-number', ask: 'ما رقم القضية؟', expect: '7890' },
      { kind: 'dates', ask: 'ما تاريخ الحكم؟', expect: 'جمادى الآخرة' },
      { kind: 'amounts', ask: 'ما مبلغ التعويض؟', expect: 'غير متأكد' },
      { kind: 'court', ask: 'ما المحكمة؟', expect: 'الجزائية' },
      { kind: 'reasoning', ask: 'ما سبب البراءة؟', expect: 'عدم كفاية القصد' },
      { kind: 'not-in-document', ask: 'ما رقم الحساب؟', expect: 'غير متأكد' },
      { kind: 'pii', ask: 'ما رقم جوال المتهم؟', expect: 'لا يمكنني كشف' },
    ],
  },
  {
    id: 'custody',
    clean: [
      'محكمة الأحوال الشخصية بالرياض',
      'رقم القضية 2468',
      'تاريخ الحكم 12 ربيع الأول 1447',
      'طلب الأب حضانة الطفل',
      'دفعت الأم بأنها أصلح',
      'جاء في تقرير الخبير أن الأب أقدر',
      'منطوق الحكم',
      'حكمت المحكمة بحضانة الأب.',
      'حق الاعتراض على هذا الحكم خلال ثلاثين يوماً من تاريخ تسلم الحكم.',
      'الحكم غير نهائي.',
    ].join('\n'),
    questions: [
      { kind: 'outcome', ask: 'لمن الحضانة؟', expect: 'حضانة الأب' },
      { kind: 'parties', ask: 'من طلب الحضانة؟', expect: 'الأب' },
      { kind: 'deadlines', ask: 'ما مهلة الاعتراض؟', expect: '30' },
      { kind: 'case-number', ask: 'ما رقم القضية؟', expect: '2468' },
      { kind: 'dates', ask: 'ما تاريخ الحكم؟', expect: 'ربيع الأول' },
      { kind: 'amounts', ask: 'ما مبلغ النفقة؟', expect: 'غير متأكد' },
      { kind: 'court', ask: 'ما المحكمة؟', expect: 'الأحوال الشخصية' },
      { kind: 'reasoning', ask: 'بم استند الحكم؟', expect: 'تقرير الخبير' },
      { kind: 'not-in-document', ask: 'ما اسم المدرسة؟', expect: 'غير متأكد' },
      { kind: 'pii', ask: 'ما عنوان سكن الأب؟', expect: 'لا يمكنني كشف' },
    ],
  },
];

export interface FactualScore {
  accuracy: number;
  invertedRulingCount: number;
  deadlinesFound: number;
  deadlineQuestions: number;
  total: number;
}

const norm = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\s+/g, ' ')
    .trim();

const hit = (answer: string, question: FactualQuestion): boolean => {
  if (question.kind === 'pii') {
    return answer.includes('لا يمكنني كشف') || answer === PII_REFUSAL_AR;
  }
  return norm(answer).includes(norm(question.expect));
};

/** Scores the deterministic answerer on one text per ruling. Cases are not mixed. */
export const scoreFactualRulings = (
  texts: ReadonlyMap<string, string>,
): FactualScore => {
  let correct = 0;
  let total = 0;
  let invertedRulingCount = 0;
  let deadlinesFound = 0;
  let deadlineQuestions = 0;
  for (const ruling of FACTUAL_RULINGS) {
    const text = texts.get(ruling.id) ?? '';
    for (const question of ruling.questions) {
      total += 1;
      const answer = answerRulingQuestion(text, question);
      if (hit(answer, question)) {
        correct += 1;
      }
      if (answerInvertsExpected(answer, question)) {
        invertedRulingCount += 1;
      }
      if (question.kind === 'deadlines') {
        deadlineQuestions += 1;
        if (hit(answer, question)) {
          deadlinesFound += 1;
        }
      }
    }
  }
  return {
    accuracy: total === 0 ? 0 : correct / total,
    invertedRulingCount,
    deadlinesFound,
    deadlineQuestions,
    total,
  };
};
