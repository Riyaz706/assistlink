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

        // API error response format
        if (error?.response?.data?.error?.message) {
            return error.response.data.error.message;
        }

        if (error?.response?.data?.detail) {
            return error.response.data.detail;
        }

        if (error?.response?.data?.message) {
            return error.response.data.message;
        }

        // Standard Error object
        if (error?.message) {
            return error.message;
        }

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

        return errorDetails;
    }, [extractErrorDetails]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const showErrorAlert = useCallback((errorDetails: ErrorDetails) => {
        Alert.alert(
            'Error',
            errorDetails.message,
            [
                {
                    text: 'OK',
                    onPress: clearError
                }
            ]
        );
    }, [clearError]);

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
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
    return (
        error?.code === 'ERR_NETWORK' ||
        error?.code === 'ECONNABORTED' ||
        error?.message?.toLowerCase().includes('network') ||
        error?.message?.toLowerCase().includes('connection')
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
