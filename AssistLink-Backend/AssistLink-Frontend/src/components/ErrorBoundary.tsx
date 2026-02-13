/**
 * React Error Boundary Component
 * Catches unhandled errors in component tree and displays fallback UI
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface Props {
    children: ReactNode;
    fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);

        // Update state with error details
        this.setState({
            error,
            errorInfo
        });

        // TODO: Send error to error tracking service (Sentry, LogRocket, etc.)
        // logErrorToService(error, errorInfo);
    }

    resetError = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback && this.state.error) {
                return this.props.fallback(this.state.error, this.resetError);
            }

            // Default error UI
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Icon name="alert-circle-outline" size={64} color="#DC2626" />

                        <Text style={styles.title}>Oops! Something went wrong</Text>

                        <Text style={styles.message}>
                            We're sorry for the inconvenience. The app encountered an unexpected error.
                        </Text>

                        {__DEV__ && this.state.error && (
                            <ScrollView style={styles.errorDetails}>
                                <Text style={styles.errorTitle}>Error Details (Dev Mode):</Text>
                                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.errorText}>{this.state.errorInfo.componentStack}</Text>
                                )}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.resetError}
                        >
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => {
                                // Navigate to home or reload app
                                console.log('Navigate to home');
                            }}
                        >
                            <Text style={styles.linkText}>Go to Home</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F9F6',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        alignItems: 'center',
        maxWidth: 400,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginTop: 20,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#7A7A7A',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    errorDetails: {
        maxHeight: 200,
        width: '100%',
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        padding: 12,
        marginBottom: 24,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#DC2626',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#991B1B',
        fontFamily: 'monospace',
    },
    button: {
        backgroundColor: '#059669',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginBottom: 12,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    linkButton: {
        paddingVertical: 8,
    },
    linkText: {
        color: '#059669',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default ErrorBoundary;
