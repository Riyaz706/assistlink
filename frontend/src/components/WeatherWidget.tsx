/**
 * Weather Widget - PRD: Dashboard weather widget
 * Uses Open-Meteo API (free, no API key required)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../theme';

const ICONS: Record<number, string> = {
  0: 'weather-sunny',
  1: 'weather-sunny',
  2: 'weather-partly-cloudy',
  3: 'weather-cloudy',
  45: 'weather-fog',
  48: 'weather-fog',
  51: 'weather-rainy',
  61: 'weather-rainy',
  80: 'weather-rainy',
  95: 'weather-lightning',
};

function getWeatherIcon(code: number): string {
  return ICONS[code] ?? 'weather-cloudy';
}

export default function WeatherWidget({ lat = 17.385, lng = 78.4867 }: { lat?: number; lng?: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ temp: number; code: number; desc: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        const c = json?.current_weather;
        if (c) {
          setData({
            temp: Math.round(c.temperature ?? 0),
            code: c.weathercode ?? 0,
            desc: c.weathercode === 0 ? 'Clear' : c.weathercode < 4 ? 'Partly cloudy' : 'Cloudy',
          });
        }
      })
      .catch(() => setError('Unable to load weather'))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.label}>Weather</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Icon name="weather-cloudy" size={28} color={colors.textMuted} />
        <Text style={styles.label}>—</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name={getWeatherIcon(data.code) as any} size={28} color={colors.accent} />
      <View>
        <Text style={styles.temp}>{data.temp}°</Text>
        <Text style={styles.label}>{data.desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } : { elevation: 2 }),
  },
  temp: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary },
});
