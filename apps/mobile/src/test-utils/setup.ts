import '@testing-library/jest-native/extend-expect';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// React Native's setup happens via jest-expo preset. This file adds only the
// shared matchers and test-environment adjustments consumed by the foundation
// suite. The mobile Intl implementation under Node 20+ is sufficient for the
// locale-aware number and currency formatting used by the foundation, so no
// polyfill is required.
