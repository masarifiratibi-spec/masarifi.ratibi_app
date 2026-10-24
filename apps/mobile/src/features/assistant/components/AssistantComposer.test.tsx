import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { AssistantComposer } from './AssistantComposer';

function deferredSend() {
  let resolve!: (accepted: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('clears an acknowledged question and prevents resending while awaiting its outcome', async () => {
  const send = deferredSend();
  const sent: string[] = [];
  renderWithProviders(
    <AssistantComposer
      onSendMessage={(text) => {
        sent.push(text);
        return send.promise;
      }}
    />
  );
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    '  إيه آخر معاملة؟  '
  );
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  expect(sent).toEqual(['إيه آخر معاملة؟']);
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    '  إيه آخر معاملة؟  '
  );
  await act(async () => {
    send.resolve(true);
  });
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    ''
  );
  expect(screen.getByTestId('assistant-composer-send-button')).toBeDisabled();
});

it('retains a question whose send is declined or has an unresolved outcome', async () => {
  renderWithProviders(<AssistantComposer onSendMessage={async () => false} />);
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'إيه أكبر مصروفاتي؟'
  );
  await act(async () => {
    fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  });
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    'إيه أكبر مصروفاتي؟'
  );
});

it('does not erase a draft edited while an earlier question was being acknowledged', async () => {
  const send = deferredSend();
  renderWithProviders(<AssistantComposer onSendMessage={() => send.promise} />);
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'السؤال الأول'
  );
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'سؤال جديد'
  );
  await act(async () => {
    send.resolve(true);
  });
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    'سؤال جديد'
  );
});

it('preserves a blocked question without dispatching it', () => {
  const sent: string[] = [];
  const onSendMessage = async (text: string) => {
    sent.push(text);
    return true;
  };
  let setBlocked!: (blocked: boolean) => void;
  function ComposerWithAvailability() {
    const [blocked, setLoading] = React.useState(false);
    setBlocked = setLoading;
    return (
      <AssistantComposer loading={blocked} onSendMessage={onSendMessage} />
    );
  }
  renderWithProviders(<ComposerWithAvailability />);
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'سؤال محفوظ'
  );
  act(() => setBlocked(true));
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  expect(sent).toEqual([]);
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    'سؤال محفوظ'
  );
});
