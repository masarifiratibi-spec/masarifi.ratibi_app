import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import arMessages from '../../src/localization/messages/ar.ts';
import enMessages from '../../src/localization/messages/en.ts';
import { defaultCategorySeeds } from '../../src/test-utils/core-finance-fixtures.ts';

process.env.NODE_PATH =
  process.env.NODE_PATH ||
  'C:/Users/DELL/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
Module._initPaths();

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(root, '..', '..');
const logoData = fs.readFileSync(path.join(mobileRoot, 'assets', 'icon.png')).toString('base64');
const arabicRegular = fs.readFileSync(path.join(mobileRoot, 'assets', 'fonts', 'IBMPlexSansArabic-Regular.ttf')).toString('base64');
const arabicBold = fs.readFileSync(path.join(mobileRoot, 'assets', 'fonts', 'IBMPlexSansArabic-Bold.ttf')).toString('base64');
const latinRegular = fs.readFileSync(path.join(mobileRoot, 'assets', 'fonts', 'IBMPlexSans-Regular.ttf')).toString('base64');
const latinBold = fs.readFileSync(path.join(mobileRoot, 'assets', 'fonts', 'IBMPlexSans-Bold.ttf')).toString('base64');
const openMojiRoot = path.join(mobileRoot, 'assets', 'category-visuals', 'openmoji-17.0');
const seededCategories = new Map(defaultCategorySeeds.map(([id, labelAr, labelEn]) => [id, { labelAr, labelEn }]));
const openMojiCache = new Map();

const areas = [
  ['00-foundation', 'Foundation / Shell'],
  ['01-accounts', 'Accounts'],
  ['02-categories', 'Categories'],
  ['03-transactions', 'Transactions'],
  ['04-add', 'Add + Voice'],
  ['05-tracking', 'Automatic Tracking'],
  ['06-home', 'Home'],
  ['07-salary', 'Salary'],
  ['08-budgets', 'Budgets'],
  ['09-obligations', 'Obligations / Installments'],
  ['10-savings', 'Savings'],
  ['11-reports', 'Reports'],
  ['12-assistant', 'Assistant'],
  ['13-notifications', 'Notifications'],
  ['14-more-settings', 'More / Profile / Settings'],
  ['15-security-privacy', 'Security / Privacy'],
  ['16-subscription', 'Subscription'],
  ['17-support', 'Support'],
  ['18-auth', 'Authentication'],
  ['19-onboarding', 'Onboarding']
];

const arNav = ['الرئيسية', 'الحركات', 'إضافة', 'التقارير', 'المزيد'];
const enNav = ['Home', 'Transactions', 'Add', 'Reports', 'More'];

function s(id, area, file, screen, route, opts) {
  return {
    id,
    area,
    file,
    screen,
    route,
    lang: opts.lang ?? 'ar',
    tab: opts.tab,
    title: opts.title,
    subtitle: opts.subtitle,
    hero: opts.hero,
    scope: opts.scope,
    metrics: opts.metrics ?? [],
    attention: opts.attention ?? [],
    rows: opts.rows ?? [],
    rowCategories: opts.rowCategories ?? [],
    progress: opts.progress ?? [],
    fields: opts.fields ?? [],
    chips: opts.chips ?? [],
    actions: opts.actions ?? [],
    conversation: opts.conversation ?? [],
    state: opts.state,
    board: opts.board,
    chart: opts.chart,
    bottomSheet: opts.bottomSheet,
    dialog: opts.dialog,
    components: opts.components ?? [],
    states: opts.states ?? ['normal'],
    analysis: opts.analysis ?? 'REDESIGN_ANALYSIS.md §13–14'
  };
}

const screens = [
  s('foundation-system-ar', '00-foundation', 'foundation-system-board-ar.png', 'Shared design system board', 'app/design-system/index.tsx', {
    title: 'نظام مصاريفي البصري',
    subtitle: 'Gulf Premium / Quiet Intelligence',
    board: true,
    hero: { label: 'Financial Pulse', value: '12,840.50 SAR', note: 'ملخص مالي واضح مع إخفاء آمن للقيم' },
    metrics: [['الدخل', '18,400 SAR'], ['المصروف', '5,559.50 SAR'], ['الصافي', '12,840.50 SAR']],
    attention: ['3 حركات تحتاج مراجعة', 'تزامن معلق في 2 عنصر', 'إذن التتبع غير مكتمل'],
    rows: [['Source Mark', 'تلقائي · صوت · يدوي · مساعد'], ['Grouped List', 'صفوف كثيفة بدل كروت متكررة'], ['State View', 'تحميل · فارغ · خطأ · أوفلاين']],
    components: ['FinancialPulse', 'SourceMark', 'AttentionRail', 'GroupedList', 'RouteModalContainer'],
    states: ['light/dark', 'RTL/LTR', 'hidden', 'loading/error/empty']
  }),
  s('shell-main-ar', '00-foundation', 'shell-main-ar.png', 'Main app shell', 'app/(tabs)/_layout.tsx', {
    title: 'مصاريفي',
    subtitle: 'التنقل الأساسي ثابت: الرئيسية، الحركات، إضافة، التقارير، المزيد',
    tab: 'home',
    hero: { label: 'الموقع المالي', value: '•••• SAR', note: 'القيم مخفية حتى يقرر المستخدم إظهارها' },
    metrics: [['الدخل', '••••'], ['المصروف', '••••'], ['الحسابات', '3']],
    attention: ['مراجعة 17 حركة تلقائية', '22 عنصر قيد المزامنة'],
    rows: [['إجراء سريع', 'الحسابات، الفئات، إضافة يدويًا'], ['سلوك RTL', 'الترتيب والمنطق حسب اللغة المختارة']],
    components: ['AppTabs', 'SensitiveValue', 'AttentionRail']
  }),
  s('shared-sheet-ar', '00-foundation', 'shared-sheet-modal-ar.png', 'Shared sheet and modal presentation', 'app/modals/*', {
    title: 'اختيار الحساب',
    subtitle: 'Sheet موحّد يحافظ على السياق والعودة',
    rows: [['الحساب اليومي', 'SAR 2048 · الحساب الافتراضي'], ['المحفظة', 'SAR'], ['السفر', 'USD 8812']],
    bottomSheet: { title: 'نتائج البحث', rows: ['3 حسابات متاحة', 'لا يتم إنشاء اختيار عالمي جديد'] },
    components: ['RouteModalContainer', 'GroupedList', 'AccountRow'],
    states: ['search', 'selected', 'no results']
  }),
  s('shared-states-ar', '00-foundation', 'shared-states-ar.png', 'Shared state presentation', 'app/design-system/index.tsx', {
    title: 'حالات النظام',
    subtitle: 'نفس اللغة البصرية لكل شاشة',
    rows: [['تحميل', 'Skeleton يحافظ على الهندسة'], ['فارغ', 'توضيح السبب + إجراء واحد'], ['خطأ', 'سبب واضح + استعادة'], ['أوفلاين', 'ما تم حفظه محليًا وما لم يتزامن بعد']],
    dialog: { title: 'تأكيد الأثر', body: 'سيتم أرشفة الحساب ولن يظهر في الاختيارات النشطة.', primary: 'تأكيد', secondary: 'إلغاء' },
    components: ['StateView', 'ConfirmDialog', 'ActionButton']
  }),

  s('accounts-list-ar', '01-accounts', 'accounts-list-ar.png', 'Account List', 'app/accounts/index.tsx', {
    title: 'الحسابات',
    subtitle: 'إدارة الحسابات النشطة والمؤرشفة',
    scope: 'كل العملات',
    rows: [['الحساب اليومي', 'حساب بنكي · SAR 2048 · افتراضي', '12,480.00 SAR'], ['المحفظة', 'محفظة · SAR', '640.75 SAR'], ['السفر', 'ادخار · USD 8812', '1,320.00 USD'], ['بطاقة قديمة', 'بطاقة ائتمان · SAR 0019 · مؤرشف', '•••• SAR']],
    actions: ['إضافة حساب'],
    components: ['AccountRow', 'GroupedList', 'AmountText'],
    states: ['active/archived', 'hidden', 'search/no results']
  }),
  s('accounts-detail-ar', '01-accounts', 'accounts-detail-ar.png', 'Account Detail', 'app/accounts/[id]/index.tsx', {
    title: 'الحساب اليومي',
    subtitle: 'حساب بنكي · SAR 2048',
    hero: { label: 'الرصيد الحالي', value: '12,480.00 SAR', note: 'محسوب من السجل الكامل' },
    rows: [['راتب أغسطس', 'دخل · تلقائي · يحتاج اعتماد', '+18,000 SAR'], ['مطعم النخيل', 'طعام · يدوي', '−86.50 SAR'], ['تحويل للمحفظة', 'تحويل', '−300 SAR']],
    actions: ['تعديل الحساب', 'تحويل', 'أرشفة الحساب'],
    components: ['FinancialPulse', 'AccountRow', 'TransactionRow', 'SourceMark']
  }),
  s('accounts-create-ar', '01-accounts', 'accounts-create-ar.png', 'Create Account', 'app/accounts/new.tsx', {
    title: 'إضافة حساب',
    fields: [['اسم الحساب', 'حساب الطوارئ'], ['نوع الحساب', 'حساب بنكي · بطاقة · محفظة · نقد'], ['العملة', 'SAR'], ['رصيد افتتاحي', '0.00']],
    actions: ['حفظ الحساب', 'إلغاء'],
    state: 'مسودة غير محفوظة: يظهر تأكيد قبل الخروج',
    components: ['FormField', 'SegmentedControl', 'ActionButton']
  }),
  s('accounts-edit-ar', '01-accounts', 'accounts-edit-ar.png', 'Edit Account', 'app/accounts/[id]/edit.tsx', {
    title: 'تعديل الحساب',
    fields: [['اسم الحساب', 'الحساب اليومي'], ['نوع الحساب', 'حساب بنكي'], ['العملة', 'SAR · للقراءة فقط'], ['الرصيد الافتتاحي', '8,500.00']],
    actions: ['حفظ التعديل', 'إلغاء'],
    state: 'لا يتم تعديل الرصيد الحالي مباشرة ولا تمسح الحقول المخفية',
    components: ['FormField', 'ReadOnlyState', 'ActionButton']
  }),
  s('account-picker-ar', '01-accounts', 'account-picker-ar.png', 'Account Picker', 'app/modals/account-picker.tsx', {
    title: 'اختيار حساب',
    subtitle: 'يعود إلى مسودة الإضافة بدون فقدانها',
    rows: [['الحساب اليومي', 'SAR 2048 · محدد', '12,480 SAR'], ['المحفظة', 'SAR', '640.75 SAR'], ['السفر', 'USD 8812', '1,320 USD']],
    bottomSheet: { title: 'بحث الحسابات', rows: ['بحث بالاسم أو العملة أو آخر 4 أرقام', 'الحسابات المؤرشفة غير متاحة للاختيار'] },
    components: ['RouteModalContainer', 'AccountRow']
  }),

  s('categories-list-ar', '02-categories', 'categories-list-ar.png', 'Category List / Management', 'app/categories/index.tsx', {
    title: 'الفئات',
    subtitle: 'افتراضية ومخصصة مع بحث سريع',
    chips: ['الكل', 'المفضلة', 'مخصصة'],
    rows: [['السكن', 'فئة افتراضية · 14 حركة'], ['المطاعم', 'مفضلة · 23 حركة'], ['القهوة', 'مخصصة · لون برونزي'], ['اشتراكات رقمية', 'تحتاج مراجعة قاعدة']],
    actions: ['إضافة فئة'],
    components: ['CategoryRow', 'GroupedList', 'Search']
  }),
  s('categories-create-ar', '02-categories', 'categories-create-ar.png', 'Create Category', 'app/categories/new.tsx', {
    title: 'إضافة فئة',
    fields: [['الاسم بالعربية', 'القهوة'], ['English name', 'Coffee'], ['الأيقونة', 'مشروب'], ['اللون', 'برونزي هادئ']],
    actions: ['حفظ الفئة'],
    components: ['FormField', 'IconPicker', 'ActionButton']
  }),
  s('categories-detail-ar', '02-categories', 'categories-detail-ar.png', 'Edit Category / Detail', 'app/categories/[id].tsx', {
    title: 'المطاعم',
    hero: { label: 'مصروف الشهر', value: '1,246.75 SAR', note: '42% من ميزانية الطعام' },
    rows: [['آخر حركة', 'مطعم النخيل · أمس'], ['الحالة', 'فئة افتراضية لا يمكن حذفها'], ['الظهور في التقارير', 'مفعل']],
    actions: ['تعديل التسمية', 'عرض الحركات'],
    components: ['CalmProgress', 'CategoryRow']
  }),
  s('category-picker-ar', '02-categories', 'category-picker-ar.png', 'Category Picker', 'app/modals/category-picker.tsx', {
    title: 'اختيار فئة',
    subtitle: 'قائمة بحث لا تكسر مسودة الحركة',
    rows: [['المطاعم', 'مفضلة'], ['البقالة', 'فئة افتراضية'], ['الوقود', 'آخر استخدام: أمس'], ['بدون فئة', 'يتطلب مراجعة لاحقة']],
    actions: ['إضافة فئة جديدة'],
    components: ['RouteModalContainer', 'CategoryRow']
  }),

  s('transactions-list-ar', '03-transactions', 'transactions-list-ar.png', 'Transactions List', 'app/(tabs)/transactions.tsx', {
    title: 'الحركات',
    tab: 'transactions',
    scope: 'أغسطس · كل الحسابات',
    metrics: [['الدخل', '18,400 SAR'], ['المصروف', '5,559.50 SAR']],
    rows: [['راتب أغسطس', 'دخل · تلقائي', '+18,000 SAR', 'الحساب اليومي'], ['مطعم النخيل', 'مطاعم · يدوي', '−86.50 SAR', 'الحساب اليومي'], ['STC Pay', 'اشتراكات · قيد المزامنة', '−120 SAR', 'الحساب اليومي'], ['تحويل للمحفظة', 'تحويل بين الحسابات', '−300 SAR', 'الحساب اليومي ← المحفظة']],
    rowCategories: ['salary', 'restaurants', 'subscriptions', 'transfers'],
    components: ['FinancialHorizonSurface', 'PrimaryShellHeader', 'TransactionRow', 'CategoryIcon']
  }),
  s('transactions-list-en', '03-transactions', 'transactions-list-en.png', 'Transactions List EN', 'app/(tabs)/transactions.tsx', {
    lang: 'en',
    title: 'Transactions',
    tab: 'transactions',
    scope: 'August · All accounts',
    metrics: [['Income', '18,400 SAR'], ['Expense', '5,559.50 SAR']],
    rows: [['August salary', 'Income · Automatic', '+18,000 SAR', 'Daily account'], ['Al Nakheel Restaurant', 'Restaurants · Manual', '−86.50 SAR', 'Daily account'], ['STC Pay', 'Subscriptions · Pending sync', '−120 SAR', 'Daily account'], ['Transfer to wallet', 'Transfer between accounts', '−300 SAR', 'Daily account → Wallet']],
    rowCategories: ['salary', 'restaurants', 'subscriptions', 'transfers'],
    components: ['FinancialHorizonSurface', 'PrimaryShellHeader', 'TransactionRow', 'CategoryIcon']
  }),
  s('transaction-filters-ar', '03-transactions', 'transaction-filters-ar.png', 'Transaction Filters', 'app/modals/transaction-filters.tsx', {
    title: 'تصفية الحركات',
    fields: [['الفترة', 'هذا الشهر'], ['الحساب', 'كل الحسابات'], ['الفئة', 'المطاعم، الاشتراكات'], ['المصدر', 'يدوي · تلقائي · صوت']],
    actions: ['تطبيق الفلاتر', 'مسح'],
    bottomSheet: { title: 'الفلاتر النشطة', rows: ['حساب: الحساب اليومي', 'حالة: تحتاج مراجعة'] },
    components: ['FilterSheet', 'Chips', 'FormField']
  }),
  s('transaction-detail-ar', '03-transactions', 'transaction-detail-ar.png', 'Transaction Detail', 'app/transactions/[id].tsx', {
    title: 'مطعم النخيل',
    hero: { label: 'مصروف', value: '−86.50 SAR', note: 'تمت أمس من الحساب اليومي' },
    rows: [['الفئة', 'المطاعم'], ['المصدر', 'يدوي'], ['الحالة', 'متزامنة'], ['العلاقة المالية', 'داخل ميزانية الطعام']],
    actions: ['تعديل الحركة', 'حذف', 'إبلاغ'],
    components: ['AmountHero', 'SourceMark', 'NavigationRow']
  }),
  s('transaction-edit-ar', '03-transactions', 'transaction-edit-ar.png', 'Edit Transaction', 'app/transactions/[id]/edit.tsx', {
    title: 'تعديل حركة',
    fields: [['المبلغ', '86.50 SAR'], ['النوع', 'مصروف'], ['الحساب', 'الحساب اليومي'], ['الفئة', 'المطاعم'], ['التاريخ', '8 أغسطس 2026']],
    actions: ['حفظ التعديل', 'إلغاء'],
    state: 'الحذف والرجوع لهما مسار استرداد منفصل',
    components: ['FocusedForm', 'PickerRow']
  }),
  s('sync-conflict-ar', '03-transactions', 'sync-conflict-ar.png', 'Sync Conflict', 'app/transactions/conflicts/[id].tsx', {
    title: 'تعارض في المزامنة',
    subtitle: 'اختر النسخة الصحيحة قبل تحديث السجل',
    rows: [['نسختك', 'مطعم النخيل · 86.50 SAR · مطاعم'], ['النسخة الأحدث', 'مطعم النخيل · 96.50 SAR · مطاعم'], ['الأثر', 'لن يتم تغيير الرصيد قبل التأكيد']],
    actions: ['استخدام نسختي', 'استخدام الأحدث'],
    dialog: { title: 'تأكيد الحل', body: 'سيتم حفظ النسخة المختارة فقط.', primary: 'تأكيد', secondary: 'رجوع' },
    components: ['ConflictSurface', 'AmountText']
  }),

  s('add-manual-ar', '04-add', 'add-manual-ar.png', 'Manual Add', 'app/(tabs)/add.tsx', {
    title: 'إضافة حركة',
    tab: 'add',
    hero: { label: 'المبلغ', value: '125.00 SAR', note: 'مصروف' },
    chips: ['مصروف', 'دخل', 'تحويل'],
    fields: [['الحساب', 'الحساب اليومي'], ['الفئة', 'المطاعم'], ['التاريخ', 'اليوم'], ['الوصف', 'غداء عمل']],
    actions: ['حفظ الحركة'],
    components: ['SegmentedControl', 'PickerRow', 'AmountInput']
  }),
  s('add-manual-en', '04-add', 'add-manual-en.png', 'Manual Add EN', 'app/(tabs)/add.tsx', {
    lang: 'en',
    title: 'Add transaction',
    tab: 'add',
    hero: { label: 'Amount', value: '125.00 SAR', note: 'Expense' },
    chips: ['Expense', 'Income', 'Transfer'],
    fields: [['Account', 'Daily account'], ['Category', 'Restaurants'], ['Date', 'Today'], ['Description', 'Business lunch']],
    actions: ['Save transaction'],
    components: ['SegmentedControl', 'PickerRow']
  }),
  s('add-transfer-ar', '04-add', 'add-transfer-ar.png', 'Transfer Mode', 'app/(tabs)/add.tsx?type=transfer', {
    title: 'تحويل بين الحسابات',
    hero: { label: 'المبلغ', value: '300.00 SAR', note: 'لا يحتسب كمصروف' },
    fields: [['من', 'الحساب اليومي'], ['إلى', 'المحفظة'], ['الرسوم', '0.00 SAR'], ['التاريخ', 'اليوم']],
    actions: ['حفظ التحويل'],
    components: ['TransferForm', 'AccountPicker']
  }),
  s('voice-ready-ar', '04-add', 'voice-ready-ar.png', 'Voice Ready', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'إدخال صوتي',
    subtitle: 'قل الحركة كما حدثت وسنحوّلها لمسودة قابلة للمراجعة',
    hero: { label: 'جاهز للاستماع', value: '00:00', note: 'الميكروفون لم يبدأ بعد' },
    actions: ['بدء التسجيل', 'إضافة يدويًا'],
    components: ['VoiceState', 'PermissionState']
  }),
  s('voice-recording-ar', '04-add', 'voice-recording-ar.png', 'Voice Recording', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'جار التسجيل',
    hero: { label: 'المدة', value: '00:18', note: 'استمر أو أوقف لتحليل الكلام' },
    rows: [['المصدر', 'صوت'], ['الخصوصية', 'لا يتم حفظ التسجيل بعد التحليل']],
    actions: ['إيقاف وتحليل', 'إلغاء'],
    components: ['VoiceMeter', 'SourceMark']
  }),
  s('voice-transcript-ar', '04-add', 'voice-transcript-ar.png', 'Transcript Review', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'مراجعة النص',
    fields: [['النص المكتشف', 'دفعت 86.50 ريال في مطعم النخيل من الحساب اليومي أمس']],
    attention: ['راجع النص قبل إنشاء الحركة'],
    actions: ['تحليل النص', 'تعديل يدوي'],
    components: ['TranscriptEditor', 'AttentionRail']
  }),
  s('voice-analysis-ar', '04-add', 'voice-analysis-ar.png', 'Analysis', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'تحليل الحركة',
    state: 'جار استخراج المبلغ والحساب والفئة',
    rows: [['المبلغ', '86.50 SAR · ثقة عالية'], ['الحساب', 'الحساب اليومي · ثقة متوسطة'], ['الفئة', 'المطاعم · ثقة عالية']],
    components: ['StateView', 'SourceMark']
  }),
  s('voice-proposal-ar', '04-add', 'voice-proposal-ar.png', 'Single Proposal', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'اقتراح حركة',
    hero: { label: 'مصروف مقترح', value: '−86.50 SAR', note: 'مطعم النخيل · أمس' },
    rows: [['المصدر', 'صوت'], ['الفئة', 'المطاعم'], ['الحساب', 'الحساب اليومي']],
    actions: ['تأكيد الحفظ', 'تعديل قبل الحفظ'],
    components: ['SourceMark', 'ReviewDecision']
  }),
  s('voice-multiple-low-ar', '04-add', 'voice-multiple-low-ar.png', 'Multiple Proposals + Low Confidence', 'app/(tabs)/add.tsx?mode=voice', {
    title: 'مراجعة مقترحات متعددة',
    attention: ['يوجد حقل غير مؤكد في الاقتراح الثاني'],
    rows: [['قهوة', '−18 SAR · الحساب اليومي'], ['وقود', '−140 SAR · الحساب غير مؤكد'], ['تحويل للمحفظة', '300 SAR · تحويل']],
    actions: ['حفظ المختار', 'تعديل الحقول'],
    components: ['AttentionRail', 'ProposalCard']
  }),

  s('tracking-status-ar', '05-tracking', 'tracking-status-ar.png', 'Tracking Status', 'app/tracking/index.tsx', {
    title: 'التتبع التلقائي',
    hero: { label: 'الحالة', value: 'نشط', note: 'آخر رسالة مالية قبل 12 دقيقة' },
    metrics: [['للمراجعة', '17'], ['أضيف تلقائيًا', '42'], ['تجاهل آمن', '9']],
    attention: ['إذن الرسائل يعمل، لكن البطارية قد توقف التتبع'],
    rows: [['الصحة', 'ممتازة'], ['الحماية', 'OTP والإعلانات لا تُضاف'], ['آخر فحص', 'منذ 12 دقيقة']],
    components: ['FinancialPulse', 'AttentionRail', 'PermissionState']
  }),
  s('tracking-history-ar', '05-tracking', 'tracking-history-ar.png', 'Tracking History', 'app/tracking/history.tsx', {
    title: 'سجل التتبع',
    rows: [['رسالة بنك الراجحي', 'أضيفت تلقائيًا · −52 SAR'], ['STC Pay', 'تحتاج مراجعة · −120 SAR'], ['رمز تحقق', 'تم تجاهله للحماية'], ['رسالة تسويقية', 'تم تجاهلها']],
    chips: ['الكل', 'أضيف', 'مراجعة', 'محمي'],
    components: ['SourceMark', 'GroupedList']
  }),
  s('tracking-keywords-ar', '05-tracking', 'tracking-keywords-ar.png', 'Keywords', 'app/tracking/keywords.tsx', {
    title: 'الكلمات المفتاحية',
    subtitle: 'قواعد تساعد التتبع بدون تغيير منطق الحفظ',
    rows: [['مدى', 'مصروف · نشطة'], ['حوالة واردة', 'دخل · نشطة'], ['رمز تحقق', 'محمي · لا يضاف']],
    actions: ['إضافة كلمة'],
    components: ['ManagementList']
  }),
  s('tracking-senders-ar', '05-tracking', 'tracking-senders-ar.png', 'Senders', 'app/tracking/senders.tsx', {
    title: 'المرسلون',
    rows: [['AlRajhiBank', 'موثوق · 23 حركة'], ['STCPay', 'تحتاج مراجعة أحيانًا'], ['PromoSMS', 'محظور']],
    actions: ['إضافة مرسل'],
    components: ['GroupedList', 'StatusBadge']
  }),
  s('tracking-review-queue-ar', '05-tracking', 'tracking-review-queue-ar.png', 'Review Queue', 'app/tracking/review/index.tsx', {
    title: 'مراجعة الحركات المكتشفة',
    attention: ['لم يتم تغيير الرصيد لهذه العناصر بعد'],
    rows: [['STC Pay', '−120 SAR · الحساب غير مؤكد'], ['مطعم النخيل', '−86.50 SAR · فئة مقترحة'], ['تحويل وارد', '+2,000 SAR · يحتاج تأكيد']],
    components: ['AttentionRail', 'SourceMark', 'TransactionCandidateRow']
  }),
  s('tracking-review-detail-ar', '05-tracking', 'tracking-review-detail-ar.png', 'Review Detail', 'app/tracking/review/[id].tsx', {
    title: 'مراجعة رسالة مالية',
    hero: { label: 'اقتراح', value: '−120.00 SAR', note: 'STC Pay · اشتراكات' },
    rows: [['سبب المراجعة', 'الحساب غير مؤكد'], ['النص المصدر', 'تم إخفاء أجزاء حساسة'], ['الأثر', 'لن يحفظ قبل التأكيد']],
    actions: ['تأكيد', 'تعديل', 'تجاهل'],
    components: ['ReviewDecision', 'SourceMark']
  }),
  s('tracking-duplicate-ar', '05-tracking', 'tracking-duplicate-ar.png', 'Duplicate Review', 'app/tracking/duplicates/[id].tsx', {
    title: 'احتمال تكرار',
    rows: [['المكتشفة', 'مطعم النخيل · −86.50 SAR'], ['الموجودة', 'مطعم النخيل · −86.50 SAR'], ['التطابق', 'نفس المبلغ والتاريخ']],
    actions: ['دمج', 'حفظ كحركة جديدة'],
    components: ['ConflictSurface']
  }),
  s('tracking-obligation-match-ar', '05-tracking', 'tracking-obligation-match-ar.png', 'Obligation Match', 'app/obligations/[obligationId]/match.tsx', {
    title: 'مطابقة التزام',
    hero: { label: 'قسط محتمل', value: '−1,200 SAR', note: 'تمويل السيارة · يستحق اليوم' },
    rows: [['الرسالة', 'خصم شهري من البنك'], ['القسط', '3 من 12'], ['الأثر', 'تحديث سجل الالتزام بعد التأكيد']],
    actions: ['مطابقة القسط', 'ليست لهذا الالتزام'],
    components: ['CalmProgress', 'SourceMark']
  }),
  s('tracking-feedback-ar', '05-tracking', 'automatic-add-feedback-ar.png', 'Automatic Add Feedback', 'tracking feedback surface', {
    title: 'تمت إضافة حركة تلقائيًا',
    hero: { label: 'مصروف جديد', value: '−52.00 SAR', note: 'مدى · بقالة' },
    actions: ['تراجع خلال 30 ثانية', 'تعديل'],
    rows: [['المصدر', 'رسالة مالية من مرسل موثوق'], ['الحالة', 'قيد المزامنة']],
    components: ['Toast/Banner', 'SourceMark', 'Undo']
  }),
  s('tracking-permission-ar', '05-tracking', 'tracking-permission-ar.png', 'Permission / Interrupted Tracking', 'app/tracking/index.tsx', {
    title: 'التتبع يحتاج إذن',
    state: 'لا يمكن قراءة الرسائل المالية بدون إذن Android SMS',
    rows: [['ما سنستخدمه', 'الرسائل المالية فقط'], ['ما لن نضيفه', 'رموز التحقق والإعلانات'], ['لو رفضت', 'استخدم الإدخال اليدوي أو الصوتي']],
    actions: ['فتح إعدادات الإذن', 'استخدام الإدخال اليدوي'],
    components: ['PermissionEducation', 'StateView']
  }),

  s('home-main-ar', '06-home', 'home-main-ar.png', 'Home', 'app/(tabs)/home.tsx', {
    title: 'صباح الخير',
    tab: 'home',
    scope: 'أغسطس · كل الحسابات',
    hero: { label: 'صافي الوضع المالي', value: '12,840.50 SAR', note: 'أفضل من الشهر الماضي بـ 8%' },
    metrics: [['الدخل', '18,400 SAR'], ['المصروف', '5,559.50 SAR'], ['معدل الصرف', 'هادئ']],
    attention: ['17 حركة تلقائية تحتاج مراجعة', 'قسط السيارة يستحق بعد يومين', 'ميزانية المطاعم وصلت 82%'],
    rows: [['راتب أغسطس', 'دخل · تلقائي', '+18,000 SAR'], ['مطعم النخيل', 'مطاعم · يدوي', '−86.50 SAR']],
    progress: [['ميزانية الطعام', 82, '1,246 من 1,500 SAR'], ['هدف السفر', 46, '6,900 من 15,000 SAR']],
    components: ['FinancialPulse', 'AttentionRail', 'TransactionRow', 'CalmProgress']
  }),
  s('home-main-en', '06-home', 'home-main-en.png', 'Home EN', 'app/(tabs)/home.tsx', {
    lang: 'en',
    title: 'Good morning',
    tab: 'home',
    scope: 'August · All accounts',
    hero: { label: 'Net position', value: '12,840.50 SAR', note: '8% better than last month' },
    metrics: [['Income', '18,400 SAR'], ['Expense', '5,559.50 SAR'], ['Pace', 'Calm']],
    attention: ['17 detected items need review', 'Car installment due in 2 days', 'Restaurants budget at 82%'],
    rows: [['August salary', 'Income · Automatic', '+18,000 SAR'], ['Al Nakheel Restaurant', 'Restaurants · Manual', '−86.50 SAR']],
    progress: [['Food budget', 82, '1,246 of 1,500 SAR'], ['Travel goal', 46, '6,900 of 15,000 SAR']],
    components: ['FinancialPulse', 'AttentionRail', 'CalmProgress']
  }),

  s('salary-overview-ar', '07-salary', 'salary-overview-ar.png', 'Salary Overview', 'app/salary/index.tsx', {
    title: 'الراتب',
    hero: { label: 'المتبقي من الراتب', value: '9,420 SAR', note: '18 يومًا حتى الراتب القادم' },
    progress: [['المصروف حتى الآن', 41, '5,580 من 13,500 SAR'], ['الادخار المخطط', 67, '2,000 من 3,000 SAR']],
    rows: [['آخر راتب', '8 أغسطس · +18,000 SAR'], ['خصومات متوقعة', 'قرض السيارة · اشتراكات']],
    components: ['FinancialPulse', 'CalmProgress']
  }),
  s('salary-profile-ar', '07-salary', 'salary-profile-ar.png', 'Salary Profile', 'app/salary/profile.tsx', {
    title: 'ملف الراتب',
    fields: [['قيمة الراتب', '18,000 SAR'], ['يوم الصرف', '8 من كل شهر'], ['حساب الاستلام', 'الحساب اليومي'], ['التنبيه', 'قبل يومين']],
    actions: ['حفظ الإعدادات'],
    components: ['FocusedForm']
  }),
  s('salary-receipt-review-ar', '07-salary', 'salary-receipt-review-ar.png', 'Salary Receipt Review', 'app/salary/receipt/[receiptId].tsx', {
    title: 'مراجعة استلام الراتب',
    hero: { label: 'دخل مكتشف', value: '+18,000 SAR', note: 'رسالة من البنك · تلقائي' },
    rows: [['مطابقة الملف', 'قيمة الراتب متطابقة'], ['الحساب', 'الحساب اليومي'], ['الأثر', 'إضافة دخل بعد التأكيد']],
    actions: ['تأكيد الراتب', 'ليس راتبًا'],
    components: ['SourceMark', 'ReviewDecision']
  }),

  s('budgets-overview-ar', '08-budgets', 'budgets-overview-ar.png', 'Budget Overview', 'app/budgets/index.tsx', {
    title: 'الميزانيات',
    hero: { label: 'المتبقي هذا الشهر', value: '3,240 SAR', note: 'ضمن الخطة' },
    progress: [['المطاعم', 82, '1,246 من 1,500 SAR'], ['الوقود', 54, '430 من 800 SAR'], ['الاشتراكات', 96, '480 من 500 SAR']],
    attention: ['ميزانية الاشتراكات قريبة من الحد'],
    actions: ['إنشاء ميزانية'],
    components: ['CalmProgress', 'AttentionRail']
  }),
  s('budget-create-ar', '08-budgets', 'budget-create-ar.png', 'Create Budget', 'app/budgets/new.tsx', {
    title: 'إنشاء ميزانية',
    fields: [['الفئة', 'المطاعم'], ['الحد الشهري', '1,500 SAR'], ['الفترة', 'أغسطس 2026'], ['التنبيه', 'عند 80%']],
    actions: ['حفظ الميزانية'],
    components: ['FocusedForm', 'CategoryPicker']
  }),
  s('budget-edit-ar', '08-budgets', 'budget-edit-ar.png', 'Edit Budget', 'app/budgets/edit/[budgetId].tsx', {
    title: 'تعديل ميزانية المطاعم',
    hero: { label: 'المستخدم الآن', value: '1,246 SAR', note: '82% من الحد الحالي' },
    fields: [['الحد الشهري', '1,500 SAR'], ['التنبيه', '80%'], ['الحالة', 'نشطة']],
    actions: ['حفظ التعديل'],
    components: ['CalmProgress', 'FormField']
  }),
  s('budget-allocation-ar', '08-budgets', 'budget-allocation-ar.png', 'Budget Allocation', 'app/budgets/allocation/[budgetId].tsx', {
    title: 'توزيع الميزانية',
    progress: [['احتياجات ثابتة', 60, '6,000 SAR'], ['مرونة يومية', 25, '2,500 SAR'], ['ادخار', 15, '1,500 SAR']],
    actions: ['تحديث التوزيع'],
    components: ['CalmProgress']
  }),
  s('budget-transactions-ar', '08-budgets', 'budget-transactions-ar.png', 'Budget Transactions', 'app/budgets/transactions/[budgetId].tsx', {
    title: 'حركات ميزانية المطاعم',
    scope: 'أغسطس · المطاعم',
    rows: [['مطعم النخيل', '8 أغسطس', '−86.50 SAR'], ['قهوة المساء', '7 أغسطس', '−18 SAR'], ['غداء العمل', '6 أغسطس', '−124 SAR']],
    components: ['TransactionRow', 'ActiveFilterChips']
  }),

  s('obligations-overview-ar', '09-obligations', 'obligations-overview-ar.png', 'Obligations Overview', 'app/obligations/index.tsx', {
    title: 'الالتزامات',
    hero: { label: 'المستحق قريبًا', value: '1,200 SAR', note: 'قسط السيارة · بعد يومين' },
    progress: [['تمويل السيارة', 25, '3 من 12 قسط'], ['اشتراك الإنترنت', 100, 'مدفوع هذا الشهر']],
    actions: ['إضافة التزام'],
    components: ['CalmProgress', 'AttentionRail']
  }),
  s('obligation-detail-ar', '09-obligations', 'obligation-detail-ar.png', 'Obligation Detail', 'app/obligations/[obligationId].tsx', {
    title: 'تمويل السيارة',
    hero: { label: 'القسط القادم', value: '1,200 SAR', note: '10 أغسطس 2026' },
    progress: [['الجدول', 25, '3 من 12 قسط'], ['المبلغ المدفوع', 25, '3,600 من 14,400 SAR']],
    rows: [['الحساب', 'الحساب اليومي'], ['التذكير', 'قبل يومين']],
    actions: ['تسجيل دفعة', 'تعديل'],
    components: ['CalmProgress', 'Timeline']
  }),
  s('obligation-form-ar', '09-obligations', 'obligation-form-ar.png', 'Create/Edit Obligation', 'app/obligations/new.tsx + edit', {
    title: 'إضافة التزام',
    fields: [['الاسم', 'تمويل السيارة'], ['القسط', '1,200 SAR'], ['عدد الأقساط', '12'], ['تاريخ الاستحقاق', '10 من كل شهر']],
    actions: ['حفظ الالتزام'],
    components: ['FocusedForm']
  }),
  s('obligation-payment-ar', '09-obligations', 'obligation-payment-ar.png', 'Payment', 'app/obligations/[obligationId]/payment.tsx', {
    title: 'تسجيل دفعة',
    hero: { label: 'دفعة القسط', value: '1,200 SAR', note: 'تمويل السيارة' },
    fields: [['الحساب', 'الحساب اليومي'], ['التاريخ', 'اليوم'], ['ملاحظة', 'خصم بنكي تلقائي']],
    actions: ['تأكيد الدفعة'],
    components: ['PaymentForm', 'AmountText']
  }),
  s('installment-timeline-ar', '09-obligations', 'installment-timeline-ar.png', 'Installment Timeline', 'app/obligations/[obligationId].tsx', {
    title: 'جدول الأقساط',
    rows: [['1', 'مدفوع · 10 يونيو', '1,200 SAR'], ['2', 'مدفوع · 10 يوليو', '1,200 SAR'], ['3', 'مستحق · 10 أغسطس', '1,200 SAR'], ['4', 'قادم · 10 سبتمبر', '1,200 SAR']],
    components: ['Timeline', 'StatusBadge']
  }),
  s('match-review-ar', '09-obligations', 'match-review-ar.png', 'Match Review', 'app/obligations/[obligationId]/match.tsx', {
    title: 'مراجعة مطابقة قسط',
    rows: [['الحركة المكتشفة', '−1,200 SAR · البنك'], ['القسط المتوقع', '1,200 SAR · تمويل السيارة'], ['الأثر', 'تحديث القسط رقم 3']],
    actions: ['مطابقة', 'رفض'],
    components: ['ReviewDecision']
  }),

  s('savings-overview-ar', '10-savings', 'savings-overview-ar.png', 'Savings Overview', 'app/savings/index.tsx', {
    title: 'الادخار',
    hero: { label: 'إجمالي الأهداف', value: '22,400 SAR', note: '3 أهداف نشطة' },
    progress: [['السفر', 46, '6,900 من 15,000 SAR'], ['الطوارئ', 72, '14,400 من 20,000 SAR']],
    actions: ['إضافة هدف'],
    components: ['CalmProgress']
  }),
  s('savings-detail-ar', '10-savings', 'savings-detail-ar.png', 'Savings Goal Detail', 'app/savings/[goalId].tsx', {
    title: 'هدف السفر',
    hero: { label: 'المدخر', value: '6,900 SAR', note: '46% من الهدف' },
    progress: [['التقدم', 46, 'باقي 8,100 SAR'], ['المساهمة الشهرية', 60, '600 SAR مقترحة']],
    rows: [['موعد الهدف', 'ديسمبر 2026'], ['آخر حركة', '+500 SAR']],
    actions: ['إضافة حركة', 'تعديل الهدف'],
    components: ['CalmProgress']
  }),
  s('savings-form-ar', '10-savings', 'savings-form-ar.png', 'Create/Edit Goal', 'app/savings/new.tsx + edit', {
    title: 'إضافة هدف ادخار',
    fields: [['اسم الهدف', 'رحلة نهاية السنة'], ['المبلغ المستهدف', '15,000 SAR'], ['المبلغ الحالي', '6,900 SAR'], ['تاريخ الهدف', 'ديسمبر 2026']],
    actions: ['حفظ الهدف'],
    components: ['FocusedForm']
  }),
  s('savings-movement-ar', '10-savings', 'savings-movement-ar.png', 'Movement', 'app/savings/[goalId]/movement.tsx', {
    title: 'حركة ادخار',
    chips: ['إضافة', 'سحب'],
    fields: [['المبلغ', '500 SAR'], ['الحساب', 'الحساب اليومي'], ['ملاحظة', 'تحويل شهري']],
    actions: ['حفظ الحركة'],
    components: ['SegmentedControl', 'AccountPicker']
  }),

  s('reports-overview-ar', '11-reports', 'reports-overview-ar.png', 'Reports Overview', 'app/(tabs)/reports.tsx', {
    title: 'التقارير',
    tab: 'reports',
    scope: 'أغسطس 2026',
    hero: { label: 'أعلى مجال صرف', value: 'المطاعم', note: '1,246.75 SAR · 22% من المصروف' },
    chart: 'spending',
    rows: [['المطاعم', '1,246.75 SAR'], ['البقالة', '980 SAR'], ['الاشتراكات', '480 SAR']],
    actions: ['عرض التفاصيل', 'تصدير تقرير'],
    components: ['ChartSummary', 'FinancialPulse']
  }),
  s('reports-overview-en', '11-reports', 'reports-overview-en.png', 'Reports Overview EN', 'app/(tabs)/reports.tsx', {
    lang: 'en',
    title: 'Reports',
    tab: 'reports',
    scope: 'August 2026',
    hero: { label: 'Top spend area', value: 'Restaurants', note: '1,246.75 SAR · 22% of expenses' },
    chart: 'spending',
    rows: [['Restaurants', '1,246.75 SAR'], ['Groceries', '980 SAR'], ['Subscriptions', '480 SAR']],
    actions: ['View details', 'Export report'],
    components: ['ChartSummary']
  }),
  s('financial-insights-ar', '11-reports', 'financial-insights-ar.png', 'Financial Insights', 'app/(tabs)/reports.tsx', {
    title: 'رؤى مالية',
    attention: ['الصرف على المطاعم أعلى من متوسط 3 أشهر', 'اشتراك متكرر جديد ظهر هذا الشهر'],
    rows: [['اقتراح', 'راجع ميزانية المطاعم قبل نهاية الشهر'], ['سياق', 'مصروفات نهاية الأسبوع زادت 18%']],
    actions: ['اسأل المساعد عن السبب'],
    components: ['InsightCard', 'AttentionRail', 'AssistantEntry']
  }),
  s('spending-breakdown-ar', '11-reports', 'spending-breakdown-ar.png', 'Spending Breakdown', 'app/reports/drill-down.tsx', {
    title: 'تفصيل المصروف',
    chart: 'bars',
    rows: [['مطاعم', '42 حركة · 1,246.75 SAR'], ['بقالة', '18 حركة · 980 SAR'], ['وقود', '6 حركات · 430 SAR']],
    components: ['AccessibleChart', 'TransactionDrilldown']
  }),
  s('trend-comparison-ar', '11-reports', 'trend-comparison-ar.png', 'Trend / Comparison', 'app/reports/drill-down.tsx', {
    title: 'مقارنة الاتجاه',
    hero: { label: 'مقارنة بالشهر الماضي', value: '−8%', note: 'الصرف أقل من يوليو' },
    chart: 'trend',
    metrics: [['يوليو', '6,040 SAR'], ['أغسطس', '5,559 SAR'], ['الفرق', '−481 SAR']],
    components: ['TrendChart', 'FinancialPulse']
  }),
  s('report-drilldown-ar', '11-reports', 'report-drilldown-ar.png', 'Drill-down', 'app/reports/drill-down.tsx', {
    title: 'حركات المطاعم',
    rows: [['مطعم النخيل', '−86.50 SAR'], ['غداء العمل', '−124 SAR'], ['قهوة المساء', '−18 SAR']],
    chips: ['مطاعم', 'أغسطس', 'الحساب اليومي'],
    components: ['TransactionRow', 'ActiveFilterChips']
  }),
  s('report-preview-ar', '11-reports', 'report-preview-ar.png', 'Report Preview', 'app/reports/preview.tsx', {
    title: 'معاينة التقرير',
    rows: [['الفترة', 'أغسطس 2026'], ['النطاق', 'كل الحسابات'], ['الأقسام', 'ملخص · فئات · اتجاهات']],
    actions: ['تصدير PDF', 'مشاركة'],
    components: ['PreviewSurface']
  }),
  s('report-schedule-ar', '11-reports', 'report-schedule-ar.png', 'Report Schedule', 'app/reports/schedule.tsx', {
    title: 'جدولة تقرير',
    fields: [['التكرار', 'شهري'], ['اليوم', 'آخر يوم في الشهر'], ['القناة', 'إشعار داخل التطبيق'], ['اللغة', 'العربية']],
    actions: ['حفظ الجدولة'],
    components: ['FocusedForm']
  }),

  s('assistant-home-ar', '12-assistant', 'assistant-home-ar.png', 'Assistant Home', 'app/assistant/index.tsx', {
    title: 'المساعد',
    subtitle: 'اسأل عن أموالك مع سياق واضح وقابل للتتبع',
    rows: [['لماذا زاد صرف المطاعم؟', 'يربط التقارير بالحركات'], ['راجع الحركات التلقائية', 'يفتح قائمة المراجعة'], ['اقترح خطة ادخار', 'بدون تغيير قبل موافقتك']],
    components: ['AssistantPromptList']
  }),
  s('assistant-conversation-ar', '12-assistant', 'assistant-conversation-ar.png', 'Conversation', 'app/assistant/[conversationId]/index.tsx', {
    title: 'محادثة مالية',
    conversation: [['user', 'ليش صرف المطاعم عالي؟'], ['assistant', 'أعلى 3 حركات كانت في نهاية الأسبوع، والإجمالي 1,246.75 SAR.'], ['assistant', 'هل تريد فتح تفصيل المطاعم؟']],
    actions: ['فتح التفصيل'],
    components: ['AssistantMessage', 'EvidenceLink']
  }),
  s('assistant-evidence-ar', '12-assistant', 'assistant-evidence-ar.png', 'Evidence Display', 'app/assistant/[conversationId]/index.tsx', {
    title: 'الأدلة المستخدمة',
    rows: [['تقرير المطاعم', 'أغسطس · 1,246.75 SAR'], ['3 حركات كبيرة', 'مطعم النخيل، غداء العمل، قهوة'], ['حد الميزانية', '1,500 SAR']],
    components: ['EvidenceCard', 'SourceMark']
  }),
  s('assistant-action-preview-ar', '12-assistant', 'assistant-action-preview-ar.png', 'Action Preview', 'app/assistant/[conversationId]/actions/[previewId].tsx', {
    title: 'معاينة إجراء',
    hero: { label: 'اقتراح تعديل ميزانية', value: '1,800 SAR', note: 'لن يتم الحفظ قبل التأكيد' },
    rows: [['الحالي', '1,500 SAR'], ['المقترح', '1,800 SAR'], ['السبب', 'متوسط 3 أشهر أعلى من الحد']],
    actions: ['تطبيق التعديل', 'رفض'],
    components: ['ReviewDecision', 'ConsequenceSummary']
  }),
  s('assistant-limit-ar', '12-assistant', 'assistant-limit-ar.png', 'Limit / Unavailable State', 'app/assistant/index.tsx', {
    title: 'المساعد غير متاح مؤقتًا',
    state: 'لا يمكن تحميل المحادثة الآن. بياناتك المالية لم تتغير.',
    actions: ['إعادة المحاولة', 'فتح التقارير'],
    components: ['StateView']
  }),

  s('notifications-center-ar', '13-notifications', 'notifications-center-ar.png', 'Notification Center', 'app/notifications/index.tsx', {
    title: 'الإشعارات',
    chips: ['الكل', 'مالية', 'مراجعة', 'أمان'],
    rows: [['حركة تحتاج مراجعة', 'STC Pay · −120 SAR'], ['قسط قريب', 'تمويل السيارة بعد يومين'], ['جلسة جديدة', 'تم تسجيل دخول من Pixel 8']],
    components: ['NotificationRow', 'SourceMark']
  }),
  s('notification-filters-ar', '13-notifications', 'notification-filters-ar.png', 'Notification Filters', 'app/notifications/index.tsx', {
    title: 'تصفية الإشعارات',
    fields: [['النوع', 'مالية · أمان · دعم'], ['الحالة', 'غير مقروءة'], ['الفترة', 'آخر 30 يوم']],
    actions: ['تطبيق'],
    components: ['FilterSheet']
  }),
  s('notification-preferences-ar', '13-notifications', 'notification-preferences-ar.png', 'Notification Preferences', 'app/notifications/preferences.tsx', {
    title: 'تفضيلات الإشعارات',
    rows: [['مراجعة الحركات', 'مفعل'], ['الأقساط القريبة', 'قبل يومين'], ['تقارير شهرية', 'مفعل'], ['أمان الحساب', 'دائمًا مفعل']],
    components: ['GroupedSettings']
  }),

  s('more-hub-ar', '14-more-settings', 'more-hub-ar.png', 'More Hub', 'app/(tabs)/more.tsx', {
    title: 'المزيد',
    tab: 'more',
    rows: [['الحسابات والفئات', 'إدارة الحسابات، الفئات، العملة'], ['التخطيط', 'الراتب، الميزانيات، الالتزامات، الادخار'], ['الأمان والخصوصية', 'PIN، الجلسات، إخفاء القيم'], ['الدعم والاشتراك', 'التذاكر والخطة الحالية']],
    components: ['GroupedList', 'NavigationRow']
  }),
  s('more-hub-en', '14-more-settings', 'more-hub-en.png', 'More Hub EN', 'app/(tabs)/more.tsx', {
    lang: 'en',
    title: 'More',
    tab: 'more',
    rows: [['Accounts and categories', 'Manage accounts, categories, currency'], ['Planning', 'Salary, budgets, obligations, savings'], ['Security and privacy', 'PIN, sessions, hidden values'], ['Support and subscription', 'Tickets and current plan']],
    components: ['GroupedList']
  }),
  s('profile-ar', '14-more-settings', 'profile-ar.png', 'Profile', 'app/profile/index.tsx', {
    title: 'الملف الشخصي',
    rows: [['الاسم', 'حساب مصاريفي'], ['اللغة', 'العربية'], ['العملة الأساسية', 'SAR'], ['اكتمال الملف', '80%']],
    actions: ['تعديل الملف'],
    components: ['GroupedSettings']
  }),
  s('app-settings-ar', '14-more-settings', 'app-settings-ar.png', 'Application Settings', 'app/profile/application.tsx', {
    title: 'إعدادات التطبيق',
    rows: [['المظهر', 'حسب النظام'], ['إخفاء القيم', 'مفعل'], ['بداية الشهر', '1st'], ['اللغة والتنبيهات', 'العربية']],
    components: ['GroupedSettings', 'SensitiveValue']
  }),

  s('security-settings-ar', '15-security-privacy', 'security-settings-ar.png', 'Security Settings', 'app/security/settings.tsx', {
    title: 'الأمان',
    rows: [['قفل التطبيق', 'PIN مفعل'], ['الجلسات النشطة', '2 جهاز'], ['أحداث الأمان', 'آخر حدث اليوم'], ['تغيير PIN', 'متاح']],
    components: ['GroupedSettings']
  }),
  s('unlock-ar', '15-security-privacy', 'unlock-ar.png', 'Unlock', 'app/security/unlock.tsx', {
    title: 'فتح التطبيق',
    state: 'أدخل PIN لعرض القيم المالية',
    fields: [['PIN', '••••']],
    actions: ['فتح'],
    components: ['SecureInput', 'SensitiveValue']
  }),
  s('pin-create-ar', '15-security-privacy', 'pin-create-ar.png', 'Create PIN', 'app/security/pin/create.tsx', {
    title: 'إنشاء PIN',
    fields: [['PIN جديد', '••••'], ['تأكيد لاحق', 'في الشاشة التالية']],
    actions: ['متابعة'],
    components: ['SecureInput']
  }),
  s('pin-change-ar', '15-security-privacy', 'pin-change-ar.png', 'Change PIN', 'app/security/pin/change.tsx', {
    title: 'تغيير PIN',
    fields: [['PIN الحالي', '••••'], ['PIN جديد', '••••']],
    actions: ['حفظ'],
    components: ['SecureInput']
  }),
  s('sessions-ar', '15-security-privacy', 'sessions-ar.png', 'Sessions', 'app/security/sessions.tsx', {
    title: 'الجلسات النشطة',
    rows: [['Pixel 8', 'الجهاز الحالي · Android'], ['Old iPhone', 'آخر نشاط قبل يومين']],
    actions: ['تسجيل خروج الأجهزة الأخرى'],
    components: ['GroupedList', 'Confirmation']
  }),
  s('security-events-ar', '15-security-privacy', 'security-events-ar.png', 'Security Events', 'app/security/events.tsx', {
    title: 'أحداث الأمان',
    rows: [['تسجيل دخول جديد', 'Pixel 8 · اليوم'], ['تغيير PIN', 'أمس'], ['تصدير تقرير', 'قبل 3 أيام']],
    components: ['Timeline']
  }),
  s('privacy-settings-ar', '15-security-privacy', 'privacy-settings-ar.png', 'Privacy Settings', 'app/profile/privacy.tsx', {
    title: 'الخصوصية',
    rows: [['إخفاء القيم', 'مفعل'], ['إخفاء في مبدل التطبيقات', 'دائمًا'], ['الإشعارات المالية', 'بدون مبالغ حساسة'], ['الأدلة للمساعد', 'حسب السياق']],
    components: ['SensitiveValue', 'GroupedSettings']
  }),

  s('subscription-overview-ar', '16-subscription', 'subscription-overview-ar.png', 'Subscription Overview', 'app/subscriptions/index.tsx', {
    title: 'الاشتراك',
    hero: { label: 'الخطة الحالية', value: 'Basic', note: 'ميزات أساسية نشطة' },
    rows: [['التقارير المتقدمة', 'ضمن Pro'], ['المساعد المالي', 'حد شهري'], ['الدعم', 'عادي']],
    actions: ['ترقية الخطة'],
    components: ['PlanCard']
  }),
  s('subscription-checkout-ar', '16-subscription', 'subscription-checkout-ar.png', 'Checkout', 'app/subscriptions/checkout.tsx', {
    title: 'تأكيد الاشتراك',
    rows: [['الخطة', 'Pro شهري'], ['السعر', '29 SAR / شهر'], ['التجديد', 'يمكن الإلغاء من الإدارة']],
    actions: ['متابعة الدفع', 'رجوع'],
    components: ['CheckoutSummary']
  }),
  s('subscription-manage-ar', '16-subscription', 'subscription-manage-ar.png', 'Manage Subscription', 'app/subscriptions/manage.tsx', {
    title: 'إدارة الاشتراك',
    rows: [['الحالة', 'نشط'], ['التجديد القادم', '15 سبتمبر 2026'], ['طريقة الدفع', 'بطاقة منتهية 2048']],
    actions: ['تغيير الخطة', 'إلغاء التجديد'],
    components: ['GroupedSettings', 'ConfirmDialog']
  }),

  s('support-home-ar', '17-support', 'support-home-ar.png', 'Support Home', 'app/support/index.tsx', {
    title: 'الدعم',
    rows: [['تذكرة جديدة', 'مشكلة في حركة أو اشتراك'], ['تذاكري', '2 مفتوحة'], ['الأسئلة الشائعة', 'الأمان، التتبع، الفواتير']],
    components: ['GroupedList']
  }),
  s('support-new-ticket-ar', '17-support', 'support-new-ticket-ar.png', 'New Ticket', 'app/support/new.tsx', {
    title: 'تذكرة دعم جديدة',
    fields: [['الموضوع', 'مشكلة في حركة تلقائية'], ['السياق', 'STC Pay · −120 SAR'], ['الوصف', 'أريد تعديل الفئة']],
    actions: ['إرسال التذكرة'],
    components: ['FocusedForm', 'ContextAttachment']
  }),
  s('support-ticket-list-ar', '17-support', 'support-ticket-list-ar.png', 'Ticket List', 'app/support/tickets/index.tsx', {
    title: 'تذاكر الدعم',
    rows: [['#1042', 'مفتوحة · حركة تلقائية'], ['#1039', 'تم الرد · اشتراك'], ['#1032', 'مغلقة · تقرير']],
    components: ['GroupedList', 'StatusBadge']
  }),
  s('support-ticket-detail-ar', '17-support', 'support-ticket-detail-ar.png', 'Ticket Detail', 'app/support/tickets/[id].tsx', {
    title: 'تذكرة #1042',
    conversation: [['user', 'الحركة ظهرت بفئة غير صحيحة.'], ['assistant', 'تم استلام التذكرة. سنراجع المصدر والسجل.']],
    actions: ['إضافة رد', 'إغلاق التذكرة'],
    components: ['Conversation', 'SupportStatus']
  }),

  s('auth-language-ar', '18-auth', 'auth-language-ar.png', 'Language Selection', 'app/(public)/language.tsx', {
    title: 'اختر اللغة',
    rows: [['العربية', 'واجهة RTL وأرقام إنجليزية'], ['English', 'LTR interface']],
    actions: ['متابعة'],
    components: ['LanguageChoice']
  }),
  s('auth-welcome-ar', '18-auth', 'auth-welcome-ar.png', 'Welcome', 'app/(public)/welcome.tsx', {
    title: 'مصاريفي',
    subtitle: 'افهم مصروفك بهدوء وراجع التلقائي قبل أن يؤثر على سجلك',
    actions: ['تسجيل الدخول', 'إنشاء حساب'],
    components: ['PublicHero']
  }),
  s('auth-sign-in-ar', '18-auth', 'auth-sign-in-ar.png', 'Sign In', 'app/(public)/sign-in.tsx', {
    title: 'تسجيل دخول آمن',
    actions: ['رقم الجوال', 'Google'],
    components: ['AuthMethodChooser']
  }),
  s('auth-sign-up-ar', '18-auth', 'auth-sign-up-ar.png', 'Sign Up', 'app/(public)/sign-up.tsx', {
    title: 'إنشاء حساب',
    actions: ['رقم الجوال', 'Google'],
    rows: [['البيانات المالية', 'تبقى محمية ومخفية افتراضيًا']],
    components: ['AuthMethodChooser']
  }),
  s('auth-phone-ar', '18-auth', 'auth-phone-ar.png', 'Phone', 'app/(public)/phone.tsx', {
    title: 'رقم الجوال',
    fields: [['رقم الجوال', '+966 5X XXX XXXX']],
    actions: ['إرسال الرمز'],
    components: ['PhoneAuthForm']
  }),
  s('auth-otp-ar', '18-auth', 'auth-otp-ar.png', 'OTP', 'app/(public)/otp.tsx', {
    title: 'رمز التحقق',
    fields: [['الرمز', '0 0 0 0 0 0']],
    rows: [['إعادة الإرسال', 'متاح بعد 42 ثانية']],
    actions: ['تأكيد'],
    components: ['OtpVerificationForm']
  }),
  s('auth-google-ar', '18-auth', 'auth-google-ar.png', 'Google Flow', 'app/(public)/google.tsx', {
    title: 'Google',
    rows: [['اختيار حساب Google', 'يستخدم mock provider في التطبيق الحالي'], ['التعارض', 'إعادة تحقق عند الحاجة']],
    actions: ['اختيار حساب Google'],
    components: ['GoogleAccountSelector']
  }),
  s('auth-legal-ar', '18-auth', 'auth-legal-ar.png', 'Legal', 'app/(public)/legal.tsx', {
    title: 'الخصوصية والشروط',
    rows: [['الخصوصية', 'كيف نحمي البيانات المالية'], ['الشروط', 'استخدام التطبيق وحدود المسؤولية'], ['الأذونات', 'متى نطلب إذن الرسائل']],
    components: ['ReadSurface']
  }),

  s('onboarding-tracking-intro-ar', '19-onboarding', 'onboarding-tracking-intro-ar.png', 'Tracking Introduction', 'app/(onboarding)/tracking-intro.tsx', {
    title: 'التتبع التلقائي',
    subtitle: 'يقرأ الرسائل المالية المؤهلة ويعرض عليك ما يحتاج مراجعة',
    rows: [['تلقائي لكن قابل للتصحيح', 'لن نخفي عدم اليقين'], ['محمي', 'OTP والإعلانات لا تدخل سجلك']],
    actions: ['متابعة', 'التخطي الآن'],
    components: ['EducationSurface']
  }),
  s('onboarding-tracking-preferences-ar', '19-onboarding', 'onboarding-tracking-preferences-ar.png', 'Tracking Preferences', 'app/(onboarding)/tracking-preferences.tsx', {
    title: 'تفضيلات التتبع',
    rows: [['إضافة تلقائية عند الثقة العالية', 'مفعل'], ['مراجعة عند عدم اليقين', 'دائمًا'], ['إشعار بعد الإضافة', 'مفعل']],
    actions: ['حفظ التفضيلات'],
    components: ['GroupedSettings']
  }),
  s('onboarding-android-sms-ar', '19-onboarding', 'android-sms-permission-ar.png', 'Android SMS Permission Education', 'app/(onboarding)/android-sms-permission.tsx', {
    title: 'إذن رسائل Android',
    rows: [['ما نقرأه', 'رسائل مالية من مرسلين معروفين'], ['ما نستبعده', 'OTP والإعلانات والمحادثات'], ['لو رفضت', 'يبقى الإدخال اليدوي والصوتي متاحين']],
    actions: ['طلب الإذن', 'ليس الآن'],
    components: ['PermissionEducation']
  }),
  s('onboarding-ios-options-ar', '19-onboarding', 'ios-capture-options-ar.png', 'iOS Capture Alternatives', 'app/(onboarding)/ios-capture-options.tsx', {
    title: 'خيارات iOS',
    subtitle: 'iOS لا يسمح بنفس قراءة رسائل Android',
    rows: [['إضافة يدويًا', 'سريعة ومحمية'], ['إدخال صوتي', 'تحويل كلامك لمسودة'], ['اختصارات مدعومة', 'حسب إمكانيات النظام']],
    actions: ['اختيار الطريقة'],
    components: ['PlatformHonesty']
  }),
  s('onboarding-ios-automation-ar', '19-onboarding', 'ios-automation-ar.png', 'iOS Capture Alternatives', 'app/(onboarding)/ios-automation.tsx', {
    title: 'إعداد بديل iOS',
    rows: [['الخطوة 1', 'استخدم الاختصار المدعوم'], ['الخطوة 2', 'راجع المقترح قبل الحفظ'], ['الخطوة 3', 'صحح الحساب أو الفئة']],
    actions: ['فتح التعليمات'],
    components: ['StepList']
  }),
  s('onboarding-tracking-demo-ar', '19-onboarding', 'tracking-demo-ar.png', 'Tracking Demo', 'app/(onboarding)/tracking-demo.tsx', {
    title: 'تجربة التتبع',
    hero: { label: 'رسالة مالية تجريبية', value: '−52.00 SAR', note: 'تظهر كمقترح قابل للمراجعة' },
    actions: ['تأكيد المثال', 'تعديل المثال'],
    components: ['ReviewDecision', 'SourceMark']
  }),
  s('onboarding-keywords-ar', '19-onboarding', 'keyword-setup-ar.png', 'Keyword Setup', 'app/(onboarding)/tracking-keywords.tsx', {
    title: 'الكلمات المبدئية',
    rows: [['مدى', 'مصروف'], ['حوالة واردة', 'دخل'], ['رمز تحقق', 'محمي']],
    actions: ['اعتماد الكلمات'],
    components: ['ManagementList']
  }),
  s('onboarding-complete-ar', '19-onboarding', 'onboarding-complete-ar.png', 'Completion', 'app/(onboarding)/complete.tsx', {
    title: 'تم إعداد مصاريفي',
    hero: { label: 'جاهز للاستخدام', value: '5 وجهات أساسية', note: 'الرئيسية، الحركات، إضافة، التقارير، المزيد' },
    actions: ['فتح الرئيسية'],
    components: ['CompletionState']
  })
];

const homeScreenIndex = screens.findIndex(({ id }) => id === 'home-main-ar');
const homeScreen = screens[homeScreenIndex];
screens.splice(homeScreenIndex + 1, 0, {
  ...homeScreen,
  id: 'home-add-menu-ar',
  file: 'home-add-menu-ar.png',
  screen: 'Home — Quick Add Expanded',
  quickAdd: true,
  states: [...homeScreen.states, 'quick add expanded'],
  analysis: 'REDESIGN_ANALYSIS.md §8.2, §13–14'
});

const mockupEnglish = new Map([
  ['مصاريفي', 'Masarifi'],
  ['أغسطس', 'August'],
  ['يوليو', 'July'],
  ['يونيو', 'June'],
  ['سبتمبر', 'September'],
  ['ديسمبر', 'December'],
  ['نظام مصاريفي البصري', 'Masarifi visual system'],
  ['ملخص مالي واضح مع إخفاء آمن للقيم', 'A clear financial summary with safe value masking'],
  ['الصافي', 'Net'],
  ['3 حركات تحتاج مراجعة', '3 transactions need review'],
  ['تزامن معلق في 2 عنصر', '2 items pending sync'],
  ['إذن التتبع غير مكتمل', 'Tracking permission is incomplete'],
  ['تلقائي · صوت · يدوي · مساعد', 'Automatic · Voice · Manual · Assistant'],
  ['صفوف كثيفة بدل كروت متكررة', 'Dense rows instead of repeated cards'],
  ['تحميل · فارغ · خطأ · أوفلاين', 'Loading · Empty · Error · Offline'],
  ['التنقل الأساسي ثابت: الرئيسية، الحركات، إضافة، التقارير، المزيد', 'Primary navigation stays consistent: Home, Transactions, Add, Reports, More'],
  ['الموقع المالي', 'Financial position'],
  ['القيم مخفية حتى يقرر المستخدم إظهارها', 'Values stay hidden until the user reveals them'],
  ['مراجعة 17 حركة تلقائية', 'Review 17 automatic transactions'],
  ['22 عنصر قيد المزامنة', '22 items pending sync'],
  ['إجراء سريع', 'Quick action'],
  ['الحسابات، الفئات، إضافة يدويًا', 'Accounts, categories, manual entry'],
  ['سلوك RTL', 'RTL behavior'],
  ['الترتيب والمنطق حسب اللغة المختارة', 'Order and logic follow the selected language'],
  ['اختيار الحساب', 'Account selection'],
  ['Sheet موحّد يحافظ على السياق والعودة', 'A unified sheet preserves context and return flow'],
  ['الحساب اليومي', 'Daily account'],
  ['SAR 2048 · الحساب الافتراضي', 'SAR 2048 · Default account'],
  ['المحفظة', 'Wallet'],
  ['السفر', 'Travel'],
  ['نتائج البحث', 'Search results'],
  ['3 حسابات متاحة', '3 accounts available'],
  ['لا يتم إنشاء اختيار عالمي جديد', 'No new global selection state is introduced'],
  ['حالات النظام', 'System states'],
  ['نفس اللغة البصرية لكل شاشة', 'The same visual language across every screen'],
  ['تحميل', 'Loading'],
  ['Skeleton يحافظ على الهندسة', 'Skeleton preserves the layout'],
  ['توضيح السبب + إجراء واحد', 'Clear reason + one action'],
  ['سبب واضح + استعادة', 'Clear reason + recovery'],
  ['أوفلاين', 'Offline'],
  ['ما تم حفظه محليًا وما لم يتزامن بعد', 'What is saved locally and what is not synced yet'],
  ['تأكيد الأثر', 'Confirm impact'],
  ['سيتم أرشفة الحساب ولن يظهر في الاختيارات النشطة.', 'The account will be archived and removed from active selections.'],
  ['إدارة الحسابات النشطة والمؤرشفة', 'Manage active and archived accounts'],
  ['كل العملات', 'All currencies'],
  ['حساب بنكي · SAR 2048 · افتراضي', 'Bank account · SAR 2048 · Default'],
  ['محفظة · SAR', 'Wallet · SAR'],
  ['ادخار · USD 8812', 'Savings · USD 8812'],
  ['بطاقة قديمة', 'Old card'],
  ['بطاقة ائتمان · SAR 0019 · مؤرشف', 'Credit card · SAR 0019 · Archived'],
  ['حساب بنكي · SAR 2048', 'Bank account · SAR 2048'],
  ['محسوب من السجل الكامل', 'Calculated from the complete history'],
  ['راتب أغسطس', 'August salary'],
  ['دخل · تلقائي · يحتاج اعتماد', 'Income · Automatic · Needs approval'],
  ['مطعم النخيل', 'Al Nakheel Restaurant'],
  ['طعام · يدوي', 'Food · Manual'],
  ['تحويل للمحفظة', 'Transfer to wallet'],
  ['حساب الطوارئ', 'Emergency account'],
  ['نوع الحساب', 'Account type'],
  ['حساب بنكي · بطاقة · محفظة · نقد', 'Bank account · Card · Wallet · Cash'],
  ['رصيد افتتاحي', 'Opening balance'],
  ['مسودة غير محفوظة: يظهر تأكيد قبل الخروج', 'Unsaved draft: confirm before leaving'],
  ['SAR · للقراءة فقط', 'SAR · Read only'],
  ['حفظ التعديل', 'Save changes'],
  ['لا يتم تعديل الرصيد الحالي مباشرة ولا تمسح الحقول المخفية', 'Current balance is not edited directly and hidden fields are preserved'],
  ['اختيار حساب', 'Select account'],
  ['يعود إلى مسودة الإضافة بدون فقدانها', 'Returns to the add draft without losing it'],
  ['SAR 2048 · محدد', 'SAR 2048 · Selected'],
  ['بحث الحسابات', 'Search accounts'],
  ['بحث بالاسم أو العملة أو آخر 4 أرقام', 'Search by name, currency, or last 4 digits'],
  ['الحسابات المؤرشفة غير متاحة للاختيار', 'Archived accounts are unavailable for selection'],
  ['افتراضية ومخصصة مع بحث سريع', 'Default and custom categories with quick search'],
  ['السكن', 'Housing'],
  ['فئة افتراضية · 14 حركة', 'Default category · 14 transactions'],
  ['المطاعم', 'Restaurants'],
  ['مفضلة · 23 حركة', 'Favorite · 23 transactions'],
  ['القهوة', 'Coffee'],
  ['مخصصة · لون برونزي', 'Custom · Bronze color'],
  ['اشتراكات رقمية', 'Digital subscriptions'],
  ['تحتاج مراجعة قاعدة', 'Rule needs review'],
  ['المفضلة', 'Favorites'],
  ['مخصصة', 'Custom'],
  ['إضافة فئة', 'Add category'],
  ['الأيقونة', 'Icon'],
  ['مشروب', 'Beverage'],
  ['اللون', 'Color'],
  ['برونزي هادئ', 'Quiet bronze'],
  ['حفظ الفئة', 'Save category'],
  ['مصروف الشهر', 'Monthly spending'],
  ['42% من ميزانية الطعام', '42% of the food budget'],
  ['آخر حركة', 'Latest transaction'],
  ['مطعم النخيل · أمس', 'Al Nakheel Restaurant · Yesterday'],
  ['فئة افتراضية لا يمكن حذفها', 'Default category cannot be deleted'],
  ['الظهور في التقارير', 'Shown in reports'],
  ['تعديل التسمية', 'Edit label'],
  ['عرض الحركات', 'View transactions'],
  ['اختيار فئة', 'Select category'],
  ['قائمة بحث لا تكسر مسودة الحركة', 'Search does not interrupt the transaction draft'],
  ['مفضلة', 'Favorite'],
  ['البقالة', 'Groceries'],
  ['فئة افتراضية', 'Default category'],
  ['الوقود', 'Fuel'],
  ['آخر استخدام: أمس', 'Last used: yesterday'],
  ['بدون فئة', 'Uncategorized'],
  ['يتطلب مراجعة لاحقة', 'Requires later review'],
  ['إضافة فئة جديدة', 'Add new category'],
  ['تصفية الحركات', 'Filter transactions'],
  ['هذا الشهر', 'This month'],
  ['كل الحسابات', 'All accounts'],
  ['المطاعم، الاشتراكات', 'Restaurants, subscriptions'],
  ['يدوي · تلقائي · صوت', 'Manual · Automatic · Voice'],
  ['مسح', 'Clear'],
  ['الفلاتر النشطة', 'Active filters'],
  ['حساب: الحساب اليومي', 'Account: Daily account'],
  ['حالة: تحتاج مراجعة', 'Status: Needs review'],
  ['تمت أمس من الحساب اليومي', 'Completed yesterday from Daily account'],
  ['متزامنة', 'Synced'],
  ['العلاقة المالية', 'Financial relationship'],
  ['داخل ميزانية الطعام', 'Within the food budget'],
  ['تعديل الحركة', 'Edit transaction'],
  ['إبلاغ', 'Report'],
  ['تعديل حركة', 'Edit transaction'],
  ['8 أغسطس 2026', '8 August 2026'],
  ['الحذف والرجوع لهما مسار استرداد منفصل', 'Delete and back each have a separate recovery path'],
  ['تعارض في المزامنة', 'Sync conflict'],
  ['اختر النسخة الصحيحة قبل تحديث السجل', 'Choose the correct version before updating the record'],
  ['نسختك', 'Your version'],
  ['مطعم النخيل · 86.50 SAR · مطاعم', 'Al Nakheel Restaurant · 86.50 SAR · Restaurants'],
  ['مطعم النخيل · 96.50 SAR · مطاعم', 'Al Nakheel Restaurant · 96.50 SAR · Restaurants'],
  ['الأثر', 'Impact'],
  ['لن يتم تغيير الرصيد قبل التأكيد', 'Balance will not change before confirmation'],
  ['استخدام نسختي', 'Use my version'],
  ['استخدام الأحدث', 'Use latest'],
  ['تأكيد الحل', 'Confirm resolution'],
  ['سيتم حفظ النسخة المختارة فقط.', 'Only the selected version will be saved.'],
  ['تحويل بين الحسابات', 'Transfer between accounts'],
  ['لا يحتسب كمصروف', 'Not counted as spending'],
  ['من', 'From'],
  ['إلى', 'To'],
  ['حفظ التحويل', 'Save transfer'],
  ['قل الحركة كما حدثت وسنحوّلها لمسودة قابلة للمراجعة', 'Describe the transaction and we will create a reviewable draft'],
  ['جاهز للاستماع', 'Ready to listen'],
  ['الميكروفون لم يبدأ بعد', 'The microphone has not started yet'],
  ['جار التسجيل', 'Recording'],
  ['المدة', 'Duration'],
  ['استمر أو أوقف لتحليل الكلام', 'Continue or stop to analyze your speech'],
  ['صوت', 'Voice'],
  ['لا يتم حفظ التسجيل بعد التحليل', 'The recording is not saved after analysis'],
  ['إيقاف وتحليل', 'Stop and analyze'],
  ['مراجعة النص', 'Review transcript'],
  ['راجع النص قبل إنشاء الحركة', 'Review the transcript before creating the transaction'],
  ['النص المكتشف', 'Detected transcript'],
  ['دفعت 86.50 ريال في مطعم النخيل من الحساب اليومي أمس', 'I paid 86.50 SAR at Al Nakheel Restaurant from my Daily account yesterday'],
  ['تحليل النص', 'Analyze transcript'],
  ['تعديل يدوي', 'Edit manually'],
  ['تحليل الحركة', 'Analyzing transaction'],
  ['86.50 SAR · ثقة عالية', '86.50 SAR · High confidence'],
  ['الحساب اليومي · ثقة متوسطة', 'Daily account · Medium confidence'],
  ['المطاعم · ثقة عالية', 'Restaurants · High confidence'],
  ['جار استخراج المبلغ والحساب والفئة', 'Extracting amount, account, and category'],
  ['اقتراح حركة', 'Transaction suggestion'],
  ['مصروف مقترح', 'Suggested expense'],
  ['تأكيد الحفظ', 'Confirm save'],
  ['تعديل قبل الحفظ', 'Edit before saving'],
  ['مراجعة مقترحات متعددة', 'Review multiple suggestions'],
  ['يوجد حقل غير مؤكد في الاقتراح الثاني', 'The second suggestion has an unconfirmed field'],
  ['قهوة', 'Coffee'],
  ['−18 SAR · الحساب اليومي', '−18 SAR · Daily account'],
  ['وقود', 'Fuel'],
  ['−140 SAR · الحساب غير مؤكد', '−140 SAR · Account unconfirmed'],
  ['300 SAR · تحويل', '300 SAR · Transfer'],
  ['حفظ المختار', 'Save selected'],
  ['تعديل الحقول', 'Edit fields'],
  ['آخر رسالة مالية قبل 12 دقيقة', 'Latest financial message was 12 minutes ago'],
  ['للمراجعة', 'For review'],
  ['تجاهل آمن', 'Safely ignored'],
  ['إذن الرسائل يعمل، لكن البطارية قد توقف التتبع', 'Message permission is active, but battery settings may stop tracking'],
  ['الصحة', 'Health'],
  ['ممتازة', 'Excellent'],
  ['الحماية', 'Protection'],
  ['OTP والإعلانات لا تُضاف', 'OTP messages and ads are not added'],
  ['آخر فحص', 'Last check'],
  ['منذ 12 دقيقة', '12 minutes ago'],
  ['سجل التتبع', 'Tracking history'],
  ['رسالة بنك الراجحي', 'Al Rajhi Bank message'],
  ['أضيفت تلقائيًا · −52 SAR', 'Added automatically · −52 SAR'],
  ['تحتاج مراجعة · −120 SAR', 'Needs review · −120 SAR'],
  ['رمز تحقق', 'Verification code'],
  ['تم تجاهله للحماية', 'Ignored for protection'],
  ['رسالة تسويقية', 'Marketing message'],
  ['تم تجاهلها', 'Ignored'],
  ['أضيف', 'Added'],
  ['مراجعة', 'Review'],
  ['محمي', 'Protected'],
  ['الكلمات المفتاحية', 'Keywords'],
  ['قواعد تساعد التتبع بدون تغيير منطق الحفظ', 'Rules support tracking without changing save logic'],
  ['مدى', 'Mada'],
  ['مصروف · نشطة', 'Expense · Active'],
  ['حوالة واردة', 'Incoming transfer'],
  ['دخل · نشطة', 'Income · Active'],
  ['محمي · لا يضاف', 'Protected · Not added'],
  ['موثوق · 23 حركة', 'Trusted · 23 transactions'],
  ['تحتاج مراجعة أحيانًا', 'Sometimes needs review'],
  ['محظور', 'Blocked'],
  ['إضافة مرسل', 'Add sender'],
  ['مراجعة الحركات المكتشفة', 'Review detected transactions'],
  ['لم يتم تغيير الرصيد لهذه العناصر بعد', 'Balance has not changed for these items yet'],
  ['−120 SAR · الحساب غير مؤكد', '−120 SAR · Account unconfirmed'],
  ['−86.50 SAR · فئة مقترحة', '−86.50 SAR · Suggested category'],
  ['تحويل وارد', 'Incoming transfer'],
  ['+2,000 SAR · يحتاج تأكيد', '+2,000 SAR · Needs confirmation'],
  ['مراجعة رسالة مالية', 'Review financial message'],
  ['STC Pay · اشتراكات', 'STC Pay · Subscriptions'],
  ['سبب المراجعة', 'Review reason'],
  ['الحساب غير مؤكد', 'Account unconfirmed'],
  ['النص المصدر', 'Source text'],
  ['تم إخفاء أجزاء حساسة', 'Sensitive parts are hidden'],
  ['لن يحفظ قبل التأكيد', 'Will not be saved before confirmation'],
  ['المكتشفة', 'Detected'],
  ['مطعم النخيل · −86.50 SAR', 'Al Nakheel Restaurant · −86.50 SAR'],
  ['الموجودة', 'Existing'],
  ['التطابق', 'Match'],
  ['نفس المبلغ والتاريخ', 'Same amount and date'],
  ['دمج', 'Merge'],
  ['حفظ كحركة جديدة', 'Save as new transaction'],
  ['مطابقة التزام', 'Obligation match'],
  ['قسط محتمل', 'Possible installment'],
  ['تمويل السيارة · يستحق اليوم', 'Car financing · Due today'],
  ['الرسالة', 'Message'],
  ['خصم شهري من البنك', 'Monthly bank debit'],
  ['القسط', 'Installment'],
  ['3 من 12', '3 of 12'],
  ['تحديث سجل الالتزام بعد التأكيد', 'Update the obligation record after confirmation'],
  ['مطابقة القسط', 'Match installment'],
  ['ليست لهذا الالتزام', 'Not for this obligation'],
  ['تمت إضافة حركة تلقائيًا', 'Transaction added automatically'],
  ['مصروف جديد', 'New expense'],
  ['مدى · بقالة', 'Mada · Groceries'],
  ['رسالة مالية من مرسل موثوق', 'Financial message from a trusted sender'],
  ['قيد المزامنة', 'Pending sync'],
  ['تراجع خلال 30 ثانية', 'Undo within 30 seconds'],
  ['التتبع يحتاج إذن', 'Tracking needs permission'],
  ['ما سنستخدمه', 'What we use'],
  ['الرسائل المالية فقط', 'Financial messages only'],
  ['ما لن نضيفه', 'What we do not add'],
  ['رموز التحقق والإعلانات', 'Verification codes and ads'],
  ['لو رفضت', 'If you decline'],
  ['استخدم الإدخال اليدوي أو الصوتي', 'Use manual or voice entry'],
  ['فتح إعدادات الإذن', 'Open permission settings'],
  ['لا يمكن قراءة الرسائل المالية بدون إذن Android SMS', 'Financial messages cannot be read without Android SMS permission'],
  ['صباح الخير', 'Good morning'],
  ['صافي الوضع المالي', 'Net financial position'],
  ['أفضل من الشهر الماضي بـ 8%', '8% better than last month'],
  ['أغسطس · كل الحسابات', 'August · All accounts'],
  ['معدل الصرف', 'Spending rate'],
  ['هادئ', 'On track'],
  ['17 حركة تلقائية تحتاج مراجعة', '17 automatic transactions need review'],
  ['قسط السيارة يستحق بعد يومين', 'Car installment is due in two days'],
  ['ميزانية المطاعم وصلت 82%', 'Restaurant budget reached 82%'],
  ['دخل · تلقائي', 'Income · Automatic'],
  ['مطاعم · يدوي', 'Restaurants · Manual'],
  ['ميزانية الطعام', 'Food budget'],
  ['1,246 من 1,500 SAR', '1,246 of 1,500 SAR'],
  ['هدف السفر', 'Travel goal'],
  ['6,900 من 15,000 SAR', '6,900 of 15,000 SAR'],
  ['المتبقي من الراتب', 'Remaining salary'],
  ['18 يومًا حتى الراتب القادم', '18 days until the next salary'],
  ['آخر راتب', 'Latest salary'],
  ['8 أغسطس · +18,000 SAR', '8 August · +18,000 SAR'],
  ['خصومات متوقعة', 'Expected deductions'],
  ['قرض السيارة · اشتراكات', 'Car loan · Subscriptions'],
  ['المصروف حتى الآن', 'Spent so far'],
  ['5,580 من 13,500 SAR', '5,580 of 13,500 SAR'],
  ['الادخار المخطط', 'Planned savings'],
  ['2,000 من 3,000 SAR', '2,000 of 3,000 SAR'],
  ['ملف الراتب', 'Salary profile'],
  ['قيمة الراتب', 'Salary amount'],
  ['يوم الصرف', 'Payday'],
  ['8 من كل شهر', '8th of every month'],
  ['التنبيه', 'Reminder'],
  ['قبل يومين', 'Two days before'],
  ['حفظ الإعدادات', 'Save settings'],
  ['دخل مكتشف', 'Detected income'],
  ['رسالة من البنك · تلقائي', 'Bank message · Automatic'],
  ['مطابقة الملف', 'Profile match'],
  ['قيمة الراتب متطابقة', 'Salary amount matches'],
  ['إضافة دخل بعد التأكيد', 'Add income after confirmation'],
  ['تأكيد الراتب', 'Confirm salary'],
  ['ليس راتبًا', 'Not salary'],
  ['المتبقي هذا الشهر', 'Remaining this month'],
  ['ضمن الخطة', 'On plan'],
  ['ميزانية الاشتراكات قريبة من الحد', 'Subscriptions budget is close to its limit'],
  ['430 من 800 SAR', '430 of 800 SAR'],
  ['480 من 500 SAR', '480 of 500 SAR'],
  ['الحد الشهري', 'Monthly limit'],
  ['أغسطس 2026', 'August 2026'],
  ['عند 80%', 'At 80%'],
  ['حفظ الميزانية', 'Save budget'],
  ['تعديل ميزانية المطاعم', 'Edit restaurant budget'],
  ['المستخدم الآن', 'Used now'],
  ['82% من الحد الحالي', '82% of the current limit'],
  ['توزيع الميزانية', 'Budget allocation'],
  ['احتياجات ثابتة', 'Fixed needs'],
  ['مرونة يومية', 'Daily flexibility'],
  ['تحديث التوزيع', 'Update allocation'],
  ['حركات ميزانية المطاعم', 'Restaurant budget transactions'],
  ['أغسطس · المطاعم', 'August · Restaurants'],
  ['8 أغسطس', '8 August'],
  ['قهوة المساء', 'Evening coffee'],
  ['7 أغسطس', '7 August'],
  ['غداء العمل', 'Work lunch'],
  ['6 أغسطس', '6 August'],
  ['المستحق قريبًا', 'Due soon'],
  ['قسط السيارة · بعد يومين', 'Car installment · In two days'],
  ['تمويل السيارة', 'Car financing'],
  ['3 من 12 قسط', '3 of 12 installments'],
  ['اشتراك الإنترنت', 'Internet subscription'],
  ['مدفوع هذا الشهر', 'Paid this month'],
  ['القسط القادم', 'Next installment'],
  ['10 أغسطس 2026', '10 August 2026'],
  ['التذكير', 'Reminder'],
  ['الجدول', 'Schedule'],
  ['المبلغ المدفوع', 'Amount paid'],
  ['3,600 من 14,400 SAR', '3,600 of 14,400 SAR'],
  ['تاريخ الاستحقاق', 'Due date'],
  ['10 من كل شهر', '10th of every month'],
  ['حفظ الالتزام', 'Save obligation'],
  ['دفعة القسط', 'Installment payment'],
  ['ملاحظة', 'Note'],
  ['خصم بنكي تلقائي', 'Automatic bank debit'],
  ['جدول الأقساط', 'Installment schedule'],
  ['مدفوع · 10 يونيو', 'Paid · 10 June'],
  ['مدفوع · 10 يوليو', 'Paid · 10 July'],
  ['مستحق · 10 أغسطس', 'Due · 10 August'],
  ['قادم · 10 سبتمبر', 'Upcoming · 10 September'],
  ['مراجعة مطابقة قسط', 'Review installment match'],
  ['الحركة المكتشفة', 'Detected transaction'],
  ['−1,200 SAR · البنك', '−1,200 SAR · Bank'],
  ['القسط المتوقع', 'Expected installment'],
  ['1,200 SAR · تمويل السيارة', '1,200 SAR · Car financing'],
  ['تحديث القسط رقم 3', 'Update installment 3'],
  ['مطابقة', 'Match'],
  ['رفض', 'Reject'],
  ['إجمالي الأهداف', 'Total goals'],
  ['3 أهداف نشطة', '3 active goals'],
  ['الطوارئ', 'Emergency'],
  ['14,400 من 20,000 SAR', '14,400 of 20,000 SAR'],
  ['إضافة هدف', 'Add goal'],
  ['المدخر', 'Saved'],
  ['46% من الهدف', '46% of goal'],
  ['موعد الهدف', 'Goal date'],
  ['ديسمبر 2026', 'December 2026'],
  ['باقي 8,100 SAR', '8,100 SAR remaining'],
  ['المساهمة الشهرية', 'Monthly contribution'],
  ['600 SAR مقترحة', '600 SAR suggested'],
  ['إضافة حركة', 'Add transaction'],
  ['تعديل الهدف', 'Edit goal'],
  ['إضافة هدف ادخار', 'Add savings goal'],
  ['رحلة نهاية السنة', 'Year-end trip'],
  ['المبلغ الحالي', 'Current amount'],
  ['تاريخ الهدف', 'Goal date'],
  ['حفظ الهدف', 'Save goal'],
  ['تحويل شهري', 'Monthly transfer'],
  ['حفظ الحركة', 'Save transaction'],
  ['رؤى مالية', 'Financial insights'],
  ['الصرف على المطاعم أعلى من متوسط 3 أشهر', 'Restaurant spending is above the 3-month average'],
  ['اشتراك متكرر جديد ظهر هذا الشهر', 'A new recurring subscription appeared this month'],
  ['راجع ميزانية المطاعم قبل نهاية الشهر', 'Review the restaurant budget before month-end'],
  ['سياق', 'Context'],
  ['مصروفات نهاية الأسبوع زادت 18%', 'Weekend spending increased by 18%'],
  ['اسأل المساعد عن السبب', 'Ask the assistant why'],
  ['تفصيل المصروف', 'Spending breakdown'],
  ['مطاعم', 'Restaurants'],
  ['42 حركة · 1,246.75 SAR', '42 transactions · 1,246.75 SAR'],
  ['بقالة', 'Groceries'],
  ['18 حركة · 980 SAR', '18 transactions · 980 SAR'],
  ['6 حركات · 430 SAR', '6 transactions · 430 SAR'],
  ['مقارنة الاتجاه', 'Trend comparison'],
  ['مقارنة بالشهر الماضي', 'Compared with last month'],
  ['الصرف أقل من يوليو', 'Spending is lower than July'],
  ['الفرق', 'Difference'],
  ['حركات المطاعم', 'Restaurant transactions'],
  ['النطاق', 'Scope'],
  ['الأقسام', 'Sections'],
  ['ملخص · فئات · اتجاهات', 'Summary · Categories · Trends'],
  ['تصدير PDF', 'Export PDF'],
  ['مشاركة', 'Share'],
  ['جدولة تقرير', 'Schedule report'],
  ['آخر يوم في الشهر', 'Last day of the month'],
  ['القناة', 'Channel'],
  ['إشعار داخل التطبيق', 'In-app notification'],
  ['اسأل عن أموالك مع سياق واضح وقابل للتتبع', 'Ask about your money with clear, traceable context'],
  ['لماذا زاد صرف المطاعم؟', 'Why did restaurant spending increase?'],
  ['يربط التقارير بالحركات', 'Connects reports to transactions'],
  ['راجع الحركات التلقائية', 'Review automatic transactions'],
  ['يفتح قائمة المراجعة', 'Opens the review queue'],
  ['اقترح خطة ادخار', 'Suggest a savings plan'],
  ['بدون تغيير قبل موافقتك', 'No changes before your approval'],
  ['محادثة مالية', 'Financial conversation'],
  ['فتح التفصيل', 'Open breakdown'],
  ['ليش صرف المطاعم عالي؟', 'Why is restaurant spending high?'],
  ['أعلى 3 حركات كانت في نهاية الأسبوع، والإجمالي 1,246.75 SAR.', 'The 3 largest transactions were on the weekend, totaling 1,246.75 SAR.'],
  ['هل تريد فتح تفصيل المطاعم؟', 'Would you like to open the restaurant breakdown?'],
  ['الأدلة المستخدمة', 'Evidence used'],
  ['تقرير المطاعم', 'Restaurant report'],
  ['أغسطس · 1,246.75 SAR', 'August · 1,246.75 SAR'],
  ['3 حركات كبيرة', '3 large transactions'],
  ['مطعم النخيل، غداء العمل، قهوة', 'Al Nakheel Restaurant, work lunch, coffee'],
  ['حد الميزانية', 'Budget limit'],
  ['معاينة إجراء', 'Action preview'],
  ['اقتراح تعديل ميزانية', 'Suggested budget update'],
  ['لن يتم الحفظ قبل التأكيد', 'Will not be saved before confirmation'],
  ['المقترح', 'Suggestion'],
  ['السبب', 'Reason'],
  ['متوسط 3 أشهر أعلى من الحد', 'The 3-month average is above the limit'],
  ['تطبيق التعديل', 'Apply update'],
  ['المساعد غير متاح مؤقتًا', 'Assistant is temporarily unavailable'],
  ['فتح التقارير', 'Open reports'],
  ['لا يمكن تحميل المحادثة الآن. بياناتك المالية لم تتغير.', 'The conversation cannot be loaded now. Your financial data has not changed.'],
  ['حركة تحتاج مراجعة', 'Transaction needs review'],
  ['قسط قريب', 'Upcoming installment'],
  ['تمويل السيارة بعد يومين', 'Car financing in two days'],
  ['تم تسجيل دخول من Pixel 8', 'Signed in from Pixel 8'],
  ['مالية', 'Financial'],
  ['أمان', 'Security'],
  ['تصفية الإشعارات', 'Filter notifications'],
  ['مالية · أمان · دعم', 'Financial · Security · Support'],
  ['غير مقروءة', 'Unread'],
  ['آخر 30 يوم', 'Last 30 days'],
  ['تطبيق', 'Apply'],
  ['مراجعة الحركات', 'Transaction reviews'],
  ['الأقساط القريبة', 'Upcoming installments'],
  ['تقارير شهرية', 'Monthly reports'],
  ['أمان الحساب', 'Account security'],
  ['دائمًا مفعل', 'Always enabled'],
  ['حساب مصاريفي', 'Masarifi account'],
  ['العملة الأساسية', 'Base currency'],
  ['اكتمال الملف', 'Profile completion'],
  ['تعديل الملف', 'Edit profile'],
  ['إعدادات التطبيق', 'App settings'],
  ['حسب النظام', 'System default'],
  ['إخفاء القيم', 'Hide values'],
  ['بداية الشهر', 'Start of month'],
  ['اللغة والتنبيهات', 'Language and alerts'],
  ['قفل التطبيق', 'App lock'],
  ['PIN مفعل', 'PIN enabled'],
  ['2 جهاز', '2 devices'],
  ['آخر حدث اليوم', 'Latest event today'],
  ['أدخل PIN لعرض القيم المالية', 'Enter your PIN to view financial values'],
  ['إنشاء PIN', 'Create PIN'],
  ['PIN جديد', 'New PIN'],
  ['تأكيد لاحق', 'Confirm later'],
  ['في الشاشة التالية', 'On the next screen'],
  ['PIN الحالي', 'Current PIN'],
  ['الجهاز الحالي · Android', 'Current device · Android'],
  ['آخر نشاط قبل يومين', 'Last active two days ago'],
  ['تسجيل خروج الأجهزة الأخرى', 'Sign out other devices'],
  ['تسجيل دخول جديد', 'New sign-in'],
  ['Pixel 8 · اليوم', 'Pixel 8 · Today'],
  ['أمس', 'Yesterday'],
  ['تصدير تقرير', 'Report export'],
  ['قبل 3 أيام', '3 days ago'],
  ['إخفاء في مبدل التطبيقات', 'Hide in app switcher'],
  ['دائمًا', 'Always'],
  ['الإشعارات المالية', 'Financial notifications'],
  ['بدون مبالغ حساسة', 'Without sensitive amounts'],
  ['الأدلة للمساعد', 'Assistant evidence'],
  ['حسب السياق', 'Based on context'],
  ['الاشتراك', 'Subscription'],
  ['الخطة الحالية', 'Current plan'],
  ['ميزات أساسية نشطة', 'Core features active'],
  ['التقارير المتقدمة', 'Advanced reports'],
  ['ضمن Pro', 'Included with Pro'],
  ['المساعد المالي', 'Financial assistant'],
  ['حد شهري', 'Monthly limit'],
  ['عادي', 'Standard'],
  ['ترقية الخطة', 'Upgrade plan'],
  ['تأكيد الاشتراك', 'Confirm subscription'],
  ['الخطة', 'Plan'],
  ['Pro شهري', 'Pro monthly'],
  ['السعر', 'Price'],
  ['29 SAR / شهر', '29 SAR / month'],
  ['التجديد', 'Renewal'],
  ['يمكن الإلغاء من الإدارة', 'Can be cancelled from plan management'],
  ['متابعة الدفع', 'Continue to payment'],
  ['التجديد القادم', 'Next renewal'],
  ['15 سبتمبر 2026', '15 September 2026'],
  ['بطاقة منتهية 2048', 'Expired card 2048'],
  ['تغيير الخطة', 'Change plan'],
  ['إلغاء التجديد', 'Cancel renewal'],
  ['تذكرة جديدة', 'New ticket'],
  ['مشكلة في حركة أو اشتراك', 'Problem with a transaction or subscription'],
  ['تذاكري', 'My tickets'],
  ['2 مفتوحة', '2 open'],
  ['الأسئلة الشائعة', 'Frequently asked questions'],
  ['الأمان، التتبع، الفواتير', 'Security, tracking, billing'],
  ['تذكرة دعم جديدة', 'New support ticket'],
  ['مشكلة في حركة تلقائية', 'Problem with an automatic transaction'],
  ['السياق', 'Context'],
  ['أريد تعديل الفئة', 'I want to change the category'],
  ['إرسال التذكرة', 'Submit ticket'],
  ['تذاكر الدعم', 'Support tickets'],
  ['مفتوحة · حركة تلقائية', 'Open · Automatic transaction'],
  ['تم الرد · اشتراك', 'Replied · Subscription'],
  ['مغلقة · تقرير', 'Closed · Report'],
  ['تذكرة #1042', 'Ticket #1042'],
  ['إضافة رد', 'Add reply'],
  ['إغلاق التذكرة', 'Close ticket'],
  ['الحركة ظهرت بفئة غير صحيحة.', 'The transaction appeared in the wrong category.'],
  ['تم استلام التذكرة. سنراجع المصدر والسجل.', 'Your ticket was received. We will review the source and history.'],
  ['واجهة RTL وأرقام إنجليزية', 'RTL interface with Latin numerals'],
  ['افهم مصروفك بهدوء وراجع التلقائي قبل أن يؤثر على سجلك', 'Understand your spending and review automatic entries before they affect your records'],
  ['رقم الجوال', 'Mobile number'],
  ['البيانات المالية', 'Financial data'],
  ['تبقى محمية ومخفية افتراضيًا', 'Protected and hidden by default'],
  ['رمز التحقق', 'Verification code'],
  ['إعادة الإرسال', 'Resend'],
  ['متاح بعد 42 ثانية', 'Available in 42 seconds'],
  ['الرمز', 'Code'],
  ['اختيار حساب Google', 'Choose Google account'],
  ['يستخدم mock provider في التطبيق الحالي', 'Uses the current app mock provider'],
  ['التعارض', 'Conflict'],
  ['إعادة تحقق عند الحاجة', 'Reverify when needed'],
  ['كيف نحمي البيانات المالية', 'How we protect financial data'],
  ['الشروط', 'Terms'],
  ['استخدام التطبيق وحدود المسؤولية', 'App usage and responsibility limits'],
  ['الأذونات', 'Permissions'],
  ['متى نطلب إذن الرسائل', 'When we request message permission'],
  ['يقرأ الرسائل المالية المؤهلة ويعرض عليك ما يحتاج مراجعة', 'Reads eligible financial messages and shows what needs review'],
  ['تلقائي لكن قابل للتصحيح', 'Automatic, but always correctable'],
  ['لن نخفي عدم اليقين', 'We never hide uncertainty'],
  ['OTP والإعلانات لا تدخل سجلك', 'OTP messages and ads never enter your records'],
  ['التخطي الآن', 'Skip for now'],
  ['تفضيلات التتبع', 'Tracking preferences'],
  ['إضافة تلقائية عند الثقة العالية', 'Add automatically when confidence is high'],
  ['مراجعة عند عدم اليقين', 'Review when uncertain'],
  ['إشعار بعد الإضافة', 'Notify after adding'],
  ['حفظ التفضيلات', 'Save preferences'],
  ['إذن رسائل Android', 'Android SMS permission'],
  ['ما نقرأه', 'What we read'],
  ['رسائل مالية من مرسلين معروفين', 'Financial messages from known senders'],
  ['ما نستبعده', 'What we exclude'],
  ['OTP والإعلانات والمحادثات', 'OTP messages, ads, and conversations'],
  ['يبقى الإدخال اليدوي والصوتي متاحين', 'Manual and voice entry remain available'],
  ['خيارات iOS', 'iOS options'],
  ['iOS لا يسمح بنفس قراءة رسائل Android', 'iOS does not allow the same Android message access'],
  ['سريعة ومحمية', 'Fast and protected'],
  ['تحويل كلامك لمسودة', 'Turn your speech into a draft'],
  ['اختصارات مدعومة', 'Supported shortcuts'],
  ['حسب إمكانيات النظام', 'Based on system capabilities'],
  ['اختيار الطريقة', 'Choose a method'],
  ['إعداد بديل iOS', 'Set up iOS alternative'],
  ['الخطوة 1', 'Step 1'],
  ['استخدم الاختصار المدعوم', 'Use the supported shortcut'],
  ['الخطوة 2', 'Step 2'],
  ['راجع المقترح قبل الحفظ', 'Review the suggestion before saving'],
  ['الخطوة 3', 'Step 3'],
  ['صحح الحساب أو الفئة', 'Correct the account or category'],
  ['فتح التعليمات', 'Open instructions'],
  ['تجربة التتبع', 'Tracking demo'],
  ['رسالة مالية تجريبية', 'Sample financial message'],
  ['تظهر كمقترح قابل للمراجعة', 'Appears as a reviewable suggestion'],
  ['تأكيد المثال', 'Confirm example'],
  ['تعديل المثال', 'Edit example'],
  ['الكلمات المبدئية', 'Starter keywords'],
  ['اعتماد الكلمات', 'Confirm keywords'],
  ['تم إعداد مصاريفي', 'Masarifi is ready'],
  ['جاهز للاستخدام', 'Ready to use'],
  ['5 وجهات أساسية', '5 primary destinations'],
  ['الرئيسية، الحركات، إضافة، التقارير، المزيد', 'Home, Transactions, Add, Reports, More'],
  ['فتح الرئيسية', 'Open Home']
]);
const catalogEnglish = new Map(
  Object.keys(arMessages).map((key) => [arMessages[key], enMessages[key]])
);
function translateMockupText(value) {
  if (typeof value !== 'string' || !/[\u0600-\u06ff]/u.test(value)) return value;
  if (mockupEnglish.has(value)) return mockupEnglish.get(value);
  if (catalogEnglish.has(value)) return catalogEnglish.get(value);
  return value;
}

function translateMockupValue(value) {
  if (Array.isArray(value)) return value.map(translateMockupValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, translateMockupValue(item)])
    );
  }
  return translateMockupText(value);
}

const existingIds = new Set(screens.map(({ id }) => id));
const englishScreens = screens
  .filter(({ lang }) => lang === 'ar')
  .map((screen) => translateMockupValue({
    ...screen,
    id: screen.id.replace(/-ar$/, '-en'),
    file: screen.file.replace(/-ar\.png$/, '-en.png'),
    lang: 'en'
  }))
  .filter(({ id }) => !existingIds.has(id));
screens.push(...englishScreens);

const untranslatedEnglish = [...new Set(
  englishScreens
    .flatMap((screen) => JSON.stringify(screen).match(/[^"\\]*[\u0600-\u06ff][^"\\]*/gu) ?? [])
)];
if (untranslatedEnglish.length) {
  throw new Error(`Missing English mockup translations:\n${untranslatedEnglish.join('\n')}`);
}

const excludedRoutes = [
  'All _layout.tsx files: technical navigation containers, represented by their visible child screens or shell board.',
  'app/foundation/*: diagnostic validation scenarios, represented by shared state/foundation boards rather than production redesign screens.',
  'app/index.tsx: startup/router entry, represented by Auth/Onboarding/Home destination mockups.',
  'app/modal/planning-conflict.tsx: shared confirmation pattern represented by the Foundation state board.',
  'app/modals/auth-required.tsx and app/modals/sync-conflict.tsx: represented by shared modal/transaction conflict mockups.'
];

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function amount(value) {
  return `<span class="amount" dir="ltr">${esc(value)}</span>`;
}

function icon(name, size = 20) {
  const paths = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    home: '<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    edit: '<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    mic: '<rect x="8" y="3" width="8" height="13" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/><path d="M16 10h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>',
    tag: '<path d="M4 4h6l10 10-6 6L4 10V4Z"/><circle cx="8" cy="8" r="1"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"/><path d="M10 20h4"/>',
    spark: '<path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    down: '<path d="m7 9 5 5 5-5"/>',
    income: '<path d="M12 19V5M7 10l5-5 5 5"/>',
    expense: '<path d="M12 5v14M7 14l5 5 5-5"/>',
    transactions: '<path d="M7 7h12l-3-3M17 17H5l3 3"/><path d="m19 7-3 3M5 17l3-3"/>'
  };
  return `<svg class="svgicon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.chevron}</svg>`;
}

function openMoji(categoryId, label) {
  if (!seededCategories.has(categoryId)) throw new Error(`Unknown seeded category: ${categoryId}`);
  if (!openMojiCache.has(categoryId)) {
    const assetPath = path.join(openMojiRoot, `${categoryId}.png`);
    if (!fs.existsSync(assetPath)) throw new Error(`Missing OpenMoji category asset: ${assetPath}`);
    openMojiCache.set(categoryId, fs.readFileSync(assetPath).toString('base64'));
  }
  return `<img class="tx-category-image" src="data:image/png;base64,${openMojiCache.get(categoryId)}" alt="${esc(label)}"/>`;
}

function renderTransactionsScreen(screen) {
  const rtl = screen.lang !== 'en';
  const messages = rtl ? arMessages : enMessages;
  const translate = (key) => messages[key] ?? key;
  const categoryLabel = (id) => seededCategories.get(id)?.[rtl ? 'labelAr' : 'labelEn'] ?? id;
  const relativeKeys = ['today', 'yesterday', 'lastWeek', 'earlier'];
  const shortcuts = [
    { id: 'all', label: translate('coreFinance.ledger.quick.all') },
    { id: 'food', label: categoryLabel('food') },
    { id: 'transfers', label: translate('coreFinance.ledger.quick.transfer') },
    { id: 'transportation', label: categoryLabel('transportation') },
    { id: 'shopping', label: categoryLabel('shopping') },
    { id: 'health', label: categoryLabel('health') }
  ].filter(({ id }) => id === 'all' || seededCategories.has(id));
  const reports = translate('appShell.navigation.reports');
  const search = translate('coreFinance.ledger.search');
  const quickFilters = translate('coreFinance.filters.quick');
  const home = translate('appShell.tabs.home');
  const add = translate('appShell.tabs.add');
  const transactions = translate('appShell.tabs.transactions');
  const profile = translate('appShell.shell.profile');
  const income = screen.metrics[0];
  const expense = screen.metrics[1];
  const reportsAction = `<div class="tx-header-action tx-reports">${icon('chart', 19)}<span>${esc(reports)}</span></div>`;
  const avatarAction = `<div class="tx-header-action tx-avatar" aria-label="${esc(profile)}">M</div>`;
  const center = `<div class="tx-header-center"><div class="tx-title">${esc(screen.title)}</div><div class="tx-period">${icon('down', 14)}<span>${esc(screen.scope)}</span></div></div>`;
  const header = `${reportsAction}${center}${avatarAction}`;
  const groups = screen.rows.map(([title, meta, value, account], index) => {
    const categoryId = screen.rowCategories[index];
    const heading = translate(`coreFinance.ledger.period.${relativeKeys[index]}`);
    const source = meta.split(' · ')[1] ?? '';
    const meaning = value.startsWith('+') ? 'income' : categoryId === 'transfers' ? 'transfer' : 'expense';
    return `<section class="tx-group"><h2>${esc(heading)}</h2><div class="tx-card"><div class="tx-info"><div class="tx-category">${openMoji(categoryId, categoryLabel(categoryId))}</div><div class="tx-copy"><div class="tx-row-title">${esc(title)}</div><div class="tx-meta">${esc(categoryLabel(categoryId))}${source ? ` · ${esc(source)}` : ''}</div><div class="tx-account">${esc(account)}</div></div></div><div class="tx-money ${meaning}"><div class="tx-amount" dir="ltr">${esc(value)}</div><div class="tx-date">${esc(heading)}</div></div></div></section>`;
  }).join('');
  const navItems = [
    { icon: icon('home', 20), label: home, active: false },
    { icon: icon('plus', 22), label: add, active: false, add: true },
    { icon: icon('transactions', 21), label: transactions, active: true }
  ];
  return `<!doctype html><html lang="${screen.lang === 'en' ? 'en' : 'ar'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>
@font-face{font-family:PlexArabic;src:url(data:font/ttf;base64,${arabicRegular}) format('truetype');font-weight:400}@font-face{font-family:PlexArabic;src:url(data:font/ttf;base64,${arabicBold}) format('truetype');font-weight:700 900}@font-face{font-family:PlexLatin;src:url(data:font/ttf;base64,${latinRegular}) format('truetype');font-weight:400}@font-face{font-family:PlexLatin;src:url(data:font/ttf;base64,${latinBold}) format('truetype');font-weight:700 900}
*{box-sizing:border-box}html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#f8faf9;color:#10231f;font-family:${rtl ? 'PlexArabic' : 'PlexLatin'},sans-serif;-webkit-font-smoothing:antialiased}.tx-screen{position:relative;width:390px;height:844px;overflow:hidden;background:#f8faf9}.tx-horizon{height:340px;padding:0 18px;color:#fff;background:#103f37;background-image:radial-gradient(circle at 78% 8%,rgba(49,179,151,.34),rgba(16,63,55,0) 58%),linear-gradient(135deg,#103f37 0%,#1d7464 100%)}.tx-status{height:34px;padding-top:12px;display:flex;align-items:center;justify-content:space-between;font-family:PlexLatin,sans-serif;font-size:11px;font-weight:700;direction:ltr}.tx-primary-header{position:relative;height:70px}.tx-header-action{position:absolute;top:11px;min-width:48px;min-height:48px;display:flex;align-items:center;justify-content:center;color:#fff}.tx-reports{left:0;flex-direction:column;gap:2px;font-size:11px;font-weight:700}.tx-avatar{right:0;width:48px;height:48px;min-width:48px;min-height:48px;top:11px;border:1px solid rgba(255,255,255,.3);border-radius:50%;background:rgba(255,255,255,.12);font-family:PlexLatin,sans-serif;font-size:14px;font-weight:800}.tx-header-center{position:absolute;right:58px;left:58px;top:7px;min-width:0;display:grid;justify-items:center;gap:5px}.tx-title{font-size:22px;line-height:27px;font-weight:900;letter-spacing:-.02em}.tx-period{max-width:100%;height:29px;padding:0 10px;display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:700;white-space:nowrap}.tx-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px}.tx-stat{height:78px;padding:11px 12px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:rgba(255,255,255,.09)}.tx-stat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:rgba(255,255,255,.78)}.tx-stat-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.12)}.tx-stat-value{font-family:PlexLatin,PlexArabic,sans-serif;font-size:17px;line-height:22px;font-weight:900;white-space:nowrap;direction:ltr;unicode-bidi:isolate}.tx-stat.income .tx-stat-value{color:#bff3dc}.tx-stat.expense .tx-stat-value{color:#ffd3cf}.tx-controls{height:44px;margin-top:8px;display:flex;gap:8px;direction:ltr}.tx-search,.tx-filter{height:44px;display:flex;align-items:center;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.11);color:#fff}.tx-search{flex:1;gap:8px;padding:0 13px;border-radius:14px;font-size:11px;direction:${rtl ? 'rtl' : 'ltr'}}.tx-filter{width:44px;justify-content:center;border-radius:14px}.tx-shortcuts{height:44px;margin-top:8px;display:flex;align-items:center;gap:8px;overflow-x:auto;overflow-y:hidden;direction:${rtl ? 'rtl' : 'ltr'};scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}.tx-shortcuts::-webkit-scrollbar{display:none}.tx-chip{height:38px;min-width:30px;flex:0 0 auto;padding:0 14px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:10.5px;font-weight:700;white-space:nowrap}.tx-chip.active{color:#103f37;background:#fff;border-color:#fff}.tx-sheet{position:absolute;z-index:2;top:314px;right:0;bottom:76px;left:0;padding:14px 18px 10px;border-radius:28px 28px 0 0;background:#f8faf9;box-shadow:0 -12px 30px rgba(6,29,25,.12)}.tx-groups{display:grid;gap:5px}.tx-group h2{height:17px;margin:0 3px 4px;font-size:12px;line-height:17px;font-weight:900;text-align:${rtl ? 'right' : 'left'}}.tx-card{min-height:61px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:9px;border:1px solid #e3e9e7;border-radius:14px;background:#fff;box-shadow:0 5px 14px rgba(16,63,55,.055);direction:ltr;flex-direction:${rtl ? 'row-reverse' : 'row'}}.tx-info{min-width:0;flex:1;display:flex;align-items:center;gap:9px;flex-direction:${rtl ? 'row-reverse' : 'row'}}.tx-category{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:12px;background:#dbece7}.tx-category-image{width:32px;height:32px;display:block;object-fit:contain}.tx-copy{min-width:0;flex:1;text-align:${rtl ? 'right' : 'left'}}.tx-row-title{overflow:hidden;font-size:13px;line-height:17px;font-weight:900;text-overflow:ellipsis;white-space:nowrap}.tx-meta,.tx-account{overflow:hidden;font-size:11px;line-height:15px;color:#5f6d68;text-overflow:ellipsis;white-space:nowrap}.tx-account{color:#7b8782}.tx-money{flex:0 0 auto;text-align:${rtl ? 'left' : 'right'}}.tx-amount{font-family:PlexLatin,PlexArabic,sans-serif;font-size:12.5px;line-height:17px;font-weight:900;white-space:nowrap;unicode-bidi:isolate}.tx-money.income .tx-amount{color:#1f7a5a}.tx-money.expense .tx-amount{color:#b4473f}.tx-money.transfer .tx-amount{color:#376e86}.tx-date{margin-top:3px;font-size:11px;line-height:15px;color:#78847f;white-space:nowrap}.tx-nav{position:absolute;z-index:4;right:0;bottom:0;left:0;height:76px;display:grid;grid-template-columns:repeat(3,1fr);direction:ltr;border-top:1px solid #e3e9e7;background:rgba(255,255,255,.98)}.tx-nav-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#64716c;font-size:11px;font-weight:700}.tx-nav-icon{width:34px;height:31px;display:grid;place-items:center;border-radius:10px}.tx-nav-item.active{color:#103f37;font-weight:900}.tx-nav-item.active .tx-nav-icon{background:#dbece7}.tx-nav-item.add .tx-nav-icon{width:48px;height:48px;margin-top:-18px;border-radius:15px;color:#fff;background:#103f37;box-shadow:0 8px 18px rgba(16,63,55,.24)}.amount{font-family:PlexLatin,PlexArabic,sans-serif;font-variant-numeric:tabular-nums}.svgicon{display:block}
</style></head><body><main class="tx-screen"><section class="tx-horizon"><div class="tx-status"><span>09:41</span><span>5G&nbsp;&nbsp;82%</span></div><div class="tx-primary-header">${header}</div><div class="tx-summary"><div class="tx-stat income"><div class="tx-stat-head"><span>${esc(income[0])}</span><span class="tx-stat-icon">${icon('income', 16)}</span></div><div class="tx-stat-value">+${esc(income[1])}</div></div><div class="tx-stat expense"><div class="tx-stat-head"><span>${esc(expense[0])}</span><span class="tx-stat-icon">${icon('expense', 16)}</span></div><div class="tx-stat-value">−${esc(expense[1])}</div></div></div><div class="tx-controls"><div class="tx-search">${icon('search', 17)}<span>${esc(search)}</span></div><div class="tx-filter" aria-label="${esc(quickFilters)}">${icon('filter', 18)}</div></div><div class="tx-shortcuts">${shortcuts.map(({ id, label }) => `<div class="tx-chip ${id === 'all' ? 'active' : ''}">${esc(label)}</div>`).join('')}</div></section><section class="tx-sheet"><div class="tx-groups">${groups}</div></section><nav class="tx-nav">${navItems.map((item) => `<div class="tx-nav-item ${item.active ? 'active' : ''} ${item.add ? 'add' : ''}"><span class="tx-nav-icon">${item.icon}</span><span>${esc(item.label)}</span></div>`).join('')}</nav></main></body></html>`;
}

function renderScreen(screen) {
  if (screen.id === 'transactions-list-ar' || screen.id === 'transactions-list-en') {
    return renderTransactionsScreen(screen);
  }
  const rtl = screen.lang !== 'en';
  const nav = screen.lang === 'en' ? enNav : arNav;
  const tabIndex = { home: 0, transactions: 1, add: 2, reports: 3, more: 4 }[screen.tab];
  const hasTab = Number.isInteger(tabIndex);
  const isBoard = screen.board;
  const brandMoment = screen.area === '18-auth' || screen.area === '19-onboarding';
  const screenType = brandMoment ? 'brand' : screen.fields.length ? 'form' : screen.chart || screen.progress.length ? 'insight' : screen.hero ? 'detail' : 'list';
  const mainContent = `${brandMoment && !screen.hero ? renderBrandHighlights(screen.lang) : ''}${renderHero(screen.hero, screen.metrics)}${renderChips(screen.chips)}${screen.hero ? '' : renderMetrics(screen.metrics)}${renderState(screen.state)}${renderAttention(screen.attention, screen.lang)}${renderChart(screen.chart, screen.lang)}${renderBoard(screen)}${renderRows(screen.rows, screen.area, screen.lang)}${renderProgress(screen.progress, screen.lang)}${renderFields(screen.fields, screen.lang)}${renderConversation(screen.conversation)}${screen.id.startsWith('assistant-home-') ? renderAssistantComposer(screen.lang) : ''}${screen.id.startsWith('more-hub-') ? renderMoreFooter(screen.lang) : ''}${renderActions(screen.actions)}`;
  return `<!doctype html><html lang="${screen.lang === 'en' ? 'en' : 'ar'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><style>
@font-face{font-family:PlexArabic;src:url(data:font/ttf;base64,${arabicRegular}) format('truetype');font-weight:400}@font-face{font-family:PlexArabic;src:url(data:font/ttf;base64,${arabicBold}) format('truetype');font-weight:700 900}@font-face{font-family:PlexLatin;src:url(data:font/ttf;base64,${latinRegular}) format('truetype');font-weight:400}@font-face{font-family:PlexLatin;src:url(data:font/ttf;base64,${latinBold}) format('truetype');font-weight:700 900}
:root{--teal-950:#102723;--teal-900:#16332f;--teal-800:#1c3934;--teal-700:#244541;--teal-600:#315c55;--teal-500:#46756c;--teal-100:#e3ece9;--bronze:#a87446;--bg:#f3f5f3;--surface:#fff;--surface-soft:#f8faf8;--ink:#17211d;--muted:#68716c;--line:#e2e7e3;--danger:#b4473f;--positive:#167052;--shadow:0 10px 28px rgba(16,39,35,.10)}
*{box-sizing:border-box}html,body{margin:0;width:${isBoard ? 1080 : 390}px;min-height:${isBoard ? 1428 : 844}px;background:var(--bg);color:var(--ink);font-family:${screen.lang === 'en' ? 'PlexLatin' : 'PlexArabic'},sans-serif;-webkit-font-smoothing:antialiased}body{overflow-x:hidden}.screen{position:relative;min-height:${isBoard ? 1428 : 844}px;background:var(--bg);overflow:hidden}.status{height:38px;padding:13px 20px 0;display:flex;justify-content:space-between;align-items:center;font-family:PlexLatin,sans-serif;font-size:11px;font-weight:700;color:var(--teal-950)}.masthead{position:relative;padding:10px 20px 24px;background:var(--surface);border-bottom:1px solid var(--line)}.masthead.tabbed{padding-bottom:20px}.masthead.brand{min-height:236px;padding-top:22px;color:#fff;background:var(--teal-900);border:0;border-radius:0 0 32px 32px;overflow:hidden}.masthead.brand:after,.hero:after{content:"";position:absolute;width:160px;height:160px;border:1px solid rgba(226,206,183,.3);border-radius:50%;inset:auto -56px -82px auto}.topline{display:flex;align-items:center;justify-content:space-between;gap:12px}.brandlock{display:flex;align-items:center;gap:10px;min-width:0}.logo{width:40px;height:40px;border-radius:12px;box-shadow:0 5px 14px rgba(16,39,35,.18)}.brand .logo{width:68px;height:68px;border-radius:20px;border:1px solid rgba(255,255,255,.18)}.brandname{font-size:16px;font-weight:800;color:var(--teal-900)}.brand .brandname{color:#fff;font-size:20px}.header-actions{display:flex;align-items:center;gap:8px}.iconbtn{width:40px;height:40px;border-radius:13px;border:1px solid var(--line);display:grid;place-items:center;color:var(--teal-800);background:#fff}.brand .iconbtn{color:#fff;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22)}.heading{margin-top:18px}.tabbed .heading{margin-top:14px}.brand .heading{margin-top:30px}.title{font-size:27px;line-height:1.2;font-weight:800;letter-spacing:-.025em}.brand .title{font-size:31px;max-width:300px}.subtitle{font-size:13px;line-height:1.55;color:var(--muted);margin-top:6px;max-width:340px}.brand .subtitle{color:#dce8e4;max-width:310px}.scope{display:inline-flex;align-items:center;gap:7px;margin-top:13px;border:1px solid var(--line);border-radius:999px;padding:7px 11px;background:var(--surface-soft);font-size:11px;color:var(--teal-700);font-weight:700}.content{padding:16px 18px ${hasTab ? 104 : 34}px}.brand+.content{padding-top:20px}.hero{position:relative;overflow:hidden;background:var(--teal-800);color:#fff;border-radius:16px;padding:20px;margin-bottom:14px;box-shadow:var(--shadow)}.hero .label{font-size:12px;color:#cfe0da}.hero .value{font-size:31px;line-height:1.1;font-weight:900;margin-top:6px;letter-spacing:-.025em}.hero .note{font-size:12px;color:#e1ece8;margin-top:8px;line-height:1.45}.hero-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:17px;padding-top:14px;border-top:1px solid rgba(255,255,255,.16)}.hero-metric{padding-inline:9px;border-inline-start:1px solid rgba(255,255,255,.14)}.hero-metric:first-child{border-inline-start:0;padding-inline-start:0}.hero-metric .k{font-size:10px;color:#cfe0da}.hero-metric .v{font-size:13px;font-weight:800;margin-top:4px}.metricgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px}.metric{background:var(--surface);border-radius:14px;padding:12px;border:1px solid var(--line)}.metric .k{font-size:10px;color:var(--muted)}.metric .v{font-size:13px;font-weight:800;margin-top:5px}.section-title{display:flex;justify-content:space-between;align-items:center;margin:20px 2px 9px;font-size:14px;font-weight:800}.section-title .link{font-size:11px;color:var(--teal-600);font-weight:700}.attention{background:#fffaf2;border:1px solid #ead5b7;border-radius:16px;padding:14px;margin:0 0 14px}.attention-head{display:flex;align-items:center;gap:9px;color:#79532f;font-size:14px;font-weight:800;margin-bottom:5px}.attitem{display:flex;align-items:flex-start;gap:9px;padding:9px 0;border-top:1px solid #efe2cf;font-size:12px;line-height:1.42}.attitem:first-of-type{border-top:0}.attdot{width:6px;height:6px;border-radius:50%;background:var(--bronze);margin-top:6px;flex:0 0 auto}.section{background:var(--surface);border:1px solid var(--line);border-radius:16px;margin:0 0 14px;overflow:hidden}.section.padded{padding:15px}.row{display:flex;align-items:center;justify-content:space-between;gap:11px;padding:13px 14px;border-top:1px solid #edf0ed;min-height:66px}.row:first-child{border-top:0}.rowlead{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:grid;place-items:center;color:var(--teal-700);background:var(--teal-100)}.rowmain{min-width:0;flex:1}.rowtitle{font-size:14px;font-weight:800;line-height:1.25}.rowmeta{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4}.rowtail{display:flex;align-items:center;gap:7px}.rowamount{font-family:PlexLatin,PlexArabic,sans-serif;font-size:13px;font-weight:900;color:var(--teal-800);white-space:nowrap}.chipbar{display:flex;gap:7px;overflow:hidden;margin:0 0 14px}.chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 12px;color:var(--teal-700);font-size:11px;white-space:nowrap;font-weight:700}.chip:first-child{background:var(--teal-800);color:#fff;border-color:var(--teal-800)}.fields{background:var(--surface);border:1px solid var(--line);border-radius:16px;margin:0 0 14px;overflow:hidden}.field{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border-top:1px solid #edf0ed;min-height:68px}.field:first-child{border-top:0}.fieldcopy{min-width:0}.fieldlabel{font-size:11px;color:var(--muted);margin-bottom:4px}.fieldvalue{font-size:15px;font-weight:800}.fieldicon{color:var(--teal-600)}.actions{display:grid;gap:8px;margin-top:15px}.btn{min-height:50px;border-radius:14px;display:flex;gap:9px;align-items:center;justify-content:center;font-size:14px;font-weight:800;background:var(--teal-800);color:#fff;box-shadow:0 8px 18px rgba(28,57,52,.14)}.btn.secondary{background:var(--surface);color:var(--teal-800);border:1px solid var(--line);box-shadow:none}.btn.tertiary{background:transparent;color:var(--danger);box-shadow:none}.progress{padding:14px;border-top:1px solid #edf0ed}.progress:first-child{border-top:0}.progress-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.bar{height:7px;background:#e6ebe7;border-radius:999px;overflow:hidden;margin-top:10px}.fill{height:100%;background:var(--teal-500);border-radius:999px}.state{display:flex;align-items:flex-start;gap:12px;background:#edf5f2;border:1px solid #d0e1dc;border-radius:16px;padding:15px;color:var(--teal-800);font-size:13px;font-weight:700;line-height:1.5;margin:0 0 14px}.chartcard{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:15px;margin:0 0 14px}.charthead{display:flex;justify-content:space-between;align-items:end;margin-bottom:8px}.chartvalue{font-size:22px;font-weight:900}.chartmeta{font-size:11px;color:var(--positive);font-weight:800}.chartsvg{display:block;width:100%;height:135px}.conversation{display:grid;gap:10px;margin:0 0 14px}.bubble{max-width:86%;padding:12px 14px;border-radius:16px;background:var(--surface);border:1px solid var(--line);font-size:13px;line-height:1.5}.bubble.user{justify-self:end;background:var(--teal-800);color:#fff;border-color:var(--teal-800);border-end-end-radius:5px}.bubble.assistant{justify-self:start;border-end-start-radius:5px}.sheetbackdrop,.dialogbackdrop{position:absolute;inset:0;background:rgba(16,39,35,.42);z-index:5}.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:26px 26px 0 0;padding:10px 20px 28px;box-shadow:0 -20px 55px rgba(16,39,35,.22)}.grabber{width:42px;height:4px;border-radius:999px;background:#d6ddd8;margin:0 auto 18px}.sheet h2,.dialog h2{font-size:19px;margin:0 0 12px}.sheetrow{display:flex;gap:10px;align-items:center;padding:13px 0;border-top:1px solid var(--line);font-size:12px}.sheetrow:first-of-type{border-top:0}.dialog{position:absolute;left:26px;right:26px;top:260px;background:#fff;border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(16,39,35,.28)}.dialog p{font-size:12px;color:var(--muted);line-height:1.55;margin:0}.nav{position:absolute;bottom:0;left:0;right:0;height:84px;background:rgba(255,255,255,.98);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);padding:8px 6px 11px;z-index:4}.navitem{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#84908a;font-size:9.5px;font-weight:700}.navitem.active{color:var(--teal-800)}.navitem.add .navicon{width:42px;height:42px;margin-top:-24px;background:var(--teal-800);color:#fff;border-radius:15px;box-shadow:0 8px 18px rgba(28,57,52,.25)}.navicon{width:30px;height:28px;display:grid;place-items:center;border-radius:10px}.navitem.active:not(.add) .navicon{background:var(--teal-100)}.amount{font-family:PlexLatin,PlexArabic,sans-serif;font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}.ltrmark{direction:ltr;unicode-bidi:isolate}.svgicon{display:block}.boardgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.boardgrid .section{margin:0}.boardgrid h3{font-size:14px;margin:0 0 10px}.watermark{position:absolute;inset:auto 18px ${hasTab ? 88 : 8}px auto;color:#a8b0ab;font-size:8px;opacity:.55}
</style><style>.brand-highlights{display:grid;gap:9px;margin-bottom:16px}.trustitem{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 13px;font-size:12px;font-weight:700}.trusticon{width:32px;height:32px;border-radius:10px;background:var(--teal-100);color:var(--teal-700);display:grid;place-items:center}.composer{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:12px}.composer-send{width:36px;height:36px;border-radius:12px;background:var(--teal-800);color:#fff;display:grid;place-items:center}.more-footer{display:flex;align-items:center;justify-content:space-between;margin:18px 4px;color:var(--muted);font-size:11px}.more-footer strong{color:var(--teal-800)}.quickadd-scrim{position:absolute;inset:0 0 84px;background:rgba(16,39,35,.18);z-index:3}.quickadd-fan{position:absolute;z-index:7;left:50%;bottom:74px;width:270px;height:154px;transform:translateX(-50%);background:#fff;border:1px solid var(--line);border-radius:150px 150px 18px 18px;box-shadow:0 -18px 46px rgba(16,39,35,.2);padding:20px 26px 13px}.quickadd-title{text-align:center;font-size:11px;font-weight:800;color:var(--muted);margin-bottom:10px}.quickadd-options{display:flex;justify-content:space-between;align-items:flex-start;gap:36px}.quickadd-option{flex:1;display:grid;justify-items:center;gap:7px;color:var(--teal-800);font-size:12px;font-weight:800;white-space:nowrap}.quickadd-icon{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:var(--teal-100);color:var(--teal-800);box-shadow:0 7px 16px rgba(28,57,52,.12)}.quickadd-option.voice .quickadd-icon{background:#f5eadc;color:#8b5e34}.quickadd-close{position:absolute;z-index:9;left:50%;bottom:33px;width:46px;height:46px;transform:translateX(-50%);display:grid;place-items:center;border-radius:16px;background:var(--teal-800);color:#fff;box-shadow:0 9px 22px rgba(16,39,35,.28)}</style></head><body><main class="screen ${screenType}"><div class="status" dir="ltr"><span class="ltrmark">09:41</span><span class="ltrmark">5G&nbsp;&nbsp;82%</span></div>${renderHeader(screen, hasTab, brandMoment, rtl)}<div class="content">${mainContent}</div>${renderSheet(screen.bottomSheet)}${renderDialog(screen.dialog)}${hasTab ? renderNav(nav, tabIndex) : ''}${screen.quickAdd ? renderQuickAdd(screen.lang) : ''}<div class="watermark">Masarifi · ${esc(screen.id)}</div></main></body></html>`;
}

function renderHeader(screen, hasTab, brandMoment, rtl) {
  const logo = `<img class="logo" src="data:image/png;base64,${logoData}" alt="Masarifi"/>`;
  const brand = `<div class="brandlock">${logo}<span class="brandname">${screen.lang === 'en' ? 'Masarifi' : 'مصاريفي'}</span></div>`;
  const action = hasTab ? `<div class="header-actions"><div class="iconbtn">${icon('bell')}</div></div>` : `<div class="iconbtn" style="transform:${rtl ? 'scaleX(-1)' : 'none'}">${icon('back')}</div>`;
  const topLine = hasTab ? `${brand}${action}` : `${action}${brand}`;
  return `<header class="masthead ${hasTab ? 'tabbed' : ''} ${brandMoment ? 'brand' : ''}"><div class="topline">${topLine}</div><div class="heading"><div class="title">${esc(screen.title)}</div>${screen.subtitle ? `<div class="subtitle">${esc(screen.subtitle)}</div>` : ''}${screen.scope ? `<div class="scope">${icon('wallet',14)}${esc(screen.scope)}</div>` : ''}</div></header>`;
}

function renderBrandHighlights(lang) {
  const items = lang === 'en' ? ['Private automatic tracking', 'Review before approval', 'Clear reports and plans'] : ['تتبع تلقائي يحترم خصوصيتك', 'مراجعة واضحة قبل الاعتماد', 'تقارير وخطط مالية مفهومة'];
  return `<section class="brand-highlights">${items.map((item,index)=>`<div class="trustitem"><span class="trusticon">${icon(index===0?'shield':index===1?'check':'chart',18)}</span><span>${esc(item)}</span></div>`).join('')}</section>`;
}

function renderAssistantComposer(lang) {
  return `<div class="composer"><span>${lang === 'en' ? 'Ask about a transaction, budget, or plan' : 'اسأل عن حركة أو ميزانية أو خطة'}</span><span class="composer-send">${icon('spark',18)}</span></div>`;
}

function renderMoreFooter(lang) {
  return `<div class="more-footer"><span>${lang === 'en' ? 'Version 0.0.1' : 'الإصدار 0.0.1'}</span><strong>${lang === 'en' ? 'Masarifi' : 'مصاريفي'}</strong></div>`;
}

function renderQuickAdd(lang) {
  const manual = lang === 'en' ? 'Manual entry' : 'تسجيل يدوي';
  const voice = lang === 'en' ? 'Voice entry' : 'تسجيل صوتي';
  return `<style>
    .quickadd-scrim{background:rgba(16,39,35,.045);backdrop-filter:none}
    .quickadd-fan{width:132px;height:62px;bottom:94px;padding:6px;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.78);border-radius:31px;backdrop-filter:blur(22px) saturate(170%);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),inset 0 -1px 0 rgba(70,117,108,.12),0 12px 30px rgba(16,39,35,.17)}
    .quickadd-fan:after{content:"";position:absolute;inset:3px 18px auto;height:18px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));pointer-events:none}
    .quickadd-options{height:100%;align-items:stretch;gap:0}
    .quickadd-option{min-width:0;display:flex;align-items:center;justify-content:center;transform:none;border-radius:25px}
    .quickadd-option:first-child{border-inline-end:1px solid rgba(49,92,85,.13)}
    .quickadd-option.voice{transform:none}
    .quickadd-icon{position:relative;width:42px;height:42px;flex:0 0 42px;border-radius:50%;background:rgba(227,236,233,.78);border:1px solid rgba(255,255,255,.84);backdrop-filter:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.88),0 4px 10px rgba(16,39,35,.08)}
    .quickadd-icon:after{content:"";position:absolute;inset:3px 6px auto;height:11px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,0));pointer-events:none}
    .quickadd-option.voice .quickadd-icon{background:rgba(245,234,220,.82);border-color:rgba(255,255,255,.86);color:#7b5230}
    .quickadd-close{width:46px;height:46px;bottom:33px;border-radius:50%;background:rgba(22,51,47,.82);border:1px solid rgba(255,255,255,.38);backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 9px 22px rgba(16,39,35,.24)}
  </style><div class="quickadd-scrim"></div><aside class="quickadd-fan quickadd-pill"><div class="quickadd-options"><div class="quickadd-option" role="button" aria-label="${manual}"><span class="quickadd-icon">${icon('edit',21)}</span></div><div class="quickadd-option voice" role="button" aria-label="${voice}"><span class="quickadd-icon">${icon('mic',21)}</span></div></div></aside><div class="quickadd-close">${icon('close',21)}</div>`;
}

function renderHero(hero, metrics = []) { if (!hero) return ''; return `<section class="hero"><div class="label">${esc(hero.label)}</div><div class="value">${amount(hero.value)}</div><div class="note">${esc(hero.note)}</div>${metrics.length ? `<div class="hero-metrics">${metrics.slice(0,3).map(([k,v])=>`<div class="hero-metric"><div class="k">${esc(k)}</div><div class="v">${amount(v)}</div></div>`).join('')}</div>` : ''}</section>`; }
function renderMetrics(metrics) { return metrics.length ? `<section class="metricgrid">${metrics.slice(0,3).map(([k,v])=>`<div class="metric"><div class="k">${esc(k)}</div><div class="v">${amount(v)}</div></div>`).join('')}</section>` : ''; }
function renderAttention(items, lang) { return items.length ? `<section class="attention"><div class="attention-head">${icon('alert',18)}<span>${lang === 'en' ? 'Needs attention' : 'يحتاج انتباه'}</span></div>${items.map(item=>`<div class="attitem"><span class="attdot"></span><span>${esc(item)}</span></div>`).join('')}</section>` : ''; }
function renderRows(rows, area, lang) { if (!rows.length) return ''; const iconName = area === '01-accounts' ? 'wallet' : area === '02-categories' ? 'tag' : area === '13-notifications' ? 'bell' : area === '15-security-privacy' ? 'shield' : 'receipt'; const title = lang === 'en' ? 'Details' : area === '03-transactions' ? 'الحركات الأخيرة' : 'التفاصيل'; return `<div class="section-title"><span>${title}</span><span class="link">${lang === 'en' ? 'View all' : 'عرض الكل'}</span></div><section class="section">${rows.map(([rowTitle,meta,val])=>`<div class="row"><div class="rowlead">${icon(iconName,19)}</div><div class="rowmain"><div class="rowtitle">${esc(rowTitle)}</div>${meta ? `<div class="rowmeta">${esc(meta)}</div>` : ''}</div><div class="rowtail">${val ? `<div class="rowamount">${amount(val)}</div>` : icon('chevron',17)}</div></div>`).join('')}</section>`; }
function renderProgress(items, lang) { return items.length ? `<div class="section-title"><span>${lang === 'en' ? 'Financial progress' : 'التقدم المالي'}</span></div><section class="section">${items.map(([title,pct,meta])=>`<div class="progress"><div class="progress-head"><div><div class="rowtitle">${esc(title)}</div><div class="rowmeta">${esc(meta)}</div></div><div class="rowamount">${Math.round(pct)}%</div></div><div class="bar"><div class="fill" style="width:${Math.max(4,Math.min(100,pct))}%"></div></div></div>`).join('')}</section>` : ''; }
function renderFields(fields, lang) { return fields.length ? `<div class="section-title"><span>${lang === 'en' ? 'Details' : 'البيانات'}</span></div><section class="fields">${fields.map(([label,value])=>`<div class="field"><div class="fieldcopy"><div class="fieldlabel">${esc(label)}</div><div class="fieldvalue">${esc(value)}</div></div><div class="fieldicon">${icon('chevron',18)}</div></div>`).join('')}</section>` : ''; }
function renderChips(chips) { return chips.length ? `<div class="chipbar">${chips.map(chip=>`<span class="chip">${esc(chip)}</span>`).join('')}</div>` : ''; }
function renderActions(actions) { return actions.length ? `<div class="actions">${actions.map((action,i)=>`<div class="btn ${i===1?'secondary':i>1?'tertiary':''}">${i===0?icon('check',18):''}<span>${esc(action)}</span></div>`).join('')}</div>` : ''; }
function renderState(state) { return state ? `<div class="state">${icon('spark',20)}<span>${esc(state)}</span></div>` : ''; }
function renderChart(chart, lang) { if (!chart) return ''; if (chart === 'bars') return `<section class="chartcard"><div class="charthead"><div><div class="rowmeta">${lang === 'en' ? 'Spending distribution' : 'توزيع المصروف'}</div><div class="chartvalue">5,559.50 <small>SAR</small></div></div><div class="chartmeta">${lang === 'en' ? '−8% from July' : '−8% عن يوليو'}</div></div><svg class="chartsvg" viewBox="0 0 330 135" aria-hidden="true"><g fill="#e3ece9">${[18,52,86,120].map(y=>`<rect x="0" y="${y}" width="330" height="1"/>`).join('')}</g>${[58,88,45,105,72,116].map((h,i)=>`<rect x="${18+i*52}" y="${128-h}" width="28" height="${h}" rx="7" fill="${i===3?'#a87446':'#315c55'}"/>`).join('')}</svg></section>`; return `<section class="chartcard"><div class="charthead"><div><div class="rowmeta">${lang === 'en' ? 'Net cash-flow trend' : 'اتجاه صافي التدفق'}</div><div class="chartvalue">+12,840 <small>SAR</small></div></div><div class="chartmeta">${lang === 'en' ? '8% better' : 'أفضل بـ 8%'}</div></div><svg class="chartsvg" viewBox="0 0 330 135" aria-hidden="true"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#46756c" stop-opacity=".28"/><stop offset="1" stop-color="#46756c" stop-opacity="0"/></linearGradient></defs><path d="M0 108 C35 100 44 72 78 80 S124 102 158 62 S207 28 238 53 S286 50 330 20 V135 H0Z" fill="url(#area)"/><path d="M0 108 C35 100 44 72 78 80 S124 102 158 62 S207 28 238 53 S286 50 330 20" fill="none" stroke="#315c55" stroke-width="4" stroke-linecap="round"/><circle cx="330" cy="20" r="5" fill="#a87446"/></svg></section>`; }
function renderConversation(items) { return items.length ? `<section class="conversation">${items.map(([who,text])=>`<div class="bubble ${who==='user'?'user':'assistant'}">${esc(text)}</div>`).join('')}</section>` : ''; }
function renderSheet(sheet) { return sheet ? `<div class="sheetbackdrop"><aside class="sheet"><div class="grabber"></div><h2>${esc(sheet.title)}</h2>${sheet.rows.map(r=>`<div class="sheetrow">${icon('check',17)}<span>${esc(r)}</span></div>`).join('')}</aside></div>` : ''; }
function renderDialog(dialog) { return dialog ? `<div class="dialogbackdrop"><aside class="dialog"><h2>${esc(dialog.title)}</h2><p>${esc(dialog.body)}</p><div class="actions"><div class="btn">${esc(dialog.primary)}</div><div class="btn secondary">${esc(dialog.secondary)}</div></div></aside></div>` : ''; }
function renderBoard(screen) { return screen.board ? `<div class="boardgrid"><section class="section padded"><h3>Signature patterns</h3>${screen.components.map(c=>`<div class="rowmeta" style="margin-top:10px">${esc(c)}</div>`).join('')}</section><section class="section padded"><h3>State contract</h3>${screen.states.map(st=>`<div class="rowmeta" style="margin-top:10px">${esc(st)}</div>`).join('')}</section></div>` : ''; }
function renderNav(nav, activeIndex) { const names = ['home','receipt','plus','chart','grid']; return `<nav class="nav">${nav.map((label,i)=>`<div class="navitem ${i===activeIndex?'active':''} ${i===2?'add':''}"><span class="navicon">${icon(names[i],20)}</span><span>${esc(label)}</span></div>`).join('')}</nav>`; }

function markdownTable() {
  const lines = [
    '# Masarifi Final Visual Mockups',
    '',
    'Generated for visual approval before implementation. These PNGs do not modify production UI code, routes, business logic, permissions, or product capabilities.',
    '',
    `Total user-facing screens identified: ${new Set(screens.map((item) => item.screen + '|' + item.route)).size}`,
    `Total visual mockups created: ${screens.length}`,
    '',
    '## Inventory',
    '',
    '| Area | Screen | Existing route | Image | Visual hierarchy | R01 components/patterns | States represented | Analysis reference | Variants |',
    '|---|---|---|---|---|---|---|---|---|'
  ];
  for (const item of screens) {
    const area = areas.find(([folder]) => folder === item.area)?.[1] ?? item.area;
    const hierarchy = [item.hero ? 'summary first' : null, item.attention.length ? 'attention rail' : null, item.rows.length ? 'grouped rows' : null, item.fields.length ? 'focused form' : null, item.progress.length ? 'calm progress' : null, item.chart ? 'chart narrative' : null].filter(Boolean).join(', ') || 'state/decision surface';
    const variants = item.lang === 'en' ? 'English LTR' : 'Arabic RTL';
    lines.push(`| ${escMd(area)} | ${escMd(item.screen)} | \`${escMd(item.route)}\` | [${escMd(item.file)}](${escMd(item.area + '/' + item.file)}) | ${escMd(hierarchy)} | ${escMd(item.components.join(', ') || 'R01 shared surfaces')} | ${escMd(item.states.join(', '))} | ${escMd(item.analysis)} | ${variants} |`);
  }
  lines.push('', '## Intentionally excluded technical/nonvisual routes', '');
  for (const route of excludedRoutes) lines.push(`- ${route}`);
  lines.push('', '## Notes', '', '- Every Arabic RTL mockup has a matching English LTR counterpart.', '- Repeated management/form/review screens intentionally share anatomy so the redesign remains implementable on the existing React Native architecture.', '- Values are realistic Masarifi sample content for review, not seeded production data.');
  return lines.join('\n');
}

function escMd(value) {
  return String(value).replace(/\|/g, '\\|');
}

for (const [folder] of areas) {
  fs.mkdirSync(path.join(root, folder), { recursive: true });
}

const identities = screens.map(({ id }) => id);
const outputs = screens.map(({ area, file }) => `${area}/${file}`);
if (new Set(identities).size !== screens.length || new Set(outputs).size !== screens.length) {
  throw new Error('Mockup inventory contains duplicate screen IDs or output paths.');
}

const browser = await chromium.launch({ headless: true });
for (const screen of screens) {
  const page = await browser.newPage({
    viewport: {
      width: screen.board ? 1080 : 390,
      height: screen.board ? 1428 : 844,
      deviceScaleFactor: screen.id.startsWith('transactions-list-') ? 1 : 2
    }
  });
  await page.setContent(renderScreen(screen), { waitUntil: 'load' });
  if (screen.quickAdd) {
    await page.evaluate(() => {
      const viewport = globalThis.document.querySelector('.screen');
      viewport.style.height = '844px';
      viewport.style.minHeight = '844px';
    });
  }
  await page.screenshot({
    path: path.join(root, screen.area, screen.file),
    fullPage: true
  });
  await page.close();
}
await browser.close();

for (const screen of screens) {
  const outputPath = path.join(root, screen.area, screen.file);
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error(`Missing mockup output: ${outputPath}`);
  }
}

fs.writeFileSync(path.join(root, 'README.md'), markdownTable(), 'utf8');

console.log(JSON.stringify({
  screensIdentified: new Set(screens.map((item) => item.screen + '|' + item.route)).size,
  mockupsCreated: screens.length,
  output: root
}, null, 2));
