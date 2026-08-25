# Specification: Masarifi AI Personal Financial Assistant Redesign

## 1. Overview & Objective
Redesign the Masarifi AI Personal Financial Assistant in `apps/mobile` to deliver a cohesive experience based on two primary visual references:
1. **Assistant Landing / Empty State (Reference 1)**: A deep teal AI hero, stylized bot avatar with orbit badges, question prompt card, suggested questions grid, capability shortcuts, and consent activation.
2. **Active AI Chat State (Reference 2)**: A modern conversational interface featuring user & AI message bubbles, inline financial insight cards, contextual follow-ups, and a persistent keyboard-aware bottom composer.

Once the user asks the first question, the landing UI transitions directly into active conversation without changing navigation or forcing unrelated sub-screens.

---

## 2. Architecture & Component Decomposition

```text
apps/mobile/src/features/assistant/
├── AssistantHomeScreen.tsx                // Root container coordinating Landing vs. Chat states
├── AssistantLanding.tsx                   // Landing UI (Reference 1)
│   ├── AssistantHero.tsx                  // Deep teal hero with stylized bot avatar & orbit badges
│   ├── AssistantAskCard.tsx               // "اطلب من المساعد" composer input entry
│   ├── AssistantSuggestedQuestions.tsx    // 2x2 grid of prompt suggestions
│   ├── AssistantCapabilityShortcuts.tsx   // 4 capability cards
│   └── AssistantConsentCard.tsx           // Consent explanation and activation CTA
├── AssistantConversation.tsx              // Chat UI (Reference 2)
│   ├── AssistantHeaderBanner.tsx          // Compact mini-bot header banner with security badge
│   ├── AssistantMessageList.tsx           // Chat message bubbles & typing indicator
│   │   ├── UserMessageBubble.tsx          // Mint-tinted bubble with timestamp & checkmarks
│   │   ├── AssistantMessageBubble.tsx     // AI bubble with bot avatar & markdown/text
│   │   └── FinancialInsightCard.tsx       // Structured spending summary & action button
│   ├── AssistantFollowUpSuggestions.tsx   // Horizontal follow-up prompt chips
│   └── AssistantComposer.tsx              // Sticky bottom input + send button + sparkle
├── components/
│   └── AssistantBotAvatar.tsx             // Reusable stylized SVG/Vector bot avatar (hero & mini sizes)
└── assistant-types.ts                     // Visual state and component contracts
```

---

## 3. Detailed Specifications

### 3.1 Assistant Landing (Reference 1)
- **Header**: Standard application header with title `المساعد الذكي` (`AI Assistant`) and back navigation.
- **Deep Teal AI Hero (`AssistantHero`)**:
  - Background: Gradient from `#103F37` to `#1D7464` with soft radial ambient glow.
  - Avatar: Circular stylized vector bot avatar with illuminated eyes and halo ring.
  - Orbit Badges: 4 floating circular icons (`trendUp`, `lightbulb`, `chat`, `wallet`) positioned around the halo.
  - Typography: Title in bold white (`#FFFFFF`), subtitle in mint-white (`#DDF8EF`).
- **Main Ask Card (`AssistantAskCard`)**:
  - Surface: Rounded white card (`#FFFFFF`, `radius: 22px`).
  - Title: `اطلب من المساعد` / `Ask the Assistant`.
  - Subtitle: `يمكنك طرح أي سؤال عن مصروفاتك وميزانيتك.` / `You can ask anything about your spending and budget.`
  - Entry Input: Rounded search-like field (`radius: 18px`, `#F1F5F3` / `#EEF6F4`) with placeholder `اكتب سؤالك هنا...` and sparkle send icon.
- **Suggested Questions Grid (`AssistantSuggestedQuestions`)**:
  - 2x2 cards with category-themed icons:
    - `كم أنفقت هذا الشهر؟` (Restaurant/Food icon)
    - `ما هي أكبر مصروفاتي؟` (Trending up icon)
    - `ملخص مصروفاتي الأسبوعية` (Calendar icon)
    - `هل تجاوزت ميزانيتي؟` (Gauge / Timer icon)
  - Tapping any suggestion submits it immediately through the assistant pipeline.
- **Capability Shortcuts (`AssistantCapabilityShortcuts`)**:
  - 4 quick cards with icons:
    - `تقارير مخصصة لأموالك`
    - `تحليل إنفاقك بذكاء`
    - `تذكيرات ذكية للأهداف`
    - `نصائح ذكية للتوفير`
- **Consent Card (`AssistantConsentCard`)**:
  - Displayed if `consent.status !== 'enabled'`.
  - Title: `المساعد المالي المخصص`
  - Subtitle: `فعّل التخصيص للحصول على إجابات مبنية على بياناتك المالية.`
  - Action: Primary `ActionButton` (`تفعيل التخصيص`) calling `setConsent.mutate({ enabled: true })`.

---

### 3.2 Active AI Chat State (Reference 2)
- **Compact Sub-Header Banner (`AssistantHeaderBanner`)**:
  - White surface card with `radius: 20px`, border `#D7E1DC`.
  - Mini bot avatar (36px) with green status dot.
  - Title: `المساعد الذكي`
  - Subtitle: `مساعدك المالي الذكي لفهم أموالك والإجابة على استفساراتك.`
  - Security Badge: `🛡️ آمن وموثوق` (`Secure & Verified`).
- **User Messages (`UserMessageBubble`)**:
  - Background: `#E2F4EC` (soft brand mint).
  - Aligned to trailing edge (right in RTL, left in LTR).
  - Contains message text, timestamp, and read indicator (`✓✓`).
- **AI Messages (`AssistantMessageBubble`)**:
  - Aligned to leading edge with mini bot avatar.
  - Background: `#FFFFFF`, border `#EEF3F0`, shadow `#103F37` (opacity 0.03).
  - Text response formatted cleanly.
  - Optional `FinancialInsightCard` embedded when structured numbers/summaries are present:
    - Monthly spending header: `ملخص شهر مايو`
    - Comparison pill: `↓ %8 أقل من الشهر السابق` (green or red depending on trend)
    - Highest category block: Icon + `أعلى فئة: التسوق (1,870 ر.س.)`
    - Total spending: `إجمالي المصروفات: 4,250 ر.س.`
    - CTA link: `عرض التفاصيل >` navigating to reports or detailed breakdown.
- **Contextual Follow-up Chips (`AssistantFollowUpSuggestions`)**:
  - Horizontal scrollable chips above composer:
    - `ملخص الشهر`
    - `كيف أوفر؟`
    - `أعلى المصروفات`
  - Tapping sends the query directly.
- **Sticky Bottom Composer (`AssistantComposer`)**:
  - White floating surface, safe area insets respected.
  - Leading sparkle button (`✨`).
  - Multiline text input with `placeholder="اكتب رسالتك هنا..."` (`radius: 18px`).
  - Trailing circular teal send button (`#103F37` / `#1D7464`).
  - Disabled state when empty or while waiting for AI response.

---

### 3.3 State Machine & Data Flow
1. **Initial Mount**: Check `useAssistantConsent()` and `useAssistantConversations()`.
2. **If no conversation selected or active**: Render `AssistantLanding`.
3. **Triggering Conversation**:
   - User types in AskCard OR taps a Suggested Question OR taps a Follow-up chip.
   - Triggers `useCreateAssistantConversation()` or `useAskAssistant()`.
   - UI instantly renders active conversation with optimistic user bubble and typing indicator.
4. **Data Verification**:
   - Uses real queries (`useAssistantConversation`, `useAssistantResponse`, `useAssistantActionPreview`).
   - Formats monetary values with `formatMoney` and locale rules.
   - Respects `usePreferenceStore.getState().hideBalances` (masking sensitive amounts).

---

## 4. Testing & Quality Assurance
- **Unit Tests**:
  - Landing state rendering with hero, suggestions, capabilities, and consent.
  - Tapping suggestion creates conversation and passes prompt.
  - Chat rendering with user and AI messages.
  - Financial insight cards with masked and unmasked amounts.
  - Follow-up suggestion interaction.
  - RTL & LTR layout correctness.
- **Integration Journey Tests**:
  - Full end-to-end flow: Landing -> Send first question -> View Chat with insight card -> Send follow-up.
- **Visual Verification**:
  - Verified on live web/Android Expo preview.
