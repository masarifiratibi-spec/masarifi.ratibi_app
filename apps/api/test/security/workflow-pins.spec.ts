import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

describe('backend workflow action pins', () => {
  const workflowPath = resolve(__dirname, '../../../../.github/workflows/backend-foundation.yml');

  it('pins every action to a full commit SHA', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const uses = workflow
      .split('\n')
      .filter((line) => line.includes('uses:'))
      .map((line) => /@([a-f0-9]+)\s*$/.exec(line)?.[1] ?? '');

    expect(uses.length).toBeGreaterThan(0);
    for (const reference of uses) expect(reference).toMatch(/^[a-f0-9]{40}$/);
  });

  it('grants the secret scanner read-only pull-request metadata access', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toMatch(/permissions:\r?\n {2}contents: read\r?\n {2}pull-requests: read/);
  });

  it('blocks the image on database migrations and measured outbox budgets', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    for (const command of [
      'npm run supabase:start',
      'npm run db:reset',
      'npm run db:lint',
      'npm run test:db',
      'npm run start:migration',
      'npm run test:migration',
      'npm run test:database:integration',
      'npm run test:foundation:e2e',
      'npm run test:ledger:integration',
      'npm run test:ledger:security',
      'npm run test:ledger:recovery',
      'npm run test:sync:logic',
      'npm run test:sync:integration',
      'npm run test:sync:security',
      'npm run test:sync:recovery',
      'npm run test:planning:logic',
      'npm run test:planning:integration',
      'npm run test:planning:security',
      'npm run test:planning:recovery',
      'npm run test:reports:integration',
      'npm run test:reports:security',
      'npm run test:reports:recovery',
      'npm run test:performance:reports',
      'npm run test:stress:reports',
      'npm run test:performance:planning',
      'npm run test:performance:sync',
      'npm run test:performance:ledger',
      'npm run test:performance:platform',
      'npm run test:performance:ai',
      'npm run test:stress:ai',
      'npm run perf:seed:outbox',
      'npm run perf:explain:outbox',
      'npm run test:outbox:performance',
      'npm run test:stress',
    ]) {
      expect(workflow).toContain(command);
    }
    const lines = workflow.split(/\r?\n/);
    const loadIndex = lines.findIndex(
      (line) => line.trim() === 'run: npm run test:outbox:performance',
    );
    const stressIndex = lines.findIndex((line) => line.trim() === 'run: npm run test:stress');
    const stressSeedIndex = lines.findIndex(
      (line, index) => index > loadIndex && line.trim() === 'run: npm run perf:seed:outbox',
    );
    expect(stressSeedIndex).toBeGreaterThan(loadIndex);
    expect(stressSeedIndex).toBeLessThan(stressIndex);
    expect(workflow).toContain('K6_AUTO_EXTENSION_RESOLUTION: "false"');
    expect(workflow).toContain("import sql from 'k6/x/sql';");
    expect(workflow).toContain("import postgres from 'k6/x/sql/driver/postgres';");
    expect(workflow).toContain(
      'K6_AUTO_EXTENSION_RESOLUTION=false "$binary" inspect /tmp/outbox-extension-check.js',
    );
    const parsed = load(workflow) as { jobs: { image: { needs: string[] } } };
    expect(parsed.jobs.image.needs).toEqual([
      'secrets', 'sentinel-redaction', 'application', 'mobile', 'android-build', 'admin', 'admin-e2e', 'database',
    ]);
    expect(workflow).toContain('working-directory: apps/mobile');
    expect(workflow).toContain('npx jest --forceExit');
    expect(workflow).not.toMatch(/supabase\/tests\/.*(?:migration|db push)/i);
  });

  it('generates and verifies immutable release provenance and SBOM evidence', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain(
      'actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53',
    );
    expect(workflow).not.toContain('actions/attest@');
    expect(workflow.match(/cosign attest-blob/g)).toHaveLength(2);
    expect(workflow.match(/cosign verify-blob-attestation/g)).toHaveLength(2);
    expect(workflow).toContain('cosign verify-blob');
    expect(workflow).toContain(
      'sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6',
    );
    expect(workflow).toContain('cosign-release: v3.0.6');
    expect(workflow).not.toContain('attestations: write');
    expect(workflow).not.toContain('artifact-metadata: write');
  });
});

describe('isolated consolidation candidate verification policy', () => {
  type Step = { name?: string; run?: string; if?: string; env?: Record<string, string> };
  type Job = { needs?: string | string[]; env?: Record<string, string>; steps: Step[] };
  function requireJob(jobs: Record<string, Job>, name: string): Job {
    const job = jobs[name];
    if (!job) throw new Error(`Missing workflow job: ${name}`);
    return job;
  }
  function policy() {
    return load(readFileSync(resolve(__dirname, '../../../../.github/workflows/backend-foundation.yml'), 'utf8')) as {
      on: { push: { branches: string[] } };
      jobs: Record<string, Job>;
    };
  }

  it('runs the full candidate push gates without publishing or deploying', () => {
    const workflow = policy();
    expect(workflow.on.push.branches).toEqual(['main', 'codex/masarifi-complete-integration-2026-10-10']);
    const publication = requireJob(workflow.jobs, 'image').steps.filter(step => step.run?.includes('docker push '));
    expect(publication).toHaveLength(1);
    expect(publication[0]?.if).toBe("github.event_name == 'workflow_dispatch'");
    expect(requireJob(workflow.jobs, 'image').steps.find(step => step.name === 'Record local image evidence')?.if).toBe("github.event_name != 'workflow_dispatch'");
    const allCommands = Object.values(workflow.jobs).flatMap(job => job.steps).map(step => step.run ?? '').join('\n');
    expect(allCommands).not.toMatch(/\b(?:ssh|scp)\s|\beas\s+(?:build|update|submit)\b/);
  });

  it('verifies committed ledger and Savings history through main-schema upgrades before fresh reset', () => {
    const database = requireJob(policy().jobs, 'database');
    expect(database.env).toMatchObject({ NODE_ENV: 'test', CROSS_FEATURE_DISPOSABLE_DATABASE_NAME: 'postgres' });
    expect(database.env?.DATABASE_URL).toContain('@127.0.0.1:54322/postgres');
    const steps = database.steps.map(step => step.run ?? '');
    const baseline = steps.findIndex(command => command.includes('db reset --local --version 20260922220434 --no-seed'));
    const seed = steps.findIndex((command, index) => index > baseline && command.includes('main-upgrade-fixture.cjs seed'));
    const upgrade = steps.findIndex((command, index) => index > seed && command.includes('npm run start:migration'));
    const upgradedIntegration = steps.findIndex(command => command.includes('masarifi-upgrade-integration.json'));
    const fresh = steps.findIndex(command => command === 'npm run db:reset');
    expect(baseline).toBeGreaterThan(-1);
    expect(steps.slice(0, baseline).join('\n')).toContain('verify-migration-baselines.cjs');
    expect(steps.slice(0, baseline).join('\n')).toContain('db reset --local --version 20260915150000 --no-seed');
    expect(steps.slice(0, baseline).join('\n')).toContain('main-upgrade-fixture.cjs verify "$RUNNER_TEMP/masarifi-local-main-upgrade.json"');
    expect(seed).toBeGreaterThan(baseline);
    expect(upgrade).toBeGreaterThan(seed);
    expect(steps.slice(seed + 1, upgrade)).toContain('npm run build');
    expect(database.steps[upgrade]?.env?.MASARIFI_PROCESS_KIND).toBe('migration');
    expect(steps[upgrade]).toContain('main-upgrade-fixture.cjs verify');
    expect(upgradedIntegration).toBeGreaterThan(upgrade);
    expect(fresh).toBeGreaterThan(upgradedIntegration);
    expect(steps.slice(fresh)).toContain('npm run security:workflow-pins');
    for (const command of ['npm run test:performance:tracking', 'npm run test:stress:tracking']) {
      const step = database.steps.find(entry => entry.run === command);
      expect(step).toBeDefined();
      expect(step?.if).toBe("github.event_name != 'workflow_dispatch' || inputs.run_k6");
    }
  });

  it('blocks the candidate image on compiled arm64 Android identity evidence', () => {
    const workflow = policy();
    expect(requireJob(workflow.jobs, 'image').needs).toContain('android-build');
    const android = requireJob(workflow.jobs, 'android-build');
    expect(android.needs).toBe('mobile');
    expect(android.env?.EXPO_PUBLIC_API_URL).toBe('https://api.example.invalid');
    const commands = android.steps.map(step => step.run ?? '').join('\n');
    expect(commands).toContain('verify-android-identity.cjs');
    expect(commands).toContain(':app:assembleRelease');
    expect(commands).toContain('-PreactNativeArchitectures=arm64-v8a');
    expect(commands).toContain("package: name='com.masarifi.mobile'");
    expect(commands).toContain("application-label:'Masarifi.Ratibi'");
    expect(commands).toContain('sha256sum "$apk"');
    expect(commands).toContain('"$GITHUB_SHA"');
  });
});
