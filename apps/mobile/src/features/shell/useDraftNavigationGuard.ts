import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

type Copy = {
  title: string;
  message: string;
  keep: string;
  discard: string;
};

export function useDraftNavigationGuard({
  dirty,
  discard,
  copy,
  close = () => router.back()
}: {
  dirty: boolean;
  discard: () => void | Promise<void>;
  copy: Copy;
  close?: () => void;
}) {
  const navigation = useNavigation();
  const confirm = useCallback(
    (leave: () => void) => {
      if (!dirty) {
        leave();
        return;
      }
      Alert.alert(copy.title, copy.message, [
        { text: copy.keep, style: 'cancel' },
        {
          text: copy.discard,
          style: 'destructive',
          onPress: () => void Promise.resolve(discard()).then(leave)
        }
      ]);
    },
    [copy, dirty, discard]
  );

  usePreventRemove(dirty, ({ data }) =>
    confirm(() => navigation.dispatch(data.action))
  );

  return useCallback(() => confirm(close), [close, confirm]);
}
