import { LedgerRepository } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import { PlatformConfigService } from '../platform/config/platform-config.service';
import { PoolService } from '../platform/database/pool.service';
import { ReferenceRepository } from '../reference/reference.repository';
import { ReferenceService } from '../reference/reference.service';
import { SecurityRepository } from '../security/security.repository';
import { ClaimedMutationExecutor } from './claimed-mutation.executor';
import { SyncHandlers } from './sync.handlers';
import { SyncRepository, toClaimedMutation, type ClaimedMutationRow } from './sync.repository';

function assertConfiguration(config: PlatformConfigService): void {
  const positive = [
    'MASARIFI_DATABASE_POOL_MAX',
    'MASARIFI_SYNC_RETRY_BASE_SECONDS',
    'MASARIFI_SYNC_RETRY_MAX_SECONDS',
    'MASARIFI_SYNC_MAX_ATTEMPTS',
    'MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS',
  ] as const;
  const jitter = config.getRequired('MASARIFI_SYNC_RETRY_JITTER_MS');
  if (
    positive.some(
      (key) => !Number.isSafeInteger(config.getRequired(key)) || config.getRequired(key) < 1,
    ) ||
    config.getRequired('MASARIFI_DATABASE_POOL_MAX') > 50 ||
    !Number.isSafeInteger(jitter) ||
    jitter < 0 ||
    config.getRequired('MASARIFI_PROCESS_KIND') !== 'worker' ||
    !config.getRequired('DATABASE_URL') ||
    config.getRequired('MASARIFI_SYNC_RETRY_MAX_SECONDS') <
      config.getRequired('MASARIFI_SYNC_RETRY_BASE_SECONDS')
  )
    throw new Error('EXACT_EXECUTOR_CONFIG_UNVERIFIED');
}

/** Called only by a separately reviewed access adapter after approval and image verification. */
export async function prepareClaimedMutationRuntime(
  workerConfig: PlatformConfigService,
  apiConfig: PlatformConfigService | undefined,
  workerId: string,
  verifiedImageSha256: string,
) {
  assertConfiguration(workerConfig);
  if (
    apiConfig?.getRequired('MASARIFI_PROCESS_KIND') !== 'api' ||
    !Number.isSafeInteger(apiConfig.getRequired('MASARIFI_DATABASE_POOL_MAX')) ||
    apiConfig.getRequired('MASARIFI_DATABASE_POOL_MAX') < 1 ||
    apiConfig.getRequired('MASARIFI_DATABASE_POOL_MAX') > 50 ||
    !Number.isSafeInteger(apiConfig.getRequired('MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS')) ||
    apiConfig.getRequired('MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS') < 1 ||
    !apiConfig.getRequired('DATABASE_URL') ||
    apiConfig.getRequired('DATABASE_URL') === workerConfig.getRequired('DATABASE_URL')
  )
    throw new Error('EXACT_EXECUTOR_API_CONFIG_UNVERIFIED');
  if (!/^[a-f0-9]{64}$/.test(verifiedImageSha256))
    throw new Error('EXACT_EXECUTOR_IMAGE_UNVERIFIED');
  let workerPool: PoolService | undefined;
  let apiCommandPool: PoolService | undefined;
  const close = async () => {
    const results = await Promise.allSettled(
      [workerPool, apiCommandPool]
        .filter((pool) => pool !== undefined)
        .map((pool) => pool.onModuleDestroy()),
    );
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('EXACT_EXECUTOR_CLOSE_FAILED');
  };
  try {
    workerPool = new PoolService(workerConfig);
    apiCommandPool = new PoolService(apiConfig);
    const ledger = new LedgerService(
      new LedgerRepository(apiCommandPool, apiConfig),
      new SecurityRepository(apiCommandPool),
      apiConfig,
    );
    const reference = new ReferenceService(new ReferenceRepository(apiCommandPool), ledger);
    const queueRepository = new SyncRepository(workerPool);
    const apiRepository = new SyncRepository(apiCommandPool);
    const executor = new ClaimedMutationExecutor(
      {
        workerComplete: queueRepository.workerComplete.bind(queueRepository),
        retryMutation: queueRepository.retryMutation.bind(queueRepository),
        createConflict: queueRepository.createConflict.bind(queueRepository),
        conflictTarget: apiRepository.conflictTarget.bind(apiRepository),
      },
      new SyncHandlers(reference, ledger),
      workerConfig,
      workerId,
    );
    return {
      normalPool: workerPool,
      apiCommandPool,
      imageSha256: verifiedImageSha256,
      executeClaim: (row: ClaimedMutationRow) => executor.process(toClaimedMutation(row)),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
