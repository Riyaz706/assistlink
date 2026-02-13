import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useAuth } from './context/AuthContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    background: '#F4F9F6',
    primaryGreen: '#059669',
    darkText: '#1A1A1A',
    grayText: '#7A7A7A',
    inputBorder: '#E8E8E8',
    inputBackground: '#FFFFFF',
    placeholder: '#A0A0A0',
};

const ForgotPasswordScreen = ({ navigation }: any) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { resetPassword } = useAuth();

    const handleResetPassword = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await resetPassword(email.trim());
            Alert.alert(
                'Check Your Email',
                'If an account exists with this email, you will receive password reset instructions shortly.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (e: any) {
            setError(e?.message || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>

                    {/* Header Back Button */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Icon name="arrow-left" size={26} color={COLORS.darkText} />
                        </TouchableOpacity>
                    </View>

                    {/* Icon Section */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconBackground}>
                            <Icon name="lock-reset" size={48} color={COLORS.primaryGreen} />
                        </View>
                    </View>

                    {/* Title and Subtitle */}
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Forgot Password?</Text>
                        <Text style={styles.subtitle}>
                            No worries! Enter your email address and we'll send you instructions to reset your password.
                        </Text>
                    </View>

                    {/* Input Field */}
                    <View style={styles.formContainer}>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputContainer}>
                                <Icon name="email-outline" size={20} color={COLORS.placeholder} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor={COLORS.placeholder}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                            activeOpacity={0.8}
                            onPress={handleResetPassword}
                            disabled={loading}
                        >
                            <Text style={styles.resetButtonText}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Back to Login Link */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backText}>
                                <Icon name="arrow-left" size={16} color={COLORS.primaryGreen} />
                                {' '}Back to Login
                            </Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 30,
    },
    header: {
        marginTop: Platform.OS === 'android' ? 20 : 10,
        marginBottom: 20,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconBackground: {
        width: 100,
        height: 100,
        backgroundColor: '#D0F0D0',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.darkText,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.grayText,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    formContainer: {
        marginBottom: 24,
    },
    inputWrapper: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.darkText,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 56,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: '100%',
        color: COLORS.darkText,
        fontSize: 16,
    },
    errorText: {
        color: '#DC2626',
        marginBottom: 12,
        fontSize: 14,
        textAlign: 'center',
    },
    resetButton: {
        backgroundColor: COLORS.primaryGreen,
        borderRadius: 12,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primaryGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    resetButtonDisabled: {
        opacity: 0.6,
    },
    resetButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
    },
    backText: {
        color: COLORS.primaryGreen,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ForgotPasswordScreen;
