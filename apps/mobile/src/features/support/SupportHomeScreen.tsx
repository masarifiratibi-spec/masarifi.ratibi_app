import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import type { SupportArticle } from '@/domain/support';
import { useArticleSearch } from './support-queries';

export function SupportHomeScreen() {
  const [query, setQuery] = useState('');
  const articles = useArticleSearch({ query });

  return (
    <View>
      <StyledText variant="title">support.home.title</StyledText>
      <StyledText>support.home.version</StyledText>
      <TextInput accessibilityLabel="support.search.input" value={query} onChangeText={setQuery} />
      {articles.data?.map((article: SupportArticle) => <StyledText key={article.id}>{article.titleKey}</StyledText>)}
      <ActionButton label="support.search.noResultsCreateTicket" onPress={() => router.push('/support/new')} />
      <ActionButton label="support.home.ticketHistory" variant="secondary" onPress={() => router.push('/support/tickets')} />
      <ActionButton label="support.home.feedback" variant="secondary" onPress={() => router.push('/support/new?mode=feedback')} />
    </View>
  );
}
