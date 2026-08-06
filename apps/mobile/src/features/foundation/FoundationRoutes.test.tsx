/**
 * Route-level Arabic RTL and English LTR parity coverage (T041).
 *
 * Each foundation route renders without throwing in both locales, proving no
 * user-facing key is missing in either catalog. Constitution Principle III.
 */

import React from 'react';

import { FinancialPositionPanel } from './FinancialPositionPanel';
import { CaptureFallbackPanel } from './CaptureFallbackPanel';
import { FinancialTrustPanel } from './FinancialTrustPanel';
import { AccessibilityStateGallery } from './AccessibilityStateGallery';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { populatedSummary } from '@/services/mocks/financial-summary';
import {
  buildAndroidCapabilities,
  buildIosCapabilities
} from '@/services/mocks/platform-capabilities';
import type { Locale } from '@/domain/foundation';
import { usePreferenceStore } from '@/state/preferences';

const LOCALES: Locale[] = ['ar', 'en'];

describe.each(LOCALES)('foundation routes render in %s', (locale) => {
  beforeEach(() => {
    changeLocale(locale);
    usePreferenceStore.setState({
      locale,
      direction: locale === 'ar' ? 'rtl' : 'ltr',
      hydrated: true
    });
  });

  it('FinancialPositionPanel renders', () => {
    const { toJSON } = renderWithProviders(
      <FinancialPositionPanel summary={populatedSummary} />
    );
    expect(toJSON()).not.toBeNull();
  });

  it('CaptureFallbackPanel renders on Android and iOS', () => {
    const android = renderWithProviders(
      <CaptureFallbackPanel
        capabilities={buildAndroidCapabilities()}
        platform="android"
      />
    );
    expect(android.toJSON()).not.toBeNull();
    const ios = renderWithProviders(
      <CaptureFallbackPanel
        capabilities={buildIosCapabilities()}
        platform="ios"
      />
    );
    expect(ios.toJSON()).not.toBeNull();
  });

  it('FinancialTrustPanel renders for every scenario', () => {
    const scenarios = [
      'clear',
      'ambiguous',
      'duplicate',
      'failed',
      'assistant'
    ] as const;
    scenarios.forEach((scenario) => {
      const { toJSON } = renderWithProviders(
        <FinancialTrustPanel scenario={scenario} />
      );
      expect(toJSON()).not.toBeNull();
    });
  });

  it('AccessibilityStateGallery renders', () => {
    const { toJSON, getByTestId } = renderWithProviders(
      <AccessibilityStateGallery />
    );
    expect(toJSON()).not.toBeNull();
    expect(getByTestId('foundation-direction-root')).toHaveStyle({
      direction: locale === 'ar' ? 'rtl' : 'ltr'
    });
  });
});
