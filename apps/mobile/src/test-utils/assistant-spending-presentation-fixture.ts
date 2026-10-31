export const spendingPresentationFixture = {
  version: 1 as const,
  locale: 'ar' as const,
  cards: [
    {
      title: 'مصروفاتك',
      amount: '2,400.00 SAR',
      period: '1 أكتوبر – 31 أكتوبر',
      comparison: {
        direction: 'up' as const,
        difference: '300.00 SAR',
        percentage: '14.28%',
        previousAmount: '2,100.00 SAR',
        previousPeriod: '1 سبتمبر – 30 سبتمبر'
      },
      explanation: 'من التغيّرات المسجلة: المطاعم زاد صرفها 200.00 SAR.',
      saving: {
        text: 'راجع إمكانية ترجع صرف المطاعم لمستوى الفترة السابقة: 400.00 SAR.',
        target: '200.00 SAR'
      }
    }
  ]
};
