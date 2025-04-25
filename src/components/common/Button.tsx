import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  View,
} from 'react-native';
import theme from '../../theme';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'filled',
  size = 'medium',
  isLoading = false,
  isFullWidth = false,
  color = theme.colors.primary.default,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  disabled,
  ...rest
}) => {
  // 버튼 스타일 계산
  const getButtonStyles = (): StyleProp<ViewStyle> => {
    const buttonStyles: StyleProp<ViewStyle>[] = [styles.base, styles[size]];
    switch (variant) {
      case 'filled':
        buttonStyles.push({
          backgroundColor: color,
          borderColor: color,
        });
        break;
      case 'tonal':
        buttonStyles.push({
          backgroundColor: `${color}20`,
          borderColor: theme.colors.transparent,
        });
        break;
      case 'outlined':
        buttonStyles.push({
          backgroundColor: theme.colors.transparent,
          borderColor: color,
        });
        break;
      case 'text':
        buttonStyles.push({
          backgroundColor: theme.colors.transparent,
          borderColor: theme.colors.transparent,
          paddingHorizontal: theme.spacing.md,
        });
        break;
    }
    if (isFullWidth) {
      buttonStyles.push(styles.fullWidth);
    }
    if (disabled) {
      buttonStyles.push(styles.disabled);
    }
    return [...buttonStyles, style];
  };

  // 텍스트 스타일 계산
  const getTextStyles = (): StyleProp<TextStyle> => {
    const textStyles: StyleProp<TextStyle>[] = [styles.text];
    const sizeTextKey = `${size}Text` as 'smallText' | 'mediumText' | 'largeText';
    textStyles.push(styles[sizeTextKey]);
    switch (variant) {
      case 'filled':
        textStyles.push({ color: theme.colors.white });
        break;
      case 'tonal':
      case 'outlined':
      case 'text':
        textStyles.push({ color });
        break;
    }
    if (disabled) {
      textStyles.push(styles.disabledText);
    }
    return [...textStyles, textStyle];
  };

  return (
    <TouchableOpacity
      style={getButtonStyles()}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'filled' ? theme.colors.white : color}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {leftIcon && <View style={{ marginRight: 6 }}>{leftIcon}</View>}
          {typeof children === 'string' ? (
            <Text style={getTextStyles()}>{children}</Text>
          ) : (
            children
          )}
          {rightIcon && <View style={{ marginLeft: 6 }}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    // gap: theme.spacing.xs, // 삭제
  },
  small: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  medium: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  large: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: theme.colors.gray[200],
    borderColor: theme.colors.gray[200],
    opacity: 0.7,
  },
  text: {
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
    textAlign: 'center',
  },
  smallText: {
    ...theme.typography.text.sm,
  },
  mediumText: {
    ...theme.typography.text.md,
  },
  largeText: {
    ...theme.typography.text.lg,
  },
  disabledText: {
    color: theme.colors.gray[500],
  },
});

export default Button;
