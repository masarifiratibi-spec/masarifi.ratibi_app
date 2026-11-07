import React from 'react';

export default function DesignSystemRoute() {
  const { DesignSystemGallery } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/design-system/DesignSystemGallery') as typeof import('@/features/design-system/DesignSystemGallery');
  return <DesignSystemGallery />;
}
