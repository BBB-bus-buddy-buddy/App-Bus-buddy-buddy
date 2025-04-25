import React from 'react';
import {
  View,
  StyleSheet,
  ViewProps,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import theme from '../../theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: keyof typeof theme.spacing | number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  style,
  ...rest
}) => {
  const getCardStyle = (): StyleProp<ViewStyle> => {
    const cardStyles: StyleProp<ViewStyle>[] = [styles.base];

    // 패딩 적용
    const paddingValue =
      typeof padding === 'number'
        ? padding
        : theme.spacing[padding] ?? theme.spacing.md; // fallback 처리
    cardStyles.push({padding: paddingValue});

    // 변형에 따른 스타일 적용
    switch (variant) {
      case 'elevated':
        cardStyles.push(styles.elevated);
        break;
      case 'outlined':
        cardStyles.push(styles.outlined);
        break;
      case 'filled':
        cardStyles.push(styles.filled);
        break;
    }
    return [...cardStyles, style];
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={getCardStyle()}
        onPress={onPress}
        activeOpacity={0.7}
        {...rest}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={getCardStyle()} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  elevated: {
    ...theme.shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  filled: {
    backgroundColor: theme.colors.gray[50],
  },
});

export default Card;
