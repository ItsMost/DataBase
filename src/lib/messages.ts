/**
 * WhatsApp texts built from editable templates (settings).
 * The player's own price is never written in a reminder: it is decided at payment time.
 */
import type { Player, AppSettings } from '../types';
import {
  analyzePlayer,
  formatDate,
  getSessionCount,
  localToday,
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_RECEIPT_TEMPLATE,
  EXTRA_PAYMENT,
  SINGLE_SESSION,
} from './subscription';

/** Variables the coach can use in the templates (shown in settings). */
export const REMINDER_VARIABLES = ['{الاسم}', '{تاريخ_الانتهاء}', '{حالة_الاشتراك}', '{الحصص_الزيادة}', '{سطر_الزيادة}'];
export const RECEIPT_VARIABLES = ['{الاسم}', '{المبلغ}', '{نوع_الدفع}', '{تاريخ_الدفع}', '{تاريخ_الانتهاء}', '{صلاحية_الاشتراك}'];

/** Replace {name} variables; drop lines that end up empty. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let text = template;
  Object.entries(vars).forEach(([key, value]) => {
    text = text.split(`{${key}}`).join(value);
  });
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
}

/** Egyptian numbers -> international format for wa.me (same rule the app used before). */
export function formatPhoneForWhatsApp(rawPhone?: string): string {
  if (!rawPhone || !rawPhone.trim()) return '';
  let formatted = rawPhone.trim().replace(/[\s-]/g, '');
  if (formatted.startsWith('0')) {
    formatted = '2' + formatted;
  } else if (!formatted.startsWith('20') && !formatted.startsWith('+')) {
    formatted = '20' + formatted;
  }
  return formatted.replace('+', '');
}

export function whatsAppLink(phone: string | undefined, text?: string): string | null {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  return text ? `https://wa.me/${formatted}?text=${encodeURIComponent(text)}` : `https://wa.me/${formatted}`;
}

/** "اشتراكك خلص يوم ..." / "خلصت حصصك (12 من 12)" / "اشتراكك بينتهي يوم ..." */
function subscriptionPhrase(player: Player, settings: AppSettings): { phrase: string; endDate: string } {
  const st = analyzePlayer(player, settings).status;
  if (!st.hasSubscription) return { phrase: 'مفيش اشتراك ساري دلوقتي', endDate: '-' };
  if (st.endMode === 'sessions' && st.usedSessions >= st.totalSessions && st.totalSessions > 0) {
    return { phrase: `خلصت حصصك (${st.usedSessions} من ${st.totalSessions})`, endDate: 'خلصت حصصك' };
  }
  if (st.isExpired) return { phrase: `اشتراكك خلص يوم ${st.endDateStr}`, endDate: st.endDateStr };
  if (st.endMode === 'sessions') {
    const left = st.totalSessions - st.usedSessions;
    return { phrase: `فاضلك ${left} حصص من ${st.totalSessions}`, endDate: `بعد ${left} حصص` };
  }
  return { phrase: `اشتراكك بينتهي يوم ${st.endDateStr}`, endDate: st.endDateStr };
}

/** Payment reminder (no player price in it). */
export function buildReminderMessage(player: Player, settings: AppSettings): string {
  const { phrase, endDate } = subscriptionPhrase(player, settings);
  const extras = analyzePlayer(player, settings).balance.extraCount;
  return fillTemplate(settings.waReminderTemplate || DEFAULT_REMINDER_TEMPLATE, {
    'الاسم': player.name,
    'تاريخ_الانتهاء': endDate,
    'حالة_الاشتراك': phrase,
    'الحصص_الزيادة': String(extras),
    'سطر_الزيادة': extras > 0 ? `وحضرت ${extras} حصص زيادة` : '',
  });
}

export interface ReceiptInfo {
  playerId: string;
  amount: number;
  subType: string;
  date: string;
}

/** Receipt after a payment: amount + new end (date, or sessions for "بتخلص بالحصص"). */
export function buildReceiptMessage(player: Player, receipt: ReceiptInfo, settings: AppSettings): string {
  const st = analyzePlayer(player, settings).status;
  let validity: string;
  let endDate = '-';
  if (receipt.subType === EXTRA_PAYMENT) {
    validity = 'الحصص الزيادة اتسددت ✅';
  } else if (receipt.subType === SINGLE_SESSION) {
    validity = 'حصة واحدة النهارده';
    endDate = formatDate(receipt.date);
  } else if (st.endMode === 'sessions') {
    const size = getSessionCount(receipt.subType) || st.totalSessions;
    const left = Math.max(0, size - st.usedSessions);
    validity = `الاشتراك ${size} حصة، فاضل منهم ${left}`;
    endDate = `بعد ${left} حصص`;
  } else {
    validity = `الاشتراك بينتهي يوم ${st.endDateStr}`;
    endDate = st.endDateStr;
  }
  return fillTemplate(settings.waReceiptTemplate || DEFAULT_RECEIPT_TEMPLATE, {
    'الاسم': player.name,
    'المبلغ': String(receipt.amount),
    'نوع_الدفع': receipt.subType,
    'تاريخ_الدفع': formatDate(receipt.date || localToday()),
    'تاريخ_الانتهاء': endDate,
    'صلاحية_الاشتراك': validity,
  });
}
