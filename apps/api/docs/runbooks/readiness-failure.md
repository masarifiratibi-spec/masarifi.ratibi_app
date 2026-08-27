# Readiness Failure

Readiness is internal only. Alert when `not_ready` lasts two minutes in one
instance (warning) or one minute across 25% of instances (critical). Platform
Operations owns the alert; the incident commander escalates database or queue
failures to the managed Supabase owner.

1. Confirm liveness remains `ok` and inspect bounded dependency states.
2. Check database connection latency, pool saturation, and the logged
   `platform-events` queue presence without exposing connection details.
3. Remove unhealthy instances from traffic. Do not make readiness public and
   do not bypass it with a feature flag.
4. Restore the dependency or roll back to the previous immutable image.
5. Close only after readiness is stable for ten minutes and related latency is
   within budget.
