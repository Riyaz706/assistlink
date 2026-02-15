import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Required for Expo Go to work properly
WebBrowser.maybeCompleteAuthSession();

// These will be loaded from environment variables
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

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

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    // In Expo Go, we must use the Web Client ID because the package name (host.exp.exponent) 
    // doesn't match our Google Cloud Console configuration (com.assistlink.app).
    // Failing to do this results in "Access blocked: This app’s request is invalid" (Error 400).

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: isExpoGo ? undefined : GOOGLE_IOS_CLIENT_ID,
        androidClientId: isExpoGo ? undefined : GOOGLE_ANDROID_CLIENT_ID,
    });

    useEffect(() => {
        if (request) {
            console.log('[GoogleAuth] Redirect URI:', request.redirectUri);
            if (isExpoGo) {
                console.log('[GoogleAuth] Running in Expo Go: Forcing Web Auth Flow to avoid package mismatch');
            }
        }
    }, [request]);

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

            const result = await promptAsync();

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
