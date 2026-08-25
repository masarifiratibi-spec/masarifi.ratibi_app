import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  G
} from 'react-native-svg';

import { colorTokens } from '@/design-system/tokens';

export interface AssistantBotAvatarProps {
  size?: number;
  showHalo?: boolean;
  showStatusDot?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

let _avatarInstanceId = 0;

export function AssistantBotAvatar({
  size = 48,
  showHalo = false,
  showStatusDot = false,
  style,
  testID = 'assistant-bot-avatar'
}: AssistantBotAvatarProps) {
  // Each instance gets a unique ID prefix so SVG gradient IDs never collide
  // when multiple avatars appear on the same screen (header + message bubbles).
  const uid = useMemo(() => {
    _avatarInstanceId += 1;
    return `aba${_avatarInstanceId}`;
  }, []);

  const outerSize = showHalo ? size * 1.4 : size;
  const scale = size / 100;
  const offset = showHalo ? (outerSize - size) / 2 : 0;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { width: outerSize, height: outerSize },
        style
      ]}
    >
      <Svg
        width={outerSize}
        height={outerSize}
        viewBox={`0 0 ${outerSize} ${outerSize}`}
      >
        <Defs>
          <LinearGradient id={`${uid}-headGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colorTokens.raw["FFFFFF"]} />
            <Stop offset="70%" stopColor={colorTokens.raw["F0F6F4"]} />
            <Stop offset="100%" stopColor={colorTokens.raw["D5E5E0"]} />
          </LinearGradient>

          <LinearGradient id={`${uid}-screenGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colorTokens.raw["082A24"]} />
            <Stop offset="100%" stopColor={colorTokens.raw["0B1A17"]} />
          </LinearGradient>

          <RadialGradient id={`${uid}-eyeGlow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colorTokens.raw["38FDF2"]} />
            <Stop offset="60%" stopColor={colorTokens.raw["00E5D0"]} />
            <Stop offset="100%" stopColor={colorTokens.raw["00B8A6"]} />
          </RadialGradient>

          <LinearGradient id={`${uid}-haloGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colorTokens.raw["2DD4BF"]} stopOpacity="0.8" />
            <Stop offset="50%" stopColor={colorTokens.raw["0D9488"]} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={colorTokens.raw["14B8A6"]} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>

        {showHalo && (
          <G testID="bot-halo-ring">
            <Circle
              cx={outerSize / 2}
              cy={outerSize / 2}
              r={outerSize / 2 - 4}
              stroke={`url(#${uid}-haloGrad)`}
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
            />
            <Circle
              cx={outerSize / 2}
              cy={outerSize / 2}
              r={outerSize / 2 - 12}
              stroke={colorTokens.raw["2DD4BF"]}
              strokeWidth="1"
              strokeOpacity="0.35"
              fill="none"
            />
          </G>
        )}

        <G transform={`translate(${offset}, ${offset}) scale(${scale})`}>
          {/* Antenna */}
          <Rect x="47" y="6" width="6" height="12" rx="3" fill={colorTokens.raw["D5E5E0"]} />
          <Circle cx="50" cy="6" r="6" fill={colorTokens.raw["2DD4BF"]} />
          <Circle cx="50" cy="6" r="3" fill={colorTokens.raw["A7F3D0"]} />

          {/* Left ear pod */}
          <Rect x="6" y="38" width="12" height="24" rx="6" fill={colorTokens.raw["D5E5E0"]} />
          <Rect x="8" y="42" width="4" height="16" rx="2" fill={colorTokens.raw["0D9488"]} />

          {/* Right ear pod */}
          <Rect x="82" y="38" width="12" height="24" rx="6" fill={colorTokens.raw["D5E5E0"]} />
          <Rect x="88" y="42" width="4" height="16" rx="2" fill={colorTokens.raw["0D9488"]} />

          {/* Head capsule */}
          <Rect
            x="14" y="16" width="72" height="68" rx="34"
            fill={`url(#${uid}-headGrad)`}
            stroke={colorTokens.raw["CBD5E1"]}
            strokeWidth="0.75"
          />

          {/* Screen face */}
          <Rect
            x="22" y="26" width="56" height="46" rx="23"
            fill={`url(#${uid}-screenGrad)`}
          />

          {/* Eyes */}
          <Circle cx="37" cy="46" r="5" fill={`url(#${uid}-eyeGlow)`} />
          <Circle cx="35.5" cy="44.5" r="1.5" fill={colorTokens.raw["FFFFFF"]} />
          <Circle cx="63" cy="46" r="5" fill={`url(#${uid}-eyeGlow)`} />
          <Circle cx="61.5" cy="44.5" r="1.5" fill={colorTokens.raw["FFFFFF"]} />

          {/* Smile */}
          <Path
            d="M 44 56 Q 50 61 56 56"
            stroke={colorTokens.raw["38FDF2"]}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>

      {showStatusDot && (
        <View
          testID="bot-status-dot"
          style={[
            styles.statusDot,
            {
              width: Math.max(8, size * 0.22),
              height: Math.max(8, size * 0.22),
              borderRadius: 999,
              right: showHalo ? offset : 0,
              bottom: showHalo ? offset : 0
            }
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  statusDot: {
    backgroundColor: colorTokens.raw["10B981"],
    borderColor: colorTokens.raw["FFFFFF"],
    borderWidth: 1.5,
    position: 'absolute'
  }
});
