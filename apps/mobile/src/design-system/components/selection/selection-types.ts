import type { ReactNode } from 'react';
import type { ResolvedTheme } from '@/design-system/theme';

export type SelectionLayoutMode = 'list' | 'grid';

export interface SelectionItem<T = string> {
  id: T;
  title: string;
  subtitle?: string;
  icon?: string | ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  metadata?: Record<string, unknown>;
  disabled?: boolean;
}

export interface SelectionItemRenderProps<T = string> {
  item: SelectionItem<T>;
  isSelected: boolean;
  onPress: () => void;
  direction: 'rtl' | 'ltr';
  theme: ResolvedTheme;
}

export interface SelectionScreenProps<T = string> {
  title: string;
  subtitle?: string;
  items: readonly SelectionItem<T>[];
  selectedId?: T | null;
  onSelect: (item: SelectionItem<T>) => void;
  onBack?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchFilter?: (item: SelectionItem<T>, query: string) => boolean;
  layoutMode?: SelectionLayoutMode;
  numColumns?: number; // for grid mode (default 4)
  renderItem?: (props: SelectionItemRenderProps<T>) => ReactNode;
  headerAction?: ReactNode;
  emptyStateText?: string;
}
