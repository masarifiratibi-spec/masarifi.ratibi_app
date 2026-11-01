MASARIFI — COMPLETE AI/VOICE FIRST, THEN SAFE FINAL INTEGRATION
Continue as the lead engineering chat for the remaining Masarifi AI/Voice work.
The priority now is:
1. Finish and prove the AI/Voice path.
2. Only after the AI candidate is understood and verified, safely integrate all completed worktrees/branches into one final candidate branch.
Do not rush directly into merging everything before completing the remaining AI investigation.
CURRENT STATE — VERIFY BEFORE ACTING
Recover and independently verify the latest repository/evidence state.
Known checkpoints include:
- Gemini 3.5 transport base: 8434640
- AI/Voice hardening code commit: 8da9cfb
- AI continuation worktree/branch: codex/ai-voice-continuation
- latest AI continuation HEAD previously reported around 41170e8
- generic onboarding repair is now deployed as 5113fb7
- onboarding exact-SHA CI is green and its matching APK is installed on Samsung
- historical onboarding commit 08fda46 is superseded by the newer accepted/deployed onboarding lineage; do not integrate an obsolete SHA merely because the earlier merge preview used it
- Staging previously ran 8434640 for the AI/backend candidate, but newer onboarding deployment evidence may supersede the effective Staging application state; verify the current deployed SHA instead of assuming
The recent manual Samsung Voice attempt is not provider evidence:
- M4A upload succeeded
- PROCESS was accepted
- Worker was intentionally stopped
- zero Worker claims/provider attempts
- user cancelled after ~52 seconds
- no OpenRouter/Vertex dispatch
- no proposal/transaction
Therefore do not classify that attempt as Gemini success or failure.
Correlate and reconcile its remaining reservation/audio maintenance state before creating new paid work.
PHASE A — FINISH THE AI/VOICE CANDIDATE
Work in the isolated AI worktree first.
Do not modify the onboarding branch merely to make integration easier.
Review the entire current AI diff from the latest accepted common base and ensure that the intended AI candidate includes all required work from:
8434640
plus:
8da9cfb
plus any later AI-only fixes that are justified by evidence.
Do not reopen physically proven M4A/recorder repairs without contradictory evidence.
AI request contract
The intended primary model remains:
google/gemini-3.5-flash-lite
with exact provider endpoint:
google-vertex/global
Preserve:
- M4A/AAC input
- model-specific omission of unsupported custom temperature
- exact provider pinning
- require_parameters: true where supported
- zdr: true
- data_collection: deny
- no uncontrolled provider fallback
- strict canonical Masarifi Voice validation
- existing token/output limits
- existing price ceilings
- existing $2 budget limits
- credentials
- review-before-financial-mutation
Do not weaken the canonical financial schema merely to obtain HTTP 200.
AI response trust boundary
Preserve and fully verify the new Voice-only fail-closed behavior:
- returned model identity must be present and match the dispatched model
- generation ID must be real/nonblank
- successful completion must have an accepted explicit completion state such as finish_reason = stop
- refusal/truncation/malformed/unknown completion must fail closed
- usage/cost must be accounted for before terminal rejection where applicable
- missing/unknown accounting must not be silently released
- Assistant behavior must remain unaffected
Review whether any other fabricated/defaulted provider evidence can still be mistaken for actual upstream evidence.
Canonical financial correctness
Preserve Masarifi's canonical sign convention and verify the synthetic expectations:
expense = positive minor units
income = negative minor units
Correct stale canary expectations/harness documentation where necessary, but do not alter another active branch behind its owner.
Verify:
- amount
- sign
- currency
- date/timezone
- account alias
- category/reference alias
- supported/unsupported branches
- nullable fields
- forbidden fields
- unsafe values
- malformed JSON
- refusal
- truncation
- wrong model
- missing generation identity
- missing usage/cost
PHASE B — DETERMINE WHETHER GEMINI 3.5 ACTUALLY WORKS
Offline tests alone are not acceptance.
Before provider inference:
1. reconcile the cancelled Samsung session read-only;
2. determine the correct maintenance path for its pending audio object and $0.1316 reservation;
3. do not manually fake/release accounting without the normal governed mechanism;
4. verify there are no eligible stale jobs that would unexpectedly dispatch when Worker resumes;
5. verify current quota/holds;
6. verify current $2 key/global budget;
7. verify current model route;
8. verify prompt approval/version;
9. verify Voice flags;
10. verify current OpenRouter endpoint/ZDR eligibility;
11. verify exact candidate SHA/image to be tested.
Do not run another Samsung recording for provider debugging.
Provider validation
Use one controlled synthetic fictional English M4A first.
It must pass through the real governed Masarifi path:
authenticated admission
→ upload
→ PROCESS
→ Worker
→ OpenRouter
→ google-vertex/global
→ Gemini 3.5 Flash-Lite
→ structured result
→ canonical validation
→ reviewable proposal
No direct ungoverned provider probe.
No financial confirmation.
No automatic application fallback.
No second provider dispatch hidden behind retry behavior.
English PASS requires all of:
- valid M4A accepted
- exactly one Worker claim/provider dispatch
- actual model identity = Gemini 3.5 Flash-Lite
- actual provider endpoint evidence consistent with the approved Vertex route
- ZDR/privacy controls preserved
- provider request accepted
- transcript present
- English correctly recognized
- fictional financial extraction correct
- amount/sign/currency/date/reference resolution correct
- strict canonical parser passes
- reviewable proposal persists
- known bounded usage/cost
- quota/reservation reconciles
- zero financial transaction/balance mutation
If English fully passes, perform exactly one equivalent Arabic synthetic M4A test.
Arabic must satisfy the same gates plus correct Arabic speech understanding.
Stop immediately if either test produces:
- opaque HTTP 400
- wrong model/provider
- privacy mismatch
- unexpected fallback
- malformed schema
- canonical failure
- unknown accounting
- multiple dispatches
- unexpected mutation
If Gemini 3.5 repeats the historical opaque Vertex 400 INVALID_ARGUMENT, stop model switching.
Do not automatically activate Gemini 3.1.
Return to the shared OpenRouter → Vertex request/schema translation boundary and isolate the failing contract using the retained RCA/provider evidence.
PHASE C — DO NOT CONFUSE SYNTHETIC SUCCESS WITH FINAL PRODUCT ACCEPTANCE
If English and Arabic synthetic provider checks succeed, record that as:
PROVIDER/CANONICAL ACCEPTANCE
not final Voice release acceptance.
Samsung physical acceptance remains later and must verify:
- first tap
- recorder starts correctly
- Stop
- Cancel
- Retry
- lifecycle/background behavior
- English
- Arabic
- correct review proposal
- no mutation on Cancel
Explicit financial Confirm/exactly-once acceptance remains a separate governed checkpoint.
PHASE D — THEN BUILD ONE SAFE INTEGRATED BRANCH
Only after the AI candidate is ready for integration, inspect all relevant active worktrees and branches.
Do not blindly merge every branch in the repository.
Build an inventory:
- branch/worktree
- HEAD SHA
- purpose
- whether superseded
- whether already contained in a newer commit
- whether deployed
- whether CI-verified
- files changed
- migrations changed
- whether it contains unique work still needed
In particular, determine the exact final onboarding lineage ending in the deployed 5113fb7.
Do not separately merge 08fda46 if 5113fb7 already contains/supersedes it.
Likewise do not cherry-pick both an AI parent commit and a later AI commit if the latter already contains the former.
The goal is one clean integrated history, not duplicate cherry-picks.
Create a dedicated integration branch/worktree, for example:
codex/final-staging-integration
from the correct common/release base.
Integrate:
final accepted onboarding lineage
-
final AI/Voice lineage
-
only other unique release-critical branches proven necessary.
Do not merge abandoned experiments, superseded diagnostics, temporary test branches or stale release candidates.
PHASE E — SAFE MERGE RULES
Before changing the integration branch, use read-only merge previews / merge-tree analysis.
If there are no textual conflicts, do not assume runtime compatibility.
If there are conflicts:
- inspect both intents
- preserve both valid behaviors
- never resolve by blindly choosing ours/theirs
- rerun focused tests for both sides
Pay special attention to:
- auth/bootstrap
- API startup
- AI gateway
- Worker
- route/config governance
- migrations/checksums
- Mobile auth
- Mobile Voice
- generated/config files
Do not rewrite already-applied migration history.
New migration ordering/checksum state must be verified from a fresh database.
PHASE F — FINAL INTEGRATED VERIFICATION
Once merged, produce one final integrated SHA.
All release evidence after this point must refer to that SHA.
Run the combined required gates, including at minimum:
- Mobile full required suite
- API unit/contract/security suite
- Database integration suite
- migration checksum/inventory verification
- fresh migration application
- identity/new-owner regression
- existing-owner regression
- AI gateway suite
- Voice Worker suite
- canonical Voice parser
- provider attempt/accounting tests
- confirmation/exactly-once regressions
- Admin required gates
- secrets/redaction
- required browser viewport regressions
- build/image publication
Then run fresh exact-SHA CI for the integrated SHA.
Historical green CI from 8434640, 8da9cfb, 5113fb7, or any other parent is useful evidence but does not qualify the integrated SHA.
Verify the immutable image digest produced by that CI.
PHASE G — ONE FINAL STAGING RELEASE
Do not let separate chats deploy over one another.
After the integrated SHA is green:
deploy only the exact integrated immutable artifact to Staging.
Verify:
- deployed SHA
- image digest
- API health
- Worker health
- migrations
- Voice flags
- exact model
- exact provider route
- prompt version
- privacy/ZDR
- budget limits
- quota/holds
- credentials unchanged
- Production unchanged
Build/install an APK from the same integrated source when Mobile changes require it.
Do not reuse an older APK if its source does not match the integrated release.
PHASE H — FINAL ACCEPTANCE
Final acceptance order:
1. Generic onboarding
existing owner opens normally;
new-owner automated regression remains green;
physical first-time signup when a genuinely unused account becomes available.
2. Synthetic Voice
English → Arabic.
3. Samsung Voice
English → Arabic → Cancel/Retry/lifecycle.
4. Financial confirmation
only under separate explicit approval.
SECURITY / SAFETY
Throughout this work:
- Production remains untouched.
- Do not rotate credentials.
- Do not increase budgets.
- Do not weaken ZDR/no-training.
- Do not broaden provider routing.
- Do not expose audio/transcripts/prompts/credentials in unrestricted logs.
- Do not bypass owner/RBAC controls.
- Do not manually fabricate financial state to make tests pass.
- Do not Confirm a financial transaction without explicit authorization.
REPORTING
Keep a single integration ledger as you work.
At every major checkpoint report:
AI status
Onboarding status
Integrated SHA
CI status
Staging SHA
Provider acceptance
Samsung acceptance
Remaining blockers
Never call the project READY based only on parent-branch tests.
READY requires evidence from the final integrated candidate.
Start now with Phase A: finish/review the AI candidate.
Do not merge all branches yet.
Once the AI track reaches its safe integration boundary, proceed to the integration inventory and build the single final candidate