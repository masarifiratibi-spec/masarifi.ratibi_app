import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';

export function NavigationGallery() {
  return (
    <View style={styles.stack}>
      <StyledText variant="title">
        {translate('designSystem.gallery.navigation')}
      </StyledText>
      <GroupedList label={translate('designSystem.navigation.settings')}>
        <NavigationRow
          label={translate('designSystem.gallery.privacy')}
          description={translate('designSystem.navigation.privacyDescription')}
          value={translate('designSystem.navigation.on')}
          status={translate('designSystem.navigation.protected')}
          onPress={() => undefined}
        />
      </GroupedList>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  }
});
