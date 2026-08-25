# R01 Single-Worktree Consolidation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep one Git worktree at `D:\MY Work\0Part_Time\MASREFY _Final`, checked out on `codex/r01-shared-ui-foundation`, while preserving all R01 mobile work and every pre-consolidation local file in recoverable safety snapshots.

**Architecture:** Commit and verify the authoritative mobile state in the linked R01 worktree first. Preserve the old root's dirty state in a named stash, remove the linked worktree only after it is clean and pushed, then switch the root worktree to the R01 branch. `apps/admin-web` remains unchanged because it is clean and byte-identical between the two current branch tips.

**Tech Stack:** Git worktrees, Git branches/stashes, Expo/React Native, TypeScript, Jest, ESLint, Next.js, Vitest.

**Spec:** `apps/mobile/specs/012-shared-ui-foundation/spec.md`; RTL/LTR evidence: `apps/mobile/docs/rtl-ltr-audit-2026-08-24.md`.

## Global Constraints

- Keep exactly one final worktree: `D:\MY Work\0Part_Time\MASREFY _Final`.
- The final branch is `codex/r01-shared-ui-foundation`; the final root must contain the complete verified R01 mobile state.
- Do not change `apps/admin-web`; verify it before and after consolidation.
- Do not use `git reset --hard`, `git clean`, forced checkout, forced worktree removal, or branch deletion.
- Do not remove the linked R01 worktree until its mobile changes are committed, the branch is pushed, its residual files are stashed, and `git status` is clean.
- Do not drop either safety stash or delete `codex-mobile-foundation-validation`; they remain recovery points.
- Stop on any failed verification, failed stash check, unexpected branch movement, or refused worktree removal.

## Current Evidence

- Root worktree: `D:\MY Work\0Part_Time\MASREFY _Final`, branch `codex-mobile-foundation-validation`, HEAD `1b7fe739f41f8c853af2116d7533f06de1bff6b0` before execution.
- Linked worktree: `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`, branch `codex/r01-shared-ui-foundation`, HEAD `cebf3b5f1f627b4ac968a13c07cd79e02547d48b` before committing current work.
- The linked worktree contains the authoritative mobile/RTL remediation: 171 tracked changes and 23 untracked paths at the last inventory.
- The root worktree contains 12 tracked changes and 458 untracked paths at the last inventory; these must be preserved, not reapplied automatically over R01.
- `apps/admin-web` is clean in both worktrees and has no branch-tip diff.
- The root branch has one commit absent from R01: `1b7fe73 docs: design canonical category picker`; preserve it by cherry-picking it onto R01.

---

### Task 1: Freeze and Verify the Starting State

**Files:**
- Read only: Git metadata and both worktrees.
- Modify: none.

- [ ] **Step 1: Record worktree, branch, and commit identity**

Run from the root worktree:

```powershell
git worktree list --porcelain
git rev-parse HEAD
git -C ".worktrees/r01-shared-ui-foundation" rev-parse HEAD
git branch --show-current
git -C ".worktrees/r01-shared-ui-foundation" branch --show-current
```

Expected: the root is on `codex-mobile-foundation-validation`; the linked worktree is on `codex/r01-shared-ui-foundation`.

- [ ] **Step 2: Record every dirty path before mutation**

Run `git status --short --branch --untracked-files=all` separately in both worktrees and retain both outputs in the task transcript.

- [ ] **Step 3: Reconfirm Admin Web equality**

Run:

```powershell
git diff --exit-code codex-mobile-foundation-validation..codex/r01-shared-ui-foundation -- apps/admin-web
```

Expected: exit code 0 and no diff. Stop if Admin Web differs.

### Task 2: Create and Verify the R01 Safety Snapshot

**Files:**
- Preserve: every tracked and untracked path in the linked R01 worktree.
- Modify: shared Git stash metadata; restore the same worktree content immediately.

- [ ] **Step 1: Save the named R01 snapshot**

From the linked worktree run:

```powershell
git stash push --include-untracked -m "safety:r01-before-single-worktree-2026-08-25"
```

- [ ] **Step 2: Verify and restore the snapshot without dropping it**

Run:

```powershell
git stash list
git stash show --stat "stash@{0}"
git stash apply --index "stash@{0}"
git status --short --branch --untracked-files=all
```

Expected: the named snapshot exists and the original R01 dirty state is restored. Do not continue if the snapshot is incomplete.

### Task 3: Verify and Commit the Complete Mobile State

**Files:**
- Stage and commit: `apps/mobile/**` only.
- Leave unstaged initially: root-level `.device-smoke/**`.

- [ ] **Step 1: Run the full mobile baseline**

From `apps/mobile` in the linked worktree run:

```powershell
.\node_modules\.bin\jest.cmd --runInBand
npm run typecheck
npm run lint
npm run check:frontend-quality
```

Expected: Jest, typecheck, and frontend-quality pass; lint has zero errors and no increase from the recorded 76 warnings. Stop on regression.

- [ ] **Step 2: Stage only the mobile project**

From the linked worktree root run:

```powershell
git add -A -- apps/mobile
git diff --cached --check
git diff --cached --name-status
```

Expected: every staged path starts with `apps/mobile/`; whitespace check passes.

- [ ] **Step 3: Commit the mobile state**

Run:

```powershell
git commit -m "feat(mobile): preserve r01 remediation and rtl audit"
```

- [ ] **Step 4: Preserve the root branch's unique documentation commit**

Run:

```powershell
git cherry-pick 1b7fe739f41f8c853af2116d7533f06de1bff6b0
```

Expected: only `docs/superpowers/specs/2026-08-18-category-picker-design.md` is added. Stop on conflict.

- [ ] **Step 5: Re-run the mobile baseline at the committed SHA**

Repeat the four commands from Step 1. Expected: the same green result.

### Task 4: Verify Admin Web Without Changing It

**Files:**
- Read/test: `apps/admin-web/**`.
- Modify: only ignored build/test caches.

- [ ] **Step 1: Run Admin Web checks in the linked worktree**

From `apps/admin-web` run:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands pass and `git status --short -- apps/admin-web` remains empty. Stop if a command fails or tracked output appears.

### Task 5: Push R01 and Clean Its Residual Worktree Files Safely

**Files:**
- Push: `codex/r01-shared-ui-foundation`.
- Preserve in stash: any remaining linked-worktree files outside the committed mobile scope.

- [ ] **Step 1: Push the verified branch**

From the linked worktree run:

```powershell
git push -u origin codex/r01-shared-ui-foundation
```

Expected: the remote branch points to the verified local SHA. Stop on rejection; never force-push.

- [ ] **Step 2: Stash residual uncommitted files**

Run:

```powershell
git stash push --include-untracked -m "safety:r01-residual-before-worktree-removal-2026-08-25"
git status --short --branch --untracked-files=all
git stash list
```

Expected: the linked worktree is completely clean and both R01 safety stashes are listed.

### Task 6: Preserve the Old Root Before Repointing It

**Files:**
- Preserve: all tracked and untracked paths in `D:\MY Work\0Part_Time\MASREFY _Final`.
- Modify: shared Git stash metadata only.

- [ ] **Step 1: Save the named root snapshot**

From the root worktree run:

```powershell
git stash push --include-untracked -m "safety:old-root-before-single-worktree-2026-08-25"
```

- [ ] **Step 2: Verify the snapshot and clean root state**

Run:

```powershell
git stash list
git stash show --stat "stash@{0}"
git status --short --branch --untracked-files=all
```

Expected: the named root snapshot is the newest stash and the root worktree is clean. Do not reapply it automatically because its mobile paths overlap R01.

### Task 7: Remove the Linked Worktree and Keep the Root Only

**Files:**
- Remove after all gates: `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Keep: root worktree and both branches.

- [ ] **Step 1: Remove the now-clean linked worktree without force**

From the root worktree run:

```powershell
git worktree remove ".worktrees/r01-shared-ui-foundation"
git worktree prune
```

Expected: normal removal succeeds. If Git refuses, stop and report remaining files; do not add `--force`.

- [ ] **Step 2: Switch the root worktree to the preserved R01 branch**

Run:

```powershell
git switch codex/r01-shared-ui-foundation
git branch --show-current
git rev-parse HEAD
git worktree list --porcelain
```

Expected: the root path is the only worktree and is on `codex/r01-shared-ui-foundation` at the pushed SHA.

### Task 8: Verify the Final Single Worktree

**Files:**
- Test: `apps/mobile/**` and `apps/admin-web/**` from the root worktree.
- Modify: only ignored test/build caches.

- [ ] **Step 1: Run the final mobile gate**

From root `apps/mobile` run:

```powershell
.\node_modules\.bin\jest.cmd --runInBand
npm run typecheck
npm run lint
npm run check:frontend-quality
```

- [ ] **Step 2: Run the final Admin Web gate**

From root `apps/admin-web` run:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: both projects match their pre-removal results.

- [ ] **Step 3: Record final recovery and branch evidence**

From the root run:

```powershell
git status --short --branch --untracked-files=all
git worktree list --porcelain
git log --oneline --decorate -8
git stash list
```

Expected: one clean worktree, branch `codex/r01-shared-ui-foundation`, pushed verified commits, the old branch still present, and all named safety stashes retained.

- [ ] **Step 4: Report completion evidence**

Report the final SHA, remote push result, exact mobile and Admin Web test totals, the single remaining worktree path, and every retained safety stash. Do not delete the old branch or any stash.
