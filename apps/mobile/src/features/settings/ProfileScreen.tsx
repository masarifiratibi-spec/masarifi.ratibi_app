import React from 'react';
import { ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { UserProfile } from '@/domain/settings';
import { useSaveSettingsProfile, useSettingsProfile } from './settings-queries';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

export function ProfileScreen() {
  const profile = useSettingsProfile();
  const save = useSaveSettingsProfile();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name ?? '');
    setEmail(profile.data.email ?? '');
  }, [profile.data]);

  if (profile.isLoading) return <StyledText>settings.profile.loading</StyledText>;
  if (profile.isError || !profile.data) return <StyledText>settings.profile.error</StyledText>;

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <TextInput accessibilityLabel={translateDynamic('settings.profile.name')} value={name} onChangeText={setName} />
      <TextInput accessibilityLabel={translateDynamic('settings.profile.email')} value={email} onChangeText={setEmail} />
      <StyledText>{`settings.profile.avatar.${profile.data.avatar}`}</StyledText>
      <StyledText>{profile.data.phone ?? 'settings.profile.phone.notSet'}</StyledText>
      <StyledText>{profile.data.googleAccount ?? 'settings.profile.google.notLinked'}</StyledText>
      <StyledText>{profile.data.country}</StyledText>
      <StyledText>{profile.data.currency}</StyledText>
      <StyledText>{profile.data.timeZone}</StyledText>
      {profile.data.completion.map((item: UserProfile['completion'][number]) => <StyledText key={item}>{`settings.profile.completion.${item}`}</StyledText>)}
      {error ? <StyledText accessibilityRole="alert">{error}</StyledText> : null}
      <ActionButton
        label="settings.profile.save"
        loading={save.isPending}
        onPress={() => {
          if (!email.includes('@')) {
            setError('settings.profile.validation.email');
            return;
          }
          setError(null);
          save.mutate({
            input: { ...profile.data, name, email },
            expectedVersion: profile.data.version,
            operationId: `settings-profile-${Date.now()}`
          });
        }}
      />
      <ActionButton label="settings.profile.phoneOwner" variant="secondary" onPress={() => router.push('/security/settings')} />
      <ActionButton label="settings.profile.googleOwner" variant="secondary" onPress={() => router.push('/security/settings')} />
    </ScrollView>
  );
}
