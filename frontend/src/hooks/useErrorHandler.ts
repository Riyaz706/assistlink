/**
 * Custom hook for error handling
 * Provides centralized error processing, logging, and user notifications
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Sentry from '@sentry/react-native';

export interface ErrorDetails {
    message: string;
    type?: string;
    code?: string;
    statusCode?: number;
    details?: any;
}

export interface UseErrorHandlerReturn {
    error: ErrorDetails | null;
    setError: (error: ErrorDetails | null) => void;
    handleError: (error: any, context?: string) => void;
    clearError: () => void;
    showErrorAlert: (error: ErrorDetails) => void;
}

export function useErrorHandler(): UseErrorHandlerReturn {
    const [error, setError] = useState<ErrorDetails | null>(null);

    const extractErrorMessage = useCallback((error: any): string => {
        // Extract user-friendly error message from various error formats

        if (typeof error === 'string') {
            return error;
        }

        let message = '';

        // API error response format
        if (error?.response?.data?.error?.message) {
            message = error.response.data.error.message;
        } else if (error?.response?.data?.detail) {
            message = typeof error.response.data.detail === 'string'
                ? error.response.data.detail
                : JSON.stringify(error.response.data.detail);
        } else if (error?.response?.data?.message) {
            message = error.response.data.message;
        } else if (error?.message) {
            message = error.message;
        }

        // Replace backend DB connection errors with a short user-friendly message
        if (message && (
            message.includes('Database connection failed') ||
            message.includes('database pool') ||
            (message.includes('db.') && message.includes('supabase.co') && message.includes('5432')) ||
            message.includes('Network is unreachable')
        )) {
            return 'Service is temporarily unavailable. Please try again in a moment.';
        }

        // 405 Method Not Allowed — often from video/booking endpoints if app and backend are out of sync
        if (error?.statusCode === 405 || error?.response?.status === 405 ||
            (message && (message.toLowerCase().includes('method not allowed') || message.includes('405')))) {
            return 'This action is not supported. Please update the app to the latest version and try again.';
        }

        if (message) return message;

        // Network errors
        if (error?.code === 'ECONNABORTED') {
            return 'Request timeout. Please check your internet connection and try again.';
        }

        if (error?.code === 'ERR_NETWORK') {
            return 'Network error. Please check your internet connection.';
        }

        // Default message
        return 'An unexpected error occurred. Please try again.';
    }, []);

    const extractErrorDetails = useCallback((error: any): ErrorDetails => {
        const message = extractErrorMessage(error);

        return {
            message,
            code: error?.response?.data?.error?.code || error?.code,
            statusCode: error?.response?.status || error?.statusCode,
            details: error?.response?.data?.error?.details || error?.details
        };
    }, [extractErrorMessage]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const showErrorAlert = useCallback((errorDetails: ErrorDetails) => {
        Alert.alert(
            'Error',
            errorDetails.message,
            [{ text: 'OK', onPress: clearError }]
        );
    }, [clearError]);

    const handleError = useCallback((error: any, context?: string) => {
        const errorDetails = extractErrorDetails(error);
        if (context) errorDetails.type = context;

        // Set error state
        setError(errorDetails);

        // Send to Sentry for error tracking
        Sentry.captureException(error, {
            tags: {
                context: context || 'general',
                code: errorDetails.code,
                statusCode: errorDetails.statusCode?.toString(),
            },
            extra: {
                details: errorDetails.details,
            }
        });

        // Always show popup so user sees every error
        showErrorAlert(errorDetails);

        return errorDetails;
    }, [extractErrorDetails, showErrorAlert]);

    return {
        error,
        setError,
        handleError,
        clearError,
        showErrorAlert
    };
}

/**
 * Retry utility for failed operations
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        delayMs?: number;
        onRetry?: (attempt: number, error: any) => void;
    } = {}
): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, onRetry } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }

            if (onRetry) {
                onRetry(attempt, error);
            }

            console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
    }

    throw new Error('Max retries exceeded');
}

/**
 * Show a success popup (use for confirmations, saved, etc.)
 */
export function showSuccessAlert(message: string, title: string = 'Success'): void {
    Alert.alert(title, message, [{ text: 'OK' }]);
}

/**
 * Show an info popup (use for notices, tips, etc.)
 */
export function showInfoAlert(message: string, title: string = 'Info'): void {
    Alert.alert(title, message, [{ text: 'OK' }]);
}

/**
 * Show a generic popup (title + message).
 */
export function showAlert(title: string, message: string): void {
    Alert.alert(title, message, [{ text: 'OK' }]);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
    if (error == null) return false;
    const msg = (error?.message ?? '').toLowerCase();
    return (
        error?.code === 'ERR_NETWORK' ||
        error?.code === 'ECONNABORTED' ||
        error?.code === 'NETWORK_ERROR' ||
        error?.code === 'TIMEOUT' ||
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('timeout')
    );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: any): boolean {
    const statusCode = error?.response?.status || error?.statusCode;
    return statusCode === 401 || statusCode === 403;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: any): boolean {
    const statusCode = error?.response?.status || error?.statusCode;
    return statusCode === 422 || statusCode === 400;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: any): string[] {
    const validationErrors = error?.response?.data?.error?.details?.validation_errors;

    if (Array.isArray(validationErrors)) {
        return validationErrors.map((err: any) => {
            const field = err.field || 'Field';
            const message = err.message || 'Invalid value';
            return `${field}: ${message}`;
        });
    }

    return [];
}
