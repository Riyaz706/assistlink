import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MIN_TOUCH = 48;
const FONT_BODY = 16;

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

/**
 * Global ErrorBoundary — catches any uncaught render errors and prevents full crash.
 * Production: readable font sizes, 48px touch target, accessibility.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: any): State {
        return { hasError: true, errorMessage: error?.message || 'Unknown error' };
    }

    componentDidCatch(error: any, info: any) {
        console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
    }

    reset = () => this.setState({ hasError: false, errorMessage: '' });

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.message}>
                        {this.props.fallbackMessage || 'This section is temporarily unavailable.'}
                    </Text>
                    <Text style={styles.detail} numberOfLines={3}>
                        {this.state.errorMessage}
                    </Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={this.reset}
                        accessibilityLabel="Try again"
                        accessibilityRole="button"
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#0F172A',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F8FAFC',
        marginBottom: 8,
    },
    message: {
        fontSize: FONT_BODY,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 12,
    },
    detail: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#6366F1',
        paddingHorizontal: 28,
        minHeight: MIN_TOUCH,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: FONT_BODY,
    },
});

export default ErrorBoundary;
