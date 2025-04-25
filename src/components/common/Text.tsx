import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  TextProps as RNTextProps,
  StyleProp,
  TextStyle,
} from 'react-native';
import theme from '../../theme';

type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'xl'
  | 'lg'
  | 'md'
  | 'sm'
  | 'xs';

type TextWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

interface TextProps extends RNTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const Text: React.FC<TextProps> = ({
  children,
  variant = 'md',
  weight = 'regular',
  color = theme.colors.gray[900],
  style,
  ...rest
}) => {
  const getTextStyle = (): StyleProp<TextStyle> => {
    const textStyles: StyleProp<TextStyle>[] = [];

    // 변형에 따른 스타일 적용
    if (['h1', 'h2', 'h3', 'h4', 'h5'].includes(variant)) {
      textStyles.push(styles[variant]);
    } else {
      textStyles.push(styles[variant]);
      textStyles.push({
        fontWeight: theme.typography.fontWeight[
          weight
        ] as TextStyle['fontWeight'],
      });
    }

    // 색상 적용
    textStyles.push({color});

    return [textStyles, style];
  };

  return (
    <RNText style={getTextStyle()} {...rest}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  h1: theme.typography.heading.h1 as TextStyle,
  h2: theme.typography.heading.h2 as TextStyle,
  h3: theme.typography.heading.h3 as TextStyle,
  h4: theme.typography.heading.h4 as TextStyle,
  h5: theme.typography.heading.h5 as TextStyle,
  xl: theme.typography.text.xl,
  lg: theme.typography.text.lg,
  md: theme.typography.text.md,
  sm: theme.typography.text.sm,
  xs: theme.typography.text.xs,
});

export default Text;
