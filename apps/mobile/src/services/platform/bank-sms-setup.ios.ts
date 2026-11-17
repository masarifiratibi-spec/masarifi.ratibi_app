import {
  isBenchmarkReadOnly,
  resolveClientRuntime
} from '@/config/client-runtime';
import { currentLocale, translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { captureTrackingAdmission } from '@/state/tracking-admission';
import { reconcileFinancialReset } from '../financial-generation';
import { createLiveAccountService } from '../live/account-service';
import {
  captureLiveClerkIdentity,
  readLogoutSessionAnchor
} from '../live/auth-service';
import { createLiveCategoryLifecycleService } from '../live/category-lifecycle-service';
import { bankSmsNative, disableBankSmsForOwner } from './bank-sms-bridge.ios';

async function scope() {
  const native = bankSmsNative();
  const runtime = resolveClientRuntime();
  const session = useAppShellStore.getState().session;
  const owner = session?.userId;
  if (
    !native ||
    runtime.mode !== 'live' ||
    isBenchmarkReadOnly() ||
    runtime.apiUrl !== 'https://api.masarifiratibi.com' ||
    !runtime.clerkPublishableKey ||
    !owner ||
    session?.status !== 'authenticated'
  )
    throw Error('bank_sms_unavailable');
  const admitted = captureTrackingAdmission(owner);
  const anchor = await readLogoutSessionAnchor(owner);
  admitted();
  if (!anchor) throw Error('bank_sms_unavailable');
  const assertCurrent = async () => {
    admitted();
    if ((await readLogoutSessionAnchor(owner)) !== anchor)
      throw Error('bank_sms_session_changed');
    admitted();
  };
  return {
    native,
    owner,
    anchor,
    assertCurrent,
    publishableKey: runtime.clerkPublishableKey
  };
}

export async function readBankSmsSetup() {
  const current = await scope();
  const state = await current.native.status(current.owner, current.anchor);
  await current.assertCurrent();
  return state;
}

export async function enableBankSms() {
  const current = await scope();
  const actor = await captureLiveClerkIdentity();
  if (actor.userId !== current.owner || actor.sessionId !== current.anchor)
    throw Error('bank_sms_session_changed');
  const assertActor = async (
    captured: Awaited<ReturnType<typeof captureLiveClerkIdentity>>
  ) => {
    if (
      captured.userId !== current.owner ||
      captured.sessionId !== current.anchor
    )
      throw Error('bank_sms_session_changed');
    await current.assertCurrent();
  };
  const { generation } = await reconcileFinancialReset(current.owner);
  await current.assertCurrent();
  const revision = await current.native.revision();
  const accounts = createLiveAccountService({ assertActor });
  const categories = createLiveCategoryLifecycleService({ assertActor });
  const [accountRows, categoryRows] = await Promise.all([
    accounts.listAccounts(),
    categories.listCategories()
  ]);
  await current.assertCurrent();
  const locale = currentLocale();
  await current.native.enable(
    JSON.stringify({
      owner: current.owner,
      session: current.anchor,
      publishableKey: current.publishableKey,
      generation,
      revision,
      title: translate('tracking.shortcut.transactionTitle'),
      savedNotificationBody: translate('tracking.bankSms.confirmed', locale),
      accounts: accountRows
        .filter((account) => account.status === 'active')
        .map((account) => ({
          id: account.id,
          name: account.name,
          kind: 'account',
          currency: account.currencyCode
        })),
      categories: categoryRows
        .filter(
          (category) => category.status === 'active' && category.financialType
        )
        .map((category) => ({
          id: categories.serverCategoryId(category.id),
          name: locale === 'ar' ? category.labelAr : category.labelEn,
          kind: category.financialType
        }))
    })
  );
  try {
    await current.assertCurrent();
  } catch (error) {
    await disableBankSmsForOwner(current.owner);
    throw error;
  }
}

export async function disableBankSms() {
  const current = await scope();
  await current.assertCurrent();
  await disableBankSmsForOwner(current.owner);
}
