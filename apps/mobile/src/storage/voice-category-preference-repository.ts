import type { VoiceCategoryPreference } from '@/domain/voice-capture';
import { normalizeMerchant } from '@/domain/voice-capture';
import { openDatabase } from './database';

export class VoiceCategoryPreferenceRepository {
  async get(merchant: string): Promise<VoiceCategoryPreference | null> {
    const row = await (await openDatabase()).getFirstAsync<{
      id: string;
      merchant_key: string;
      merchant_label: string;
      category_id: string;
      created_at: number;
      updated_at: number;
    }>(
      `SELECT p.* FROM voice_category_preferences p
       JOIN finance_categories c ON c.id = p.category_id
       WHERE p.merchant_key = ? AND c.status = 'active'`,
      normalizeMerchant(merchant)
    );
    return row
      ? {
          id: row.id,
          merchantKey: row.merchant_key,
          merchantLabel: row.merchant_label,
          categoryId: row.category_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      : null;
  }

  async save(merchant: string, categoryId: string): Promise<VoiceCategoryPreference> {
    const database = await openDatabase();
    const category = await database.getFirstAsync<{ status: string }>(
      'SELECT status FROM finance_categories WHERE id = ?',
      categoryId
    );
    if (category?.status !== 'active') throw new Error('invalid_category');
    const merchantKey = normalizeMerchant(merchant);
    const existing = await this.get(merchant);
    const now = Date.now();
    const value: VoiceCategoryPreference = {
      id: existing?.id ?? `voice-pref-${encodeURIComponent(merchantKey)}`,
      merchantKey,
      merchantLabel: merchant.trim(),
      categoryId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    await database.runAsync(
      `INSERT INTO voice_category_preferences
       (id, merchant_key, merchant_label, category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(merchant_key) DO UPDATE SET
         merchant_label = excluded.merchant_label,
         category_id = excluded.category_id,
         updated_at = excluded.updated_at`,
      value.id,
      value.merchantKey,
      value.merchantLabel,
      value.categoryId,
      value.createdAt,
      value.updatedAt
    );
    return value;
  }

  async remove(merchant: string): Promise<void> {
    await (await openDatabase()).runAsync(
      'DELETE FROM voice_category_preferences WHERE merchant_key = ?',
      normalizeMerchant(merchant)
    );
  }
}
