/**
 * Language selection screen - PRD: Language selection (English, Hindi).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from './context/ThemeContext';
import { LANGUAGES, getStoredLanguage, setStoredLanguage, type LanguageCode } from './i18n';
import i18n from './i18n';

const LanguagePickerScreen = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<LanguageCode>('en');

  useEffect(() => {
    getStoredLanguage().then(setSelected);
  }, []);

  const selectLanguage = async (code: LanguageCode) => {
    setSelected(code);
    await setStoredLanguage(code);
    await i18n.changeLanguage(code);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={colors.barStyle || 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('settings.language')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.list}>
        {LANGUAGES.map(({ code, native }) => (
          <TouchableOpacity
            key={code}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => selectLanguage(code)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: colors.textPrimary }]}>{native}</Text>
            {selected === code && (
              <Icon name="check-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: { fontSize: 16 },
});

export default LanguagePickerScreen;
