# VPS migration implementation and evidence

The database and private-file cutover completed on 13 November 2026. PostgreSQL and private storage on the VPS are authoritative. Read `docs/handoffs/2026-11-13-supabase-vps-final-handoff-ar.md` and `docs/operations/selfhost-runbook.md` for the current operating state.

Migration/rehearsal/provisioning scripts in this directory are historical, state-bound procedures. They depend on restricted server-side inputs that are intentionally absent from Git. A completed target that has accepted writes must be repaired forward. Do not replay cutover/complete or restore frozen Supabase consumers from these files.

The storage service, runtime adapters, diagnostics and their tests record the implemented target behavior. Local mocked tests, without server access:

```text
node --test ops/selfhost/runtime-adapter.test.cjs ops/selfhost/runtime-job-logging.test.cjs ops/selfhost/storage/service.test.mjs
python -B -m unittest discover -s ops/selfhost -p test_*.py
```

Actual acceptance evidence is identified in the operational handoff; local tests do not replace live acceptance. Backup work is deferred by the user's 14 November instruction. The next application acceptance task is `docs/handoffs/2026-11-14-post-migration-application-handoff-ar.md`.
