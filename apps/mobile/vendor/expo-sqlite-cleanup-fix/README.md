# Expo SQLite Android teardown backport

This DEV backport pins Expo SQLite 55.0.20 and the complete canonical SHA-256 of `SQLiteModule.kt`. It snapshots cached connections before clearing the cache and attempts each close independently. Transaction, schema, encryption, owner and SharedRef behavior are unchanged.

Run `node scripts/sqlite-cleanup-fix.mjs --apply` only in the existing live Staging development build environment. `--check` rejects a native source tree without the patch. A JavaScript reload cannot activate this Kotlin change; rebuild the native DEV artifact. Do not prebuild over an unrelated Android project or install an ordinary-package APK.

`node --test scripts/sqlite-cleanup-fix.test.mjs` checks version/source rejection, idempotence, Windows line endings and the DEV command guard. With JDK 17 and the cached Kotlin 2.1.20 compiler, `node scripts/sqlite-cleanup-regression.mjs <expo-sqlite-root> <external-output-directory>` compiles the real extracted lifecycle methods against native-call test boundaries.

The optional `--real-sqlite` fixture requires a test-only Xerial SQLite JDBC classpath in `MASARIFI_TEST_SQLITE_JDBC_CLASSPATH`. It uses new temporary file-backed databases, preserves a committed Arabic draft, rolls back uncommitted fixture rows and reacquires the writer lock for 20 teardown cycles. It does not access app data, authenticate, or call an API. This host fixture does not replace Android/SQLCipher acceptance after an approved native update.

The pristine source is from the installed `expo-sqlite` package, upstream [Expo SDK 55](https://github.com/expo/expo/tree/sdk-55/packages/expo-sqlite), copyright 650 Industries, Inc., MIT license. The exact upstream copyright and permission notice is retained in [LICENSE](./LICENSE), copied from [Expo SDK 55 LICENSE](https://github.com/expo/expo/blob/sdk-55/LICENSE). Patch and artifact evidence must distinguish pre-install checks from on-device verification. No automatic install or Production build hook is added.
