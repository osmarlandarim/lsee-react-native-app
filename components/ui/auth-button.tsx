import React, { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  leftIcon?: ReactNode;
  variant?: 'light' | 'dark';
  isLoading?: boolean;
};

export default function AuthButton({
  label,
  onPress,
  disabled = false,
  leftIcon,
  variant = 'light',
  isLoading = false,
}: AuthButtonProps) {
  const isDisabled = disabled || isLoading;
  const isDark = variant === 'dark';

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isDark && styles.buttonDark,
        pressed && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}>
      {isLoading ? (
        <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#1F2937'} />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.text, isDark && styles.textDark]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDark: {
    height: 48,
    maxWidth: undefined,
    borderWidth: 0,
    backgroundColor: '#111827',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  textDark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
