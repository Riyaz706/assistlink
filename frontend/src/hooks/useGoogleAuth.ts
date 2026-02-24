import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';

// Required so the auth browser closes and returns to the app after redirect
WebBrowser.maybeCompleteAuthSession();

// Load from env (dev) or expoConfig.extra (EAS build). Check extra first for reliability in built apps.
function getGoogleClientIds() {
  const extra = Constants.expoConfig?.extra || {};
  return {
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || extra.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  };
}

const ids = getGoogleClientIds();
const GOOGLE_WEB_CLIENT_ID = ids.web;
const GOOGLE_IOS_CLIENT_ID = ids.ios || ids.web; // Fallback to web if no iOS client
const GOOGLE_ANDROID_CLIENT_ID = ids.android;

export interface GoogleAuthResult {
    idToken: string | null;
    user: {
        email: string;
        name: string;
        picture: string;
    } | null;
}

export function useGoogleAuth() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    // Android: Use HTTPS redirect (Chrome Custom Tabs often fails to hand off assistlink:// to the app).
    // The interstitial page at our Firebase URL loads in the browser, then redirects to the app.
    // iOS/Web: Use standard scheme-based or origin redirect.
    const isStandalone = Constants.executionEnvironment === 'standalone' || Constants.executionEnvironment === 'bare';
    const ANDROID_HTTPS_REDIRECT = 'https://assistlink-67bb3-1a64d.web.app/oauth-redirect';

    const redirectUriOptions = Platform.OS === 'android' && isStandalone
        ? { native: ANDROID_HTTPS_REDIRECT }
        : {
            scheme: 'assistlink',
            path: 'redirect',
            ...(Platform.OS !== 'web' && isStandalone && { native: 'assistlink://redirect' }),
        };

    // On Android with HTTPS redirect, use Web client so Google accepts the https redirect URI.
    const androidClientIdForAuth = Platform.OS === 'android' && isStandalone
        ? GOOGLE_WEB_CLIENT_ID
        : GOOGLE_ANDROID_CLIENT_ID;

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
        {
            clientId: GOOGLE_WEB_CLIENT_ID,
            webClientId: GOOGLE_WEB_CLIENT_ID,
            iosClientId: GOOGLE_IOS_CLIENT_ID,
            androidClientId: androidClientIdForAuth,
        },
        redirectUriOptions
    );

    useEffect(() => {
        const web = !!GOOGLE_WEB_CLIENT_ID;
        const android = !!GOOGLE_ANDROID_CLIENT_ID;
        const ios = !!GOOGLE_IOS_CLIENT_ID;
        if (!web || (Platform.OS === 'android' && !android) || (Platform.OS === 'ios' && !ios)) {
            console.warn('[GoogleAuth] Missing client IDs. Web:', web, 'Android:', android, 'iOS:', ios, '- Add EXPO_PUBLIC_GOOGLE_*_CLIENT_ID to .env (dev) or EAS env (build).');
        }
        if (request) {
            console.log('[GoogleAuth] Ready. Redirect URI:', request.redirectUri);
        }
    }, [request]);

    // Ensure auth browser is dismissed when app resumes (e.g. after redirect back from Google).
    // Critical for Android: when user signs in and redirects to assistlink://, the app comes to foreground
    // and maybeCompleteAuthSession must run to close the browser and capture the auth result.
    useEffect(() => {
        WebBrowser.maybeCompleteAuthSession();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                WebBrowser.maybeCompleteAuthSession();
            }
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (response?.type === 'success') {
            setLoading(false);
            const { id_token } = response.params;

            if (id_token) {
                // Token will be handled by the caller
                console.log('[GoogleAuth] Successfully received ID token');
            }
        } else if (response?.type === 'error') {
            setLoading(false);
            setError(response.error?.message || 'Google sign in failed');
            console.error('[GoogleAuth] Error:', response.error);
        } else if (response?.type === 'cancel') {
            setLoading(false);
            setError('Sign in was cancelled');
            console.log('[GoogleAuth] User cancelled sign in');
        }
    }, [response]);

    const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
        setError(null);
        setLoading(true);

        try {
            if (!request) {
                throw new Error('Google auth request not initialized');
            }

            // On Android, createTask: false keeps the auth browser in the same task as the app,
            // so the redirect back to assistlink:// properly returns control to the app instead of staying in browser.
            const promptOptions = Platform.OS === 'android' ? { createTask: false } : undefined;
            const result = await promptAsync(promptOptions);

            if (result.type === 'success') {
                const { id_token, authentication } = result.params;

                if (!id_token) {
                    throw new Error('No ID token received from Google');
                }

                // Decode the ID token to get user info (basic decoding, not verification)
                const base64Url = id_token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );

                const payload = JSON.parse(jsonPayload);

                return {
                    idToken: id_token,
                    user: {
                        email: payload.email,
                        name: payload.name,
                        picture: payload.picture,
                    },
                };
            } else if (result.type === 'cancel') {
                throw new Error('Sign in was cancelled');
            } else {
                throw new Error('Google sign in failed');
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to sign in with Google';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return {
        signInWithGoogle,
        loading,
        error,
        isReady: !!request,
    };
}
