import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import theme from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  hintStyle?: StyleProp<TextStyle>;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  hintStyle,
  onFocus,
  onBlur,
  ...rest
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };
  
  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };
  
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focused,
        error ? styles.error : null,
      ]}>
        {leftIcon && (
          <View style={styles.leftIcon}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          ref={ref} // <-- ref를 여기 전달
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            inputStyle,
          ].filter(Boolean)}
          placeholderTextColor={theme.colors.gray[400]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
        
        {rightIcon && (
          <TouchableOpacity 
            style={styles.rightIcon} 
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      
      {error ? (
        <Text style={[styles.errorText, errorStyle]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, hintStyle]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.text.sm,
    fontWeight: '500', // Ensure this is a valid fontWeight value
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  focused: {
    borderColor: theme.colors.primary.default,
  },
  error: {
    borderColor: theme.colors.system.error,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    ...theme.typography.text.md,
    color: theme.colors.gray[900],
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  leftIcon: {
    paddingLeft: theme.spacing.md,
  },
  rightIcon: {
    paddingRight: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.text.sm,
    color: theme.colors.system.error,
    marginTop: theme.spacing.xs,
  },
  hint: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.xs,
  },
});

export default Input;