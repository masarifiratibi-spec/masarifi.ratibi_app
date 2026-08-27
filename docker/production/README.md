# Production Container Contract

Build one immutable image from `docker/backend.Dockerfile`, scan it, sign its
digest, and deploy that same digest for migration, API, and worker commands.
Migration runs pre-traffic and must succeed before the API rollout starts.
The migration command applies checksum-verified SQL directly through `pg`;
Supabase CLI remains a development/CI dependency and is excluded from runtime.

- Run as UID/GID `65532`, with a read-only root filesystem.
- Mount only a bounded writable `/tmp`; inject secrets at runtime from the
  deployment secret store, never through build arguments or image layers.
- Expose port 3000 only for the API. Worker and migration have no port/service.
- Use `/health/live` for container liveness and internal `/health/ready` for
  traffic readiness. Do not expose readiness publicly.
- Send `SIGTERM`, stop traffic/claims, and allow at most 30 seconds before kill.
- Set explicit CPU/memory requests and limits from measured load-test evidence.
- Retain the previous signed image digest for rollback. Schema changes remain
  additive and N-1 compatible.

Release is blocked when the image runs as root, has a writable root filesystem,
contains development dependencies/source maps/secrets/shell/package manager, or
has an exploitable Critical/High vulnerability.
