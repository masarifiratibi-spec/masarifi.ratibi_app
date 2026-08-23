import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colorTokens } from '@/design-system/tokens';

export function SparkleIcon({ size = 20, color = colorTokens.surface.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill={color}
      />
      <Path
        d="M19 3L20 6L23 7L20 8L19 11L18 8L15 7L18 6L19 3Z"
        fill={color}
        opacity={0.8}
      />
    </Svg>
  );
}

export function BarChartIcon({ size = 20, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="13" width="4" height="7" rx="1.5" fill={color} />
      <Rect x="10" y="8" width="4" height="12" rx="1.5" fill={color} />
      <Rect x="16" y="4" width="4" height="16" rx="1.5" fill={color} />
    </Svg>
  );
}

export function PieChartIcon({ size = 20, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" fill="none" />
      <Path
        d="M12 12L12 3 A9 9 0 0 1 21 12 Z"
        fill={color}
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 20, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="3.5" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M3 9.5H21" stroke={color} strokeWidth="1.5" />
      <Circle cx="7.5" cy="13.5" r="1.2" fill={color} />
      <Circle cx="12" cy="13.5" r="1.2" fill={color} />
      <Circle cx="16.5" cy="13.5" r="1.2" fill={color} />
      <Circle cx="7.5" cy="17" r="1.2" fill={color} />
      <Circle cx="12" cy="17" r="1.2" fill={color} />
      <Circle cx="16.5" cy="17" r="1.2" fill={color} />
      <Path d="M7 2.5V5.5M17 2.5V5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function WalletIcon({ size = 20, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8C3 6.34315 4.34315 5 6 5H18C19.6569 5 21 6.34315 21 8V17C21 18.6569 19.6569 20 18 20H6C4.34315 20 3 18.6569 3 17V8Z"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M3 9C3 7.89543 3.89543 7 5 7H19C20.1046 7 21 7.89543 21 9"
        stroke={color}
        strokeWidth="1.5"
      />
      <Circle cx="16.5" cy="14" r="1.5" fill={color} />
    </Svg>
  );
}

export function LockShieldIcon({ size = 24, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="11" width="15" height="10" rx="3" stroke={color} strokeWidth="1.8" fill="none" />
      <Path
        d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M9.5 16.5L11.2 18.2L15 14"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SmallShieldIcon({ size = 14, color = colorTokens.teal['700'] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 5.5V11.5C4 16.5 7.5 21.2 12 22.5C16.5 21.2 20 16.5 20 11.5V5.5L12 2Z"
        fill={colorTokens.teal['50']}
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 12L11 13.5L14.5 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
