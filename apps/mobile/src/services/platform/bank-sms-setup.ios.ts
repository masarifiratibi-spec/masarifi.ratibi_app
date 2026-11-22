import {
  isBenchmarkReadOnly,
  resolveClientRuntime
} from '@/config/client-runtime';
import { currentLocale, translate } from '@/localization/i18n';
import { supportsAutomaticTrackingAccountType } from '@/domain/core-finance';
import { getCurrencyMinorUnitScale } from '@/domain/currencies';
import { useAppShellStore } from '@/state/app-shell';
import { captureTrackingAdmission } from '@/state/tracking-admission';
import { createAppShellStorage } from '@/storage/app-shell-storage';
import { VoiceCategoryPreferenceRepository } from '@/storage/voice-category-preference-repository';
import { reconcileFinancialReset } from '../financial-generation';
import { requestRecentAuthentication } from '../live/http-client';
import { createLiveAccountService } from '../live/account-service';
import {
  captureLiveClerkIdentity,
  readLogoutSessionAnchor
} from '../live/auth-service';
import { createLiveCategoryLifecycleService } from '../live/category-lifecycle-service';
import { knownMerchantCategories } from '../voice-category-service';
import {
  bankSmsNative,
  disableBankSmsForOwner,
  type BankSmsConfiguration
} from './bank-sms-bridge.ios';

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

function readStatus(current: Awaited<ReturnType<typeof scope>>, detail: 'summary' | 'configuration') {
  if (detail === 'summary' && current.native.statusSummary)
    return current.native.statusSummary(current.owner, current.anchor);
  return current.native.status(current.owner, current.anchor);
}

export async function readBankSmsSetup(detail: 'summary' | 'configuration' = 'configuration') {
  const current = await scope();
  const state = await readStatus(current, detail);
  const setupCompleted = await createAppShellStorage()
    .loadTrackingHomeCardDismissed()
    .catch(() => false);
  await current.assertCurrent();
  return { ...state, setupCompleted };
}

export function subscribeBankSmsVerification(listener: () => void) {
  return bankSmsNative()?.addListener('onVerificationChanged', listener);
}

export async function readLastBankSmsReceipt() {
  const current = await scope();
  const state = await readStatus(current, 'summary');
  await current.assertCurrent();
  if (state.enabled && state.lastTransactionId)
    return { ownerId: current.owner, transactionId: state.lastTransactionId };
}

export async function verifyPendingBankSms(epoch: string) {
  const current = await scope();
  const state = await readStatus(current, 'summary');
  await current.assertCurrent();
  if (!state.enabled || state.verificationEpoch !== epoch) return;
  const actor = await captureLiveClerkIdentity();
  if (actor.userId !== current.owner || actor.sessionId !== current.anchor)
    throw Error('bank_sms_session_changed');
  if (!(await requestRecentAuthentication())) return;
  await actor.assertCurrent();
  await current.assertCurrent();
  // The native service obtains a fresh token for this same Clerk session.
  await current.native.retryVerified(current.owner, current.anchor, epoch);
}

export async function completeBankSmsSetup() {
  const current = await scope();
  const state = await readStatus(current, 'summary');
  await current.assertCurrent();
  if (!state.enabled) throw Error('bank_sms_unavailable');
  await createAppShellStorage().saveTrackingHomeCardDismissed(true);
  await current.assertCurrent();
}

let configurationQueue = Promise.resolve();
let configurationRevision = 0;

function serializeConfiguration(
  configuration: BankSmsConfiguration | undefined,
  refreshOnly: boolean
) {
  // Capture the owner and consent generation before waiting behind a refresh.
  const requested = scope();
  const requestedRevision = configurationRevision;
  const assertRequested = () => {
    if (requestedRevision !== configurationRevision)
      throw Error('bank_sms_disabled');
  };
  const pending = configurationQueue.then(async () => {
    const current = await requested;
    assertRequested();
    await publishBankSms(current, configuration, refreshOnly, assertRequested);
  });
  void requested.catch(() => undefined);
  configurationQueue = pending.catch(() => undefined);
  return pending;
}

export function enableBankSms(configuration?: BankSmsConfiguration) {
  return serializeConfiguration(configuration, false);
}

export function refreshEnabledBankSms() {
  return serializeConfiguration(undefined, true);
}

function ending(value?: string) {
  const digits = value
    ?.trim()
    .replace(/[٠-٩۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660))
    );
  if (digits && !/^\d{4}$/.test(digits)) throw Error('bank_sms_invalid_ending');
  return digits || undefined;
}

async function publishBankSms(
  current: Awaited<ReturnType<typeof scope>>,
  configuration: BankSmsConfiguration | undefined,
  refreshOnly: boolean,
  assertRequested: () => void
) {
  await current.assertCurrent();
  const revision = await current.native.revision();
  const previous = await current.native.status(current.owner, current.anchor);
  if (refreshOnly && !previous.enabled) return;
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
  const accounts = createLiveAccountService({ assertActor });
  const categories = createLiveCategoryLifecycleService({ assertActor });
  const [accountRows, categoryRows, merchantPreferences] = await Promise.all([
    accounts.listAccounts(),
    categories.listCategories(),
    new VoiceCategoryPreferenceRepository().listActiveForOwner(current.owner)
  ]);
  await current.assertCurrent();
  const locale = currentLocale();
  const activeCategories = categoryRows.filter(
    (category) => category.status === 'active' && category.financialType
  );
  const activeAccounts = accountRows.filter(
    (account) => account.status === 'active'
  );
  // A link-only edit keeps the classification choices from the latest native snapshot.
  const defaults = { ...previous.preferences, ...configuration };
  const links =
    configuration?.links ??
    Object.fromEntries(
      (previous.accounts ?? []).map((account) => [account.id, account])
    );
  const categoryId = (
    kind: 'income' | 'expense',
    key: string,
    selected?: string
  ) => {
    const choices = activeCategories.filter(
      (category) => category.financialType === kind
    );
    const category =
      choices.find(
        (choice) => categories.serverCategoryId(choice.id) === selected
      ) ??
      choices.find((choice) => choice.systemKey === key || choice.id === key) ??
      choices[0];
    return category ? categories.serverCategoryId(category.id) : undefined;
  };
  const merchants = Object.fromEntries(
    [
      ...Object.entries(knownMerchantCategories),
      ...merchantPreferences.map(
        ({ merchantKey, categoryId }) => [merchantKey, categoryId] as const
      )
    ].flatMap(([key, id]) => {
      const category = activeCategories.find(
        (choice) =>
          choice.financialType === 'expense' &&
          (choice.id === id || choice.systemKey === id)
      );
      return category ? [[key, categories.serverCategoryId(category.id)]] : [];
    })
  );
  assertRequested();
  await current.native.enable(
    JSON.stringify({
      owner: current.owner,
      session: current.anchor,
      publishableKey: current.publishableKey,
      generation,
      revision,
      title: translate('tracking.shortcut.transactionTitle'),
      savedNotificationBody: translate('tracking.bankSms.confirmed', locale),
      notificationLocale: locale,
      refreshOnly,
      preferences: {
        expenseId: categoryId('expense', 'shopping', defaults?.expenseId),
        incomeId: categoryId('income', 'other-income', defaults?.incomeId),
        salaryId: categoryId('income', 'salary', defaults?.salaryId),
        feeId: categoryId('expense', 'fees', defaults?.feeId),
        merchants
      },
      accounts: activeAccounts.map((account) => {
        const link = links[account.id];
        return {
          id: account.id,
          name: account.name,
          kind: 'account',
          currency: account.currencyCode,
          automaticRouting:
            account.automaticTrackingEnabled &&
            supportsAutomaticTrackingAccountType(account.type),
          type: account.type,
          lastFour: account.lastFour,
          institution: account.institution,
          accountEnding: ending(link?.accountEnding),
          issuer: link?.issuer?.trim().slice(0, 64) || undefined,
          cashAccountId: activeAccounts.find(
            (candidate) =>
              candidate.id === link?.cashAccountId &&
              candidate.type === 'cash' &&
              candidate.currencyCode === account.currencyCode
          )?.id,
          minorUnitScale: getCurrencyMinorUnitScale(account.currencyCode)
        };
      }),
      categories: activeCategories.map((category) => ({
        id: categories.serverCategoryId(category.id),
        name: locale === 'ar' ? category.labelAr : category.labelEn,
        nameAr: category.labelAr,
        nameEn: category.labelEn,
        kind: category.financialType
      }))
    })
  );
  try {
    await current.assertCurrent();
    if (!previous.enabled)
      await createAppShellStorage().saveTrackingHomeCardDismissed(false);
    await current.assertCurrent();
  } catch (error) {
    if (!refreshOnly) await disableBankSmsForOwner(current.owner);
    throw error;
  }
}

export async function disableBankSms() {
  configurationRevision++;
  const current = await scope();
  await current.assertCurrent();
  await disableBankSmsForOwner(current.owner);
  await current.assertCurrent();
  await createAppShellStorage().saveTrackingHomeCardDismissed(false);
}
