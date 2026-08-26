import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Polygon,
  Rect
} from 'react-native-svg';

import { colorTokens } from '@/design-system/tokens';

export interface CurrencyFlagIconProps {
  code: string;
  size?: number;
}

export function CurrencyFlagIcon({ code, size = 36 }: CurrencyFlagIconProps) {
  const normalized = (code || '').toUpperCase().trim();
  const radius = size / 2;
  const clipId = `flag-clip-${normalized}-${size}`;

  const renderFlagContent = () => {
    switch (normalized) {
      case 'SAR': // Saudi Arabia
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["006C35"]} />
            {/* White stylized sword & calligraphy motif */}
            <Path
              d="M10 23h16v1.2H10z"
              fill={colorTokens.raw["FFFFFF"]}
            />
            <Path
              d="M10 23l2 2v-4z"
              fill={colorTokens.raw["FFFFFF"]}
            />
            <Path
              d="M11 14.5c1.5-1 3.5-1 5 0v2c-1.5-1-3.5-1-5 0zm7 0c1.5-1 3.5-1 5 0v2c-1.5-1-3.5-1-5 0zm-5 4c1-0.8 2.5-0.8 3.5 0v1.5c-1-0.8-2.5-0.8-3.5 0zm6 0c1-0.8 2.5-0.8 3.5 0v1.5c-1-0.8-2.5-0.8-3.5 0z"
              fill={colorTokens.raw["FFFFFF"]}
            />
          </G>
        );

      case 'EGP': // Egypt
        return (
          <G>
            <Rect y="0" width="36" height="12" fill={colorTokens.raw["C8102E"]} />
            <Rect y="12" width="36" height="12" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="24" width="36" height="12" fill={colorTokens.raw["000000"]} />
            {/* Golden Eagle */}
            <Path
              d="M16 15h4v5l-2 2-2-2zm-1 1l-1 3h6l-1-3z"
              fill={colorTokens.raw["C69214"]}
            />
          </G>
        );

      case 'USD': // USA
        return (
          <G>
            {/* 7 bands */}
            <Rect y="0" width="36" height="5.14" fill={colorTokens.raw["B22234"]} />
            <Rect y="5.14" width="36" height="5.14" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="10.28" width="36" height="5.14" fill={colorTokens.raw["B22234"]} />
            <Rect y="15.42" width="36" height="5.14" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="20.56" width="36" height="5.14" fill={colorTokens.raw["B22234"]} />
            <Rect y="25.7" width="36" height="5.14" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="30.84" width="36" height="5.16" fill={colorTokens.raw["B22234"]} />
            {/* Blue Canton */}
            <Rect width="17" height="18" fill={colorTokens.raw["0A3161"]} />
            {/* Stars pattern */}
            <Circle cx="4" cy="4.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="8.5" cy="4.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="13" cy="4.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="6.2" cy="9" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="10.7" cy="9" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="4" cy="13.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="8.5" cy="13.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="13" cy="13.5" r="1.1" fill={colorTokens.raw["FFFFFF"]} />
          </G>
        );

      case 'JPY': // Japan
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["FFFFFF"]} />
            <Circle cx="18" cy="18" r="9" fill={colorTokens.raw["C8102E"]} />
          </G>
        );

      case 'EUR': // European Union
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["003399"]} />
            {/* Circular constellation of gold stars */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const cx = 18 + 10 * Math.sin(rad);
              const cy = 18 - 10 * Math.cos(rad);
              return <Circle key={deg} cx={cx} cy={cy} r="1.2" fill={colorTokens.raw["FFCC00"]} />;
            })}
          </G>
        );

      case 'GBP': // United Kingdom (Union Jack)
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["012169"]} />
            {/* White Saltires */}
            <Path d="M0 0l36 36M36 0L0 36" stroke={colorTokens.raw["FFFFFF"]} strokeWidth="4.5" />
            {/* Red Saltires */}
            <Path d="M0 0l36 36M36 0L0 36" stroke={colorTokens.raw["C8102E"]} strokeWidth="2.2" />
            {/* White Cross */}
            <Path d="M18 0v36M0 18h36" stroke={colorTokens.raw["FFFFFF"]} strokeWidth="7.5" />
            {/* Red Cross */}
            <Path d="M18 0v36M0 18h36" stroke={colorTokens.raw["C8102E"]} strokeWidth="4.5" />
          </G>
        );

      case 'AED': // United Arab Emirates
        return (
          <G>
            <Rect y="0" width="36" height="12" fill={colorTokens.raw["00732F"]} />
            <Rect y="12" width="36" height="12" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="24" width="36" height="12" fill={colorTokens.raw["000000"]} />
            {/* Red Hoist Band */}
            <Rect x="0" y="0" width="10" height="36" fill={colorTokens.raw["FF0000"]} />
          </G>
        );

      case 'KWD': // Kuwait
        return (
          <G>
            <Rect y="0" width="36" height="12" fill={colorTokens.raw["007A3D"]} />
            <Rect y="12" width="36" height="12" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="24" width="36" height="12" fill={colorTokens.raw["CE1126"]} />
            {/* Black Trapezoid */}
            <Polygon points="0,0 12,10 12,26 0,36" fill={colorTokens.raw["000000"]} />
          </G>
        );

      case 'QAR': // Qatar
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["8D1B3D"]} />
            {/* Serrated White Hoist */}
            <Polygon
              points="0,0 10,0 14,2 10,4 14,6 10,8 14,10 10,12 14,14 10,16 14,18 10,20 14,22 10,24 14,26 10,28 14,30 10,32 14,34 10,36 0,36"
              fill={colorTokens.raw["FFFFFF"]}
            />
          </G>
        );

      case 'BHD': // Bahrain
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["DA291C"]} />
            {/* Serrated White Hoist (5 points) */}
            <Polygon
              points="0,0 10,0 14,3.6 10,7.2 14,10.8 10,14.4 14,18 10,21.6 14,25.2 10,28.8 14,32.4 10,36 0,36"
              fill={colorTokens.raw["FFFFFF"]}
            />
          </G>
        );

      case 'OMR': // Oman
        return (
          <G>
            <Rect y="0" width="36" height="12" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="12" width="36" height="12" fill={colorTokens.raw["DB161B"]} />
            <Rect y="24" width="36" height="12" fill={colorTokens.raw["008000"]} />
            {/* Red Hoist Band */}
            <Rect x="0" y="0" width="10" height="36" fill={colorTokens.raw["DB161B"]} />
            {/* White Emblem */}
            <Circle cx="5" cy="8" r="2.2" fill={colorTokens.raw["FFFFFF"]} />
          </G>
        );

      case 'JOD': // Jordan
        return (
          <G>
            <Rect y="0" width="36" height="12" fill={colorTokens.raw["000000"]} />
            <Rect y="12" width="36" height="12" fill={colorTokens.raw["FFFFFF"]} />
            <Rect y="24" width="36" height="12" fill={colorTokens.raw["007A3D"]} />
            {/* Red Chevron */}
            <Polygon points="0,0 18,18 0,36" fill={colorTokens.raw["CE1126"]} />
            {/* 7-pointed Star */}
            <Circle cx="6" cy="18" r="2.2" fill={colorTokens.raw["FFFFFF"]} />
          </G>
        );

      default:
        return (
          <G>
            <Rect width="36" height="36" fill={colorTokens.raw["E5E7EB"]} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: colorTokens.raw["4B5563"],
                textAlign: 'center'
              }}
            >
              {normalized.slice(0, 2)}
            </Text>
          </G>
        );
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius }]}>
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx="18" cy="18" r="18" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          {renderFlagContent()}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colorTokens.raw["F3F4F6"]
  }
});
