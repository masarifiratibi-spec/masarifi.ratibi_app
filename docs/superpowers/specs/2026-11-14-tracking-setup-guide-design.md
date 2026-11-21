# Tracking setup guide — approved design B

The user approved B and requested implementation on 14 November 2026 after reviewing the expanded guide and the three step sheets.

Keep the existing tracking source controls and keyword editor. Between them, add a permanent bell row, “إعدادات تنبيهات المعاملات”, with the subtitle “للتحكم في ظهور إشعار الحفظ والصوت.” It opens this app's system notification settings directly. Below it, place the mint collapsible “كيف أفعّل التتبع؟” guide, initially closed. Expanding it reveals three numbered entries, each with “عرض الخطوات”: SMS tracking, bank notification tracking, and saved transaction alerts. Each entry opens its own scrollable bottom sheet with three instructions, an explicit settings action, and Close. The guide footer explains that one source is enough and capture starts when enabled. Replace the old explanation card with “التحليل على جهازك، وتُزامن تفاصيل المعاملات.”

SMS steps: turn on the SMS source; app permissions → Messages → Allow; return to the app to recheck. Its settings action opens app information using the existing permission service. Include expandable restricted-settings help, conditional on trusting the installed app, and explain that device menus differ.

Bank notification steps: turn on transaction notification tracking; select Masarifi in notification access; review Android's warning, allow access, and return. Its action uses the existing notification listener settings service. Explain that access reads other applications' financial notifications.

Transaction alert steps: open Masarifi notification settings; enable Show notifications; optionally enable popups and sound. Its action opens app notification settings. Explain that showing saved alerts is separate from access to bank notifications.

Use existing typography, tokens, cards, icons and AppSheet, Arabic/English, physical RTL/LTR rows, light/dark themes and safe areas. Do not animate the new accordion. Respect reduced motion in the sheet. Accessible controls expose expanded state and descriptive step labels. Settings failures remain visible with retry available. On unsupported platforms, explain the limitation without opening Android-only settings. No button grants permissions, changes source preferences, sends data, or creates transactions.

B was selected over a more prominent always-expanded setup block to preserve the compact tracking page. No backend, native permission, dashboard, or iOS capture changes. Source implementation does not replace the installed APK.

## User-directed activation revision — 14 November 2026

During physical new-user simulation, the user granted SMS access through the guide, returned, and correctly reported that the source switch stayed off. The settings-only action had not recorded an activation request. The user explicitly clarified: “انا عايز لما افعلهم من كيف افعل التتبع التوجل يشغل”. This supersedes the original settings-only source actions and the original restriction on those actions changing source preferences.

Keep design B's layout. SMS and bank sheets now use explicit “تفعيل تتبع الرسائل” / “تفعيل تتبع إشعارات البنوك” actions. Each calls the existing source activation queue, including its pending-permission, return-to-foreground, owner and newer-OFF fences. After the user allows Android access and returns, enable only the requested source and update its switch. If access is already granted, the explicit action enables that source directly. Denial leaves it off. Merely viewing the guide or granting access independently of an activation request must not enable a source. Android permissions remain user-controlled; transaction-alert display settings remain settings-only.

The user subsequently approved an explicit completed state on the same green source button: “تم التفعيل” after actual source readiness, including when reopening an already-enabled sheet. The completed action is inactive to avoid repeating activation; turning the source off or losing its permission restores the Enable action. Use the screen's saved source/permission/mode state, not a local clicked flag or an optimistic ON intent. Home setup cards continue to derive visibility from the same owner-scoped tracking query; activating through the guide must hide only the corresponding completed card, and disabling it must make it eligible again, following the existing main-toggle rules. Do not permanently dismiss setup cards to simulate completion.

The user subsequently requested removal of the analysis/synchronization sentence below the guide. Remove that rendered note and its localization entries; keep the activation instructions and completed-state behavior.
