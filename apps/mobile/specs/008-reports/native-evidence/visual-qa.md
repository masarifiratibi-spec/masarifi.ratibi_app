# Visual QA Evidence

Date: 2026-08-10

Status: PARTIAL PASS - SEMANTIC/LAYOUT MATRIX RUN; PIXEL REVIEW BLOCKED

| Dimension | Result | Evidence |
|---|---:|---|
| English LTR | PASS | `android-2026-08-10/theme-light.xml`, `theme-dark.xml` |
| Arabic RTL | PASS | `arabic-rtl-top.xml`, `arabic-rtl-bottom.xml` |
| Light and dark | PASS for content/layout | `theme-light.xml`, `theme-dark.xml` |
| 320x568 logical phone | PASS | `small-320x568-top.xml`, `small-320x568-bottom.xml` |
| Large physical phone | PASS | Main Android report/schedule/preview UI trees |
| Adaptive 800x1280 logical tablet | PASS | `adaptive-tablet.xml` |
| Keyboard-open schedule fields | PASS | Recipient and delivery-day native input journey |
| 200% text | PASS | `font-200-top.xml`, `font-200-bottom.xml` |
| Grayscale | PASS for semantic content/non-color labels | `grayscale.xml` |
| Reduced motion | PASS | `reduced-motion.xml` |
| TalkBack | PASS | `talkback.xml` |
| Hidden values with TalkBack | PASS | Six `Value hidden` announcements and zero numeric SAR amount announcements in `talkback-hidden-values.xml` |

ADB screenshots of protected app content returned privacy-black frames, so pixel-level color,
contrast, and clipping comparison could not be retained without weakening the app's privacy
protection. UI hierarchy evidence proves content presence, bounds, accessibility names/states,
scroll reachability, and primary-action availability, but T081 remains open for an authorized
human visual review on the physical display.
