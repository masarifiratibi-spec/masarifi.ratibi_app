# R02 Create Account Evidence

Date: 2026-08-15

Implemented:

- Create mode keeps the existing command, schema, `/accounts` completion, default flag, currency input, opening balance input, and seven existing account types.
- Added component-local dirty draft confirmation with keep-editing/discard actions.
- Added required-name and invalid-balance field error mapping, saving guard, duplicate-submit guard, and retained input after local errors.

Verification:

- Included in focused R02 Jest command recorded in `shared-foundation.md`: PASS.
- Included in quickstart Jest command recorded in `shared-foundation.md`: PASS.

Open:

- Full visual recomposition of the type selector remains conservative; Android create journey was not completed because route/deep-link navigation stayed on the existing account stack during validation.
