# Masarifi Mobile

> Current branch selection, runtime architecture and release evidence are maintained in the [Maintained project guide](../../docs/project/README.md).

Implemented Expo/React Native application for iOS and Android. Copy `.env.example`, install with `npm ci --ignore-scripts`, then run `npm run typecheck`, `npm run lint`, `npm run check:frontend-quality`, and `npx jest --forceExit`.

For a fresh checkout, install the dependencies of `apps/api` as well before the mobile TypeScript check. A sync contract imports the API DTO, which resolves NestJS types from the API directory. Use the branch-specific EAS profile and tracked native modules/plugins when inspecting generated platform projects.
