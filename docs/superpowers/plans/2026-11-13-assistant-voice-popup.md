# Assistant landing and voice popup implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. The user's selected screenshot and direct implementation request are the approved design.

**Goal:** Implement the selected emerald assistant layout in both themes and replace the voice consent sheet with a concise centered popup.

**Architecture:** Keep existing draft, assistant question, owner, voice acknowledgement and microphone guards. Change presentation only. Use existing semantic theme tokens, native controls and the established robot avatar.

**Tech stack:** React Native / Expo, TypeScript, React Native Testing Library, signed Android release pipeline.

**Spec:** User's 2026-11-13 request and three attached screenshots: centered robot and greeting; compact 2×2 prompt pills above a bottom composer, raised with breathing space; voice popup titled “معالجة الصوت بالـ AI”, without disclosure paragraph or privacy link.

## Global constraints

- Assistant stays available by default, without activation controls or the accuracy footer.
- Voice recording still needs the existing explicit affirmative choice; decline, dismissal, owner change and storage failures keep their behavior.
- Both themes, Arabic RTL, English, small screens, keyboard and enlarged text remain usable.
- Preserve unrelated dirty files, session, SQLite and device profiles. No commit, push, production server change or data reset.

## Review focus

- A short viewport or open keyboard must allow reaching and editing the composer.
- Large Arabic labels wrap without hiding a prompt or shrinking its touch target.
- History uses the existing owner-scoped query, reports unavailable reads and permits retry.
- Dismissal and consent persistence failures must never start recording.
- Device replacement must retain installed identity and data; verify both themes and the actual popup.

## Tasks

- [ ] Update existing assistant and voice tests to the approved presentation and observe the relevant failures.
- [ ] Implement the assistant hero, compact pills, history action and raised composer with theme tokens and keyboard handling.
- [ ] Implement the centered voice popup and remove its disclosure paragraph/privacy action, preserving all consent logic.
- [ ] Run focused regression suites, TypeScript and changed-file lint; review diff.
- [ ] Prepare and qualify version 141 from the pinned 140 inputs, install as a preserving replacement, and inspect actual light/dark assistant and popup.
- [ ] Save concise validation and physical evidence with the release artifacts.

## Execution notes

The screenshot is the authority for this implementation; the subsequent four experimental Stitch concepts were not selected. Existing full legal documents remain accessible from app settings. The popup change does not change the stored voice disclosure version or grant microphone access.
