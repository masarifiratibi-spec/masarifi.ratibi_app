# SPEC-006 Android Native Evidence

- Date: 2026-08-09
- Device: Samsung SM_A165F (`RK8XB00N33K`), Android physical size 1080x2340
- Build: `npx expo run:android --device SM_A165F --no-bundler` completed successfully.
- Native modules: Gradle linked and built `expo-av` 14.0.7 and `expo-file-system` 17.0.1.
- Permission: The in-app education appeared before the Android microphone prompt. The native prompt offered foreground, one-time, and deny choices. After foreground approval, `RECORD_AUDIO` reported `granted=true`.
- Recording: A real recording created `cache/Audio/recording-*.m4a` while active.
- Interruption: Sending the app to the background removed the active temporary audio file. The existing privacy/navigation gate returned the resumed app to Home.
- Maximum duration: A real recording automatically stopped at 60 seconds, produced the editable Arabic demo transcript, and left no audio file in app-private cache.
- Language/direction: Native accessibility trees captured English public entry and Arabic RTL authenticated/voice flows. Arabic strings rendered as Unicode in the final XML evidence.
- Theme: Both Android light and dark modes launched without a fatal or React Native error. The device was restored to dark mode.
- Size: The physical 1080x2340 viewport and a temporary 320x568 override launched without a fatal or React Native error. The physical size was restored.
- Text/accessibility: A temporary 200% font scale produced a navigable accessibility tree. Font scale was restored to 1.0. Voice controls expose button/radio/edit-text roles and content descriptions.
- Privacy: Device screenshots are black because the existing app privacy protection blocks screen capture; XML accessibility evidence is retained instead.

Evidence files include permission, ready, recording, interruption, maximum-duration, theme, size, and text-scale UIAutomator dumps.
