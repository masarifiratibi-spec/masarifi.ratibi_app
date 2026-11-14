import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, PixelRatio } from 'react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';
import { AssistantLanding } from './AssistantLanding';
import * as queries from './assistant-queries';

describe('AssistantLanding', () => {
  beforeEach(() => {
    changeLocale('ar');
  });

  afterEach(() => jest.restoreAllMocks());

  it('opens directly on the question composer without activation controls', () => {
    renderWithProviders(<AssistantLanding onAskQuestion={jest.fn()} />);
    expect(screen.getByTestId('assistant-ask-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('assistant-consent-card')).toBeNull();
    expect(screen.queryByText(translate('assistant.consent.withdraw'))).toBeNull();
  });

  it('sends typed and suggested questions without a setup step', async () => {
    const ask = jest.fn().mockResolvedValue(true);
    renderWithProviders(<AssistantLanding onAskQuestion={ask} />);
    fireEvent.changeText(screen.getByTestId('assistant-ask-input'), 'Private question');
    await waitFor(() => expect(screen.getByTestId('assistant-ask-submit-button')).toBeEnabled());
    await act(async () => { fireEvent.press(screen.getByTestId('assistant-ask-submit-button')); });
    expect(ask).toHaveBeenCalledWith('Private question');
    fireEvent.press(screen.getByTestId('suggestion-card-spending'));
    expect(ask).toHaveBeenCalledWith(translate('assistant.suggestions.spending'), 'spending_summary');
  });

  it('opens an existing conversation from history without sending the current draft', async () => {
    jest.spyOn(queries, 'useAssistantConversations').mockReturnValue({
      data: { pages: [{ items: [{ id: 'saved-chat', title: 'Budget review' }] }] },
      isPending: false, isError: false
    } as unknown as ReturnType<typeof queries.useAssistantConversations>);
    const select = jest.fn();
    const ask = jest.fn();
    renderWithProviders(<AssistantLanding onAskQuestion={ask} onSelectConversation={select} />);
    fireEvent.changeText(screen.getByTestId('assistant-ask-input'), 'Unsent question');
    fireEvent.press(screen.getByTestId('assistant-open-history'));
    fireEvent.press(await screen.findByRole('button', { name: 'Budget review' }));
    expect(select).toHaveBeenCalledWith('saved-chat');
    expect(ask).not.toHaveBeenCalled();
    expect(screen.getByTestId('assistant-ask-input').props.value).toBe('Unsent question');
  });

  it('does not display cached history after an authoritative access denial', () => {
    const refetch = jest.fn();
    jest.spyOn(queries, 'useAssistantConversations').mockReturnValue({
      data: { pages: [{ items: [{ id: 'revoked-chat', title: 'Private history' }] }] },
      isPending: false, isError: true, error: { status: 403 }, refetch
    } as unknown as ReturnType<typeof queries.useAssistantConversations>);
    renderWithProviders(<AssistantLanding onAskQuestion={jest.fn()} />);
    fireEvent.press(screen.getByTestId('assistant-open-history'));
    expect(screen.queryByText('Private history')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: translate('coreFinance.action.retry') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ar', 'تبي تتجاهل السؤال اللي ما أرسلته؟', 'متابعة الكتابة', 'تجاهل السؤال'],
    ['en', 'Discard this question?', 'Keep editing', 'Discard question']
  ] as const)('keeps an unsent question until explicit discard in %s', async (locale, title, keepLabel, discardLabel) => {
    changeLocale(locale);
    const onBack = jest.fn();
    const onAskQuestion = jest.fn();
    const alert = jest.spyOn(Alert, 'alert');
    renderWithProviders(
      <AssistantLanding onBack={onBack} onAskQuestion={onAskQuestion} />
    );
    fireEvent.changeText(screen.getByTestId('assistant-ask-input'), 'QA unsent question');
    fireEvent.press(screen.getByRole('button', {name: translate('appShell.navigation.back')}));
    expect(alert).toHaveBeenCalledWith(title, expect.any(String), expect.any(Array));
    expect(onBack).not.toHaveBeenCalled();
    const buttons = alert.mock.calls.at(-1)?.[2];
    const keep = buttons?.find(button => button.text === keepLabel);
    const discard = buttons?.find(button => button.text === discardLabel);
    expect(keep?.style).toBe('cancel');
    expect(screen.getByTestId('assistant-ask-input').props.value).toBe('QA unsent question');
    if (!discard?.onPress) throw new Error('Expected explicit discard action');
    await act(async () => { discard.onPress?.(); });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAskQuestion).not.toHaveBeenCalled();
  });

  it('leaves a blank question without a discard prompt', () => {
    const onBack = jest.fn();
    const alert = jest.spyOn(Alert, 'alert');
    renderWithProviders(
      <AssistantLanding onBack={onBack} onAskQuestion={jest.fn()} />
    );
    fireEvent.press(screen.getByRole('button', {name: translate('appShell.navigation.back')}));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it.each(['light', 'dark'] as const)('uses the selected %s theme for the landing page and send states', async mode => {
    const theme = resolveTheme(mode);
    const ask = jest.fn();
    renderWithProviders(
      <ThemeContext.Provider value={{ theme }}>
        <AssistantLanding onAskQuestion={ask} error="Network error" />
      </ThemeContext.Provider>
    );
    expect(screen.getByTestId('assistant-landing')).toHaveStyle({ backgroundColor: theme.colors.surfaces.page });
    expect(screen.getByTestId('assistant-ask-card')).toHaveStyle({ backgroundColor: theme.colors.surfaces.card });
    expect(screen.getByTestId('suggestion-card-spending')).toHaveStyle({ borderColor: theme.colors.borders.default });
    expect(screen.getByRole('alert')).toHaveStyle({ color: theme.colors.iconBadges.danger.foreground });
    const send = screen.getByTestId('assistant-ask-submit-button');
    expect(send).toBeDisabled();
    expect(send).toHaveStyle({ opacity: 0.5 });
    fireEvent.changeText(screen.getByTestId('assistant-ask-input'), 'How much did I spend?');
    await waitFor(() => expect(screen.getByTestId('assistant-ask-submit-button')).toBeEnabled());
    expect(send).toHaveStyle({ backgroundColor: theme.colors.interactions.primary });
  });

  it('renders the selected greeting, four compact suggestions and composer without the old footer', () => {
    const onAskQuestion = jest.fn();

    renderWithProviders(
      <AssistantLanding
        onAskQuestion={onAskQuestion}
      />
    );

    // Header & Hero
    expect(screen.getAllByText(translate('assistant.hero.title')).length).toBe(1);
    expect(screen.getByText(translate('assistant.hero.subtitle'))).toBeTruthy();
    expect(screen.getByText(translate('assistant.hero.heading'))).toBeOnTheScreen();
    expect(screen.getByTestId('assistant-hero-avatar')).toBeTruthy();

    // Ask Card
    expect(screen.getByTestId('assistant-ask-card')).toBeTruthy();
    expect(screen.getByTestId('assistant-ask-input')).toBeTruthy();

    // Personalization Card
    expect(screen.queryByTestId('assistant-consent-card')).toBeNull();

    // Quick Suggestions Header & 4 Cards
    expect(screen.queryByText(translate('assistant.suggestions.header'))).toBeNull();
    expect(screen.getByTestId('suggestion-card-spending')).toBeTruthy();
    expect(screen.getByTestId('suggestion-card-highest')).toBeTruthy();
    expect(screen.getByTestId('suggestion-card-weekly')).toBeTruthy();
    expect(screen.getByTestId('suggestion-card-budget')).toBeTruthy();

    // Privacy Footer
    expect(screen.queryByTestId('assistant-privacy-footer')).toBeNull();
    expect(screen.queryByText(translate('assistant.privacy.note'))).toBeNull();

    // Type in ask input and submit
    fireEvent.changeText(
      screen.getByTestId('assistant-ask-input'),
      'كم أنفقت على الطعام؟'
    );
    fireEvent.press(screen.getByTestId('assistant-ask-submit-button'));
    expect(onAskQuestion).toHaveBeenCalledWith('كم أنفقت على الطعام؟');
  });

  it('submits quick suggestion when tapped', () => {
    const onAskQuestion = jest.fn();
    renderWithProviders(
      <AssistantLanding
        onAskQuestion={onAskQuestion}
      />
    );

    fireEvent.press(screen.getByTestId('suggestion-card-spending'));
    expect(onAskQuestion).toHaveBeenCalledWith(
      translate('assistant.suggestions.spending'),
      'spending_summary'
    );

    fireEvent.press(screen.getByTestId('suggestion-card-budget'));
    expect(onAskQuestion).toHaveBeenCalledWith(
      translate('assistant.suggestions.budget'),
      'budget_status'
    );
  });

  it('renders only authoritative proactive insight values supplied by the backend', () => {
    renderWithProviders(
      <AssistantLanding
        onAskQuestion={jest.fn()}
        insight={{
          id: 'insight-1',
          kind: 'budget_threshold',
          budgetName: 'Restaurants',
          currency: 'SAR',
          budgetMinor: 100_000,
          spentMinor: 85_000,
          remainingMinor: 15_000,
          utilizationBps: 8500,
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000
        }}
      />
    );

    expect(screen.getByText('Restaurants')).toBeTruthy();
    expect(screen.getByText('850.00 SAR')).toBeTruthy();
    expect(screen.queryByText('1,870.00 SAR')).toBeNull();
  });

  it.each(['ar', 'en'] as const)(
    'allows suggestion labels to wrap at 200%% text in %s',
    (locale) => {
      jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
      changeLocale(locale);
      renderWithProviders(
        <AssistantLanding
          onAskQuestion={jest.fn()}
        />
      );

      expect(
        screen.getByText(translate('assistant.suggestions.spending')).props
          .numberOfLines
      ).toBeUndefined();
    }
  );
});
