import type { UserRecord } from "@/types/admin";

const base = [
  ["USR-10482", "نورة العتيبي", "n***@example.test", "السعودية", "iOS", "Premium", "active", "verified", "low", "SAR", "Asia/Riyadh", "4.8.2"],
  ["USR-10479", "سالم المنصوري", "s***@example.test", "الإمارات", "Android", "Basic", "active", "verified", "low", "AED", "Asia/Dubai", "4.8.1"],
  ["USR-10475", "ليان الحربي", "l***@example.test", "السعودية", "Android", "Free", "pending", "pending", "medium", "SAR", "Asia/Riyadh", "4.7.9"],
  ["USR-10461", "Omar Kareem", "o***@example.test", "الإمارات", "iOS", "Premium", "active", "verified", "low", "AED", "Asia/Dubai", "4.8.2"],
  ["USR-10443", "ريم القحطاني", "r***@example.test", "السعودية", "iOS", "Basic", "suspended", "verified", "high", "SAR", "Asia/Riyadh", "4.8.0"],
  ["USR-10431", "Maya Nasser", "m***@example.test", "الإمارات", "Android", "Free", "active", "pending", "medium", "AED", "Asia/Dubai", "4.7.8"],
] as const;

export const users: UserRecord[] = base.map((item, index) => ({
  id: item[0], name: item[1], email: item[2], country: item[3], platform: item[4], plan: item[5],
  status: item[6], verification: item[7], risk: item[8],
  registeredAt: `2026-0${index + 1}-1${index + 1}`,
  lastActive: `2026-07-25T0${8 - index}:2${index}:00+03:00`,
  language: index % 3 === 0 ? "English" : "العربية", currency: item[9], timezone: item[10],
  appVersion: item[11], accounts: 2 + (index % 3), transactions: 148 + index * 43,
  goals: index % 4, lastSync: `2026-07-25T0${8 - index}:1${index}:00+03:00`, importSources: 2 + (index % 4),
}));
