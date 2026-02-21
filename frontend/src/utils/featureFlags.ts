/**
 * Feature Flags / Kill Switches
 *
 * All flags are driven by environment variables. Set the env var to "false"
 * to kill a feature without any code change or native rebuild.
 *
 * Add to frontend/.env:
 *   EXPO_PUBLIC_ENABLE_VIDEO_CALLS=false
 *   EXPO_PUBLIC_ENABLE_MAPS=false
 *   EXPO_PUBLIC_ENABLE_PAYMENTS=false
 *   EXPO_PUBLIC_ENABLE_EMERGENCY=false
 *   EXPO_PUBLIC_ENABLE_NOTIFICATIONS=false
 */
function flag(envKey: string, defaultValue = true): boolean {
    const val = process.env[envKey];
    if (val === undefined || val === null || val === '') return defaultValue;
    return val.toLowerCase() !== 'false' && val !== '0';
}

export const Features = {
    VIDEO_CALLS: flag('EXPO_PUBLIC_ENABLE_VIDEO_CALLS', true),
    MAPS: flag('EXPO_PUBLIC_ENABLE_MAPS', true),
    PAYMENTS: flag('EXPO_PUBLIC_ENABLE_PAYMENTS', true),
    EMERGENCY: flag('EXPO_PUBLIC_ENABLE_EMERGENCY', true),
    NOTIFICATIONS: flag('EXPO_PUBLIC_ENABLE_NOTIFICATIONS', true),
    OFFLINE_SYNC: flag('EXPO_PUBLIC_ENABLE_OFFLINE_SYNC', true),
};

/**
 * Returns a "Feature Disabled" placeholder component props.
 * Use this to short-circuit screen rendering when a feature is killed.
 */
export function featureDisabledMessage(featureName: string) {
    return `${featureName} is temporarily disabled. Please check back soon.`;
}
