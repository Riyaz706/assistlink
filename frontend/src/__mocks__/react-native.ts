/**
 * Minimal React Native mock for Vitest unit tests.
 * Only used when testing modules that import from 'react-native'.
 */
export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const StyleSheet = { create: (s: object) => s };
export const Alert = {
  alert: () => {},
  prompt: (_: string, __: string, callback?: (v: string) => void) => callback?.(''),
};
export const Platform = { OS: 'web' };
export const Dimensions = { get: () => ({ width: 375, height: 812 }) };
export default { View, Text, StyleSheet, Alert, Platform, Dimensions };
