# Assistant with grounded personal finance data

Approved by the user in chat on 16 October 2026 (Riyadh), following the assistant review and plan.

The DEV assistant must use the model to understand natural Arabic/Egyptian/English questions and compose answers from authenticated owner data. It must distinguish latest transaction, transaction count, largest individual expense, category rankings, and multiple questions. The model may request bounded read-only tools covering all financial domains and historical ranges; pagination and missing data must be explicit. No fixed successful financial answers replace model reasoning.

Keep exact integer minor amounts, currency separation, owner-local dates, confirmed/pending distinctions, and existing preview confirmation/version/idempotency protections. Use fact references for amounts/dates rather than allowing free invented numeric claims. Retain bounded conversation continuity and refresh current balances from the database.

Scope is the existing worktree and branch. Deploy only new DEV/Staging assistant API/worker, authenticated configured owner, and DEV variant routing. Existing ordinary application, Production, all existing containers and Voice epoch/policy/runtime must be preserved. A model is given relevant authenticated data and paginated access; no claim that a truncated list contains all records. Never send auth secrets, identifiers, recordings or SMS bodies to the model or evidence reports.

Acceptance includes the user's two reported cases, Egyptian date terms, compound questions, context follow-ups, real-data model smoke tests, no financial effects from read questions, and unchanged Voice posting. Evaluate model quality separately from infrastructure tests. Measure authentication, API, queue, provider and display time separately; performance goals from the review remain targets until measured.
