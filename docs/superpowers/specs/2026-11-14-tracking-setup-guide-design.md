# Tracking setup guide — approved design B

The user approved B and requested implementation on 14 November 2026 after reviewing the expanded guide and the three step sheets.

Keep the existing tracking source controls and keyword editor. Between them, add a permanent bell row, “إعدادات تنبيهات المعاملات”, with the subtitle “للتحكم في ظهور إشعار الحفظ والصوت.” It opens this app's system notification settings directly. Below it, place the mint collapsible “كيف أفعّل التتبع؟” guide, initially closed. Expanding it reveals three numbered entries, each with “عرض الخطوات”: SMS tracking, bank notification tracking, and saved transaction alerts. Each entry opens its own scrollable bottom sheet with three instructions, an explicit settings action, and Close. The guide footer explains that one source is enough and capture starts when enabled. Replace the old explanation card with “التحليل على جهازك، وتُزامن تفاصيل المعاملات.”

SMS steps: turn on the SMS source; app permissions → Messages → Allow; return to the app to recheck. Its settings action opens app information using the existing permission service. Include expandable restricted-settings help, conditional on trusting the installed app, and explain that device menus differ.

Bank notification steps: turn on transaction notification tracking; select Masarifi in notification access; review Android's warning, allow access, and return. Its action uses the existing notification listener settings service. Explain that access reads other applications' financial notifications.

Transaction alert steps: open Masarifi notification settings; enable Show notifications; optionally enable popups and sound. Its action opens app notification settings. Explain that showing saved alerts is separate from access to bank notifications.

Use existing typography, tokens, cards, icons and AppSheet, Arabic/English, physical RTL/LTR rows, light/dark themes and safe areas. Do not animate the new accordion. Respect reduced motion in the sheet. Accessible controls expose expanded state and descriptive step labels. Settings failures remain visible with retry available. On unsupported platforms, explain the limitation without opening Android-only settings. No button grants permissions, changes source preferences, sends data, or creates transactions.

B was selected over a more prominent always-expanded setup block to preserve the compact tracking page. No backend, native permission, dashboard, or iOS capture changes. Source implementation does not replace the installed APK.
