const ARABIC_SCOPE_NOTICE =
  'أنا متخصص في مصاريفك ودخلك وميزانيتك داخل مصاريفي. وش ودّك تعرف عن بياناتك المالية؟';
const ENGLISH_SCOPE_NOTICE =
  'Sorry, I specialize in your spending, income, budgets and financial data in Masarifi. Ask me about your personal finances.';

export function assistantScopeNotice(question: string, greeting = false) {
  const arabic = /[\u0600-\u06ff]/u.test(question);
  const generatedAt = new Date().toISOString();
  return {
    content: greeting
      ? arabic
        ? 'حيّاك! وش ودّك نراجع في مصاريفك؟'
        : 'Hello! I help analyze your spending, income and financial data. What would you like to know about them?'
      : arabic
        ? ARABIC_SCOPE_NOTICE
        : ENGLISH_SCOPE_NOTICE,
    metadata: {
      schemaVersion: 1,
      locale: arabic ? 'ar' : 'en',
      // A scope notice has no financial period or owner-local date interpretation.
      timezone: 'UTC',
      scope: 'current_state',
      startDate: generatedAt.slice(0, 10),
      endDate: generatedAt.slice(0, 10),
      currencies: [],
      responseType: 'redirect',
      generatedAt,
      values: [],
      reasons: [greeting ? 'assistant_introduction' : 'outside_financial_scope'],
    },
  };
}

export function directAssistantScopeNotice(question: string) {
  const normalized = question
    .normalize('NFKC')
    .replace(
      /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu,
      '',
    )
    .trim()
    .toLowerCase();
  const greeting =
    /^(?:ازيك|إزيك|اهلا|أهلا|هلا(?: والله)?|حياك(?: الله)?|كيف الحال|السلام عليكم|وعليكم السلام|مرحبا|صباح الخير|مساء الخير|hi|hello|hey|good morning|good evening)[\s!?.،؟]*$/iu.test(
      normalized,
    );
  if (greeting) return assistantScopeNotice(question, true);
  // Only direct tasks are recognized here; financial searches containing code or
  // programming names still reach the semantic agent.
  const directQuestion = normalized.replace(
    /^(?:(?:هل|طيب|ممكن|عايزك|لو سمحت|من فضلك|please)\s+)+/iu,
    '',
  );
  const programming =
    /^(?:(?:تعرف|بتعرف|تقدر|بتقدر)\s*(?:تبرمج|البرمجة|برمجة|تكتب\s*كود)|(?:اكتب(?:لي|لنا)?|اعملي?|تعمل|صمم|راجع|صحح)\s+(?:(?:لي|لنا)\s+)?(?:كود|سكربت|تطبيق)(?![\p{L}\p{N}])|(?:can|could)\s+you\s+(?:code|program)\b|(?:write|build|create|debug|refactor|review)\s+(?:(?:me|a|an|the|my|some|budget|finance|financial|transaction|expense)\s+){0,5}(?:code|script|program|app|application|python|javascript|react|sql)\b)/iu;
  const programRequest =
    /^(?:(?:تعرف|بتعرف|تقدر|بتقدر)\s+)?(?:اكتب(?:لي|لنا)?|تكتب|اعملي?|تعمل|صمم|راجع|صحح)\s+(?:(?:لي|لنا)\s+)?برنامج(?![\p{L}\p{N}])/iu.test(
      directQuestion,
    );
  const codingCue = /بايثون|python|javascript|جافا|كود|سكربت|\bcode\b|برمج|بلغة/iu.test(normalized);
  const financialPlan = /ادخار|توفير|سداد|ديون|ميزاني/iu.test(normalized);
  const otherTask =
    /^(?:(?:ممكن|طيب)\s+)?(?:(?:اكتب(?:لي)?|احكي(?:لي)?|قول(?:لي)?)\s+(?:قص[ةه]|حكاية|نكت[ةه]|شعر)|(?:ترجم|translate)\s|(?:مين كسب|نتيجة ماتش)|(?:what is|what's|tell me)\s+(?:the\s+)?(?:weather|football score))/iu;
  return programming.test(directQuestion) ||
    (programRequest && (codingCue || !financialPlan)) ||
    otherTask.test(normalized)
    ? assistantScopeNotice(question)
    : null;
}

export function isProgrammingAnswer(answer: string): boolean {
  return /```|(?:^|\n)\s*(?:def\s+\w+\s*\(|(?:function|class|import|const|let|var)\s+[\w{])|(?:أقدر|اقدر|يمكنني|أستطيع)\s+(?:أساعدك\s+)?(?:أكتب|اكتب|تكتب|كتابة)\s+(?:(?:لك|ليك)\s+)?(?:كود|سكربت|برنامج\s+(?:بايثون|بلغة))|\bi can (?:help you )?(?:to )?(?:(?:code|program)\b|(?:write|build)\s+(?:(?:you|a|an|the|some|python|javascript|react|budget|financial)\s+){0,4}(?:code|script|program|app|application)\b)/iu.test(
    answer,
  );
}
