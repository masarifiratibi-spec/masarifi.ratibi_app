import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'));
const expected = {
  api: { command: 'dist/src/main.js', kind: 'api', healthcheckDisabled: false },
  worker: { command: 'dist/src/worker.js', kind: 'worker', healthcheckDisabled: true },
  migration: {
    command: 'dist/src/migration.js',
    kind: 'migration',
    healthcheckDisabled: true,
  },
};
const images = new Set();

for (const [name, contract] of Object.entries(expected)) {
  const service = config.services?.[name];
  if (!service) throw new Error(`Missing service: ${name}`);
  if (!/^[^\s@:]+(?:\/[^\s@:]+)+@sha256:[a-f0-9]{64}$/.test(service.image)) {
    throw new Error(`${name} must use an immutable sha256 image digest`);
  }
  images.add(service.image);
  if (service.command?.length !== 1 || service.command[0] !== contract.command) {
    throw new Error(`Unexpected ${name} command`);
  }
  if (service.environment?.MASARIFI_PROCESS_KIND !== contract.kind) {
    throw new Error(`Unexpected ${name} process kind`);
  }
  if (service.environment?.COMPOSE_SENTINEL !== name) {
    throw new Error(`${name} must use its own environment file`);
  }
  if (
    service.user !== '65532:65532' ||
    service.read_only !== true ||
    !service.cap_drop?.includes('ALL') ||
    !service.security_opt?.includes('no-new-privileges:true')
  ) {
    throw new Error(`Unsafe ${name} container contract`);
  }
  if (Boolean(service.healthcheck?.disable) !== contract.healthcheckDisabled) {
    throw new Error(`Unexpected ${name} healthcheck contract`);
  }
}

if (images.size !== 1) throw new Error('All backend processes must use one image digest');

const apiPort = config.services.api.ports?.[0];
if (
  config.services.api.ports?.length !== 1 ||
  apiPort.host_ip !== '127.0.0.1' ||
  apiPort.target !== 3000
) {
  throw new Error('API must publish only port 3000 on loopback');
}
if (config.services.worker.ports || config.services.migration.ports) {
  throw new Error('Worker and migration must not publish ports');
}

const clamav = config.services.clamav;
if (!clamav) throw new Error('Missing service: clamav');
const clamavCaps = ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'KILL', 'SETGID', 'SETUID'];
if (
  clamav.image !==
  'clamav/clamav@sha256:e8388295191bff0893fb889d9415ae975491201c989b205e30c9057b1985d36a'
) {
  throw new Error('ClamAV must use the reviewed immutable image digest');
}
if (
  clamav.ports ||
  !Object.hasOwn(clamav.networks ?? {}, 'backend') ||
  !clamav.cap_drop?.includes('ALL') ||
  !clamavCaps.every((capability) => clamav.cap_add?.includes(capability)) ||
  !clamav.security_opt?.includes('no-new-privileges:true') ||
  clamav.pids_limit !== 256 ||
  clamav.mem_limit !== '1073741824' ||
  !clamav.volumes?.some((volume) => volume.target === '/var/lib/clamav')
) {
  throw new Error('Unsafe ClamAV container contract');
}
if (config.services.worker.depends_on?.clamav?.condition !== 'service_healthy') {
  throw new Error('Worker must wait for the private scanner');
}
if (
  config.services.worker.environment?.MASARIFI_CLAMAV_HOST !== 'clamav' ||
  config.services.worker.environment?.MASARIFI_CLAMAV_PORT !== '3310'
) {
  throw new Error('Worker must use the private scanner endpoint');
}
if (config.networks?.backend?.internal === true) {
  throw new Error('Backend network must retain required provider egress');
}

const nginx = readFileSync(new URL('./nginx.conf', import.meta.url), 'utf8');
if (
  !nginx.includes('server_name api.staging.masarifiratibi.com;') ||
  !nginx.includes('location = /health/ready') ||
  !nginx.includes('proxy_pass http://127.0.0.1:3000;') ||
  !nginx.includes('server_name staging.masarifiratibi.com;') ||
  !nginx.includes('proxy_pass http://127.0.0.1:3001;')
) {
  throw new Error('Unexpected staging reverse-proxy contract');
}

const adminService = readFileSync(
  new URL('./masarifi-admin.service', import.meta.url),
  'utf8',
);
for (const requirement of [
  'User=masarifi',
  'EnvironmentFile=/etc/masarifi/admin.env',
  '127.0.0.1 --port 3001',
  'NoNewPrivileges=true',
]) {
  if (!adminService.includes(requirement)) {
    throw new Error(`Admin service is missing: ${requirement}`);
  }
}

console.log('staging compose contract verified');
