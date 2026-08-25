# Masarifi AI Personal Financial Assistant Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and implement the Masarifi AI Personal Financial Assistant matching the two reference images: a rich landing state with deep teal hero and suggestions, smoothly transitioning into a full conversational chat with inline financial insights and sticky composer.

**Architecture:** A unified `AssistantHomeScreen` coordinating an `AssistantLanding` (Reference 1) and an `AssistantConversation` (Reference 2) state. When user asks a question, state switches smoothly to the conversation view with message bubbles, structured insight cards, contextual follow-ups, and a bottom sticky composer.

**Tech Stack:** React Native, Expo, React Query (`@tanstack/react-query`), TypeScript, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-ai-assistant-redesign-design.md`

## Global Constraints
- Work inside `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Do NOT commit or push.
- Maintain 100% test compatibility with existing `AssistantJourney.test.tsx` and query contracts.
- Respect `usePreferenceStore.hideBalances` for privacy.
- Support full Arabic RTL and English LTR mirroring.

---

### Task 1: Assistant Avatar & Vector Iconography
**Files:**
- Create: `apps/mobile/src/features/assistant/components/AssistantBotAvatar.tsx`
- Test: `apps/mobile/src/features/assistant/components/AssistantBotAvatar.test.tsx`

**Interfaces:**
- Produces: `<AssistantBotAvatar size?: 'sm' | 'md' | 'lg' | 'hero' showPulse?: boolean />`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `AssistantBotAvatar` with stylized SVG bot face, illuminated eyes, and subtle halo ring**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 2: Assistant Landing State (Reference 1)
**Files:**
- Create: `apps/mobile/src/features/assistant/AssistantLanding.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantHero.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantAskCard.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantSuggestedQuestions.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantCapabilityShortcuts.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantConsentCard.tsx`
- Test: `apps/mobile/src/features/assistant/AssistantLanding.test.tsx`

**Interfaces:**
- Produces: `<AssistantLanding onAskQuestion={(question: string) => void} />`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Landing components with deep teal hero, interactive ask card, 2x2 question grid, capability shortcuts, and consent activation**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 3: Active AI Chat State & Message Components (Reference 2)
**Files:**
- Create: `apps/mobile/src/features/assistant/AssistantConversationView.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantHeaderBanner.tsx`
- Create: `apps/mobile/src/features/assistant/components/UserMessageBubble.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantMessageBubble.tsx`
- Create: `apps/mobile/src/features/assistant/components/FinancialInsightCard.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantFollowUpSuggestions.tsx`
- Create: `apps/mobile/src/features/assistant/components/AssistantComposer.tsx`
- Test: `apps/mobile/src/features/assistant/AssistantConversationView.test.tsx`

**Interfaces:**
- Produces: `<AssistantConversationView conversationId={string} initialQuestion?: string onBack={() => void} />`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement conversation view, bubbles, financial insight cards, follow-up chips, and bottom sticky composer**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 4: Integration & Transition in `AssistantHomeScreen.tsx`
**Files:**
- Modify: `apps/mobile/src/features/assistant/AssistantHomeScreen.tsx`
- Modify: `apps/mobile/src/features/assistant/AssistantConversationScreen.tsx`
- Update: `apps/mobile/src/features/assistant/AssistantJourney.test.tsx`

- [ ] **Step 1: Update `AssistantJourney.test.tsx` to assert on seamless transition from Landing to Chat**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Connect `AssistantHomeScreen` to orchestrate Landing -> Chat transition cleanly**
- [ ] **Step 4: Run full test suite and verify 100% pass rate**

---

### Task 5: Verification & Visual Validation
- [ ] **Step 1: Run complete test suite across mobile app**
- [ ] **Step 2: Preview live on Expo Web (`http://localhost:8086/assistant`) in both Arabic RTL and English LTR**
- [ ] **Step 3: Document results in `walkthrough.md`**
