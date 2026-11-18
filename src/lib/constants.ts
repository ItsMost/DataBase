/**
 * App-wide constants in one place (subscription types, system record ids, months, defaults).
 */

// ---- Subscription types ----
export const SINGLE_SESSION = 'حصة واحدة';
export const EXTRA_PAYMENT = 'حصص زيادة';
export const ATTEND_ONLY_MONTHLY = 'حضور فقط (مشترك شهرياً)';
export const ATTEND_ONLY_TYPES = [ATTEND_ONLY_MONTHLY, 'حضور فقط'];

/** Packages the coach can sell (value saved in the data + label in the forms). */
export const PACKAGE_OPTIONS: { value: string; label: string }[] = [
  { value: '8 حصص', label: '8 حصص في الشهر' },
  { value: '10 حصص', label: '10 حصص في الشهر' },
  { value: '12 حصة', label: '12 حصة في الشهر' },
  { value: '16 حصة', label: '16 حصة في الشهر' },
  { value: '20 حصة', label: '20 حصة في الشهر' },
];
export const SINGLE_SESSION_LABEL = 'حصة واحدة (دفع يومي)';

// ---- System records stored in players_sync ----
export const SETTINGS_ID = 'sys_settings';
export const EXPENSES_ID = 'sys_expenses';
export const GROUPS_CONFIG_ID = 'sys_groups_config';
export const MONTH_LOCKS_ID = 'sys_month_locks';

// ---- Places, expenses, alerts ----
export const DEFAULT_PLACE = 'الجيم';
export const DEFAULT_GROUP = 'العام';
export const OTHER_EXPENSE = 'تانية';
export const DEFAULT_EXPENSE_CATEGORIES = ['مواصلات', 'أدوات', 'إيجار', OTHER_EXPENSE];
export const DEFAULT_INACTIVE_DAYS = 30;

// ---- Gym share & discounted packages (defaults; editable in settings) ----
export const DEFAULT_GYM_RATE = 60;
export const DEFAULT_DISCOUNT_THRESHOLD = 1500;
export const DEFAULT_DISCOUNT_TIERS = [
  { sessions: 8, cost: 800 },
  { sessions: 12, cost: 900 },
  { sessions: 16, cost: 1000 },
  { sessions: 20, cost: 1100 },
];

// ---- WhatsApp templates (editable in settings) ----
export const DEFAULT_REMINDER_TEMPLATE = [
  'أهلاً {الاسم} 👋',
  '{حالة_الاشتراك}',
  '{سطر_الزيادة}',
  'ياريت تجدد الاشتراك علشان نكمل 💪',
].join('\n');
export const DEFAULT_RECEIPT_TEMPLATE = [
  'أهلاً {الاسم} ✅',
  'تم استلام {المبلغ} ج ({نوع_الدفع}) يوم {تاريخ_الدفع}.',
  '{صلاحية_الاشتراك}',
  'شكراً 🙏',
].join('\n');

// ---- Months ----
export const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
