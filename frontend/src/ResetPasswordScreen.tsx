import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';

const THEME = {
    primary: '#059669',
    bg: '#F5F7FA',
    card: '#FFFFFF',
    text: '#1F2937',
    subText: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
};

import { useErrorHandler } from './hooks/useErrorHandler';

export default function ResetPasswordScreen({ route, navigation }: any) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { updatePassword } = useAuth();
    const { handleError, error, clearError } = useErrorHandler();

    // In a real flow, the token would be handled by AuthContext or Supabase implicitly
    // after the deep link sets the session.

    const handleResetPassword = async () => {
        clearError();

        if (!newPassword || !confirmPassword) {
            handleError(new Error('Please fill in all fields'), 'validation');
            return;
        }

        if (newPassword.length < 6) {
            handleError(new Error('Password must be at least 6 characters long'), 'validation');
            return;
        }

        if (newPassword !== confirmPassword) {
            handleError(new Error('Passwords do not match'), 'validation');
            return;
        }

        setLoading(true);
        try {
            // Note: Since this is recovery flow, we don't have current_password.
            // We should use a different method that only takes newPassword.
            // I'll update AuthContext to handle this.
            await updatePassword('', newPassword); // Passing empty for current_password if recovery
            Alert.alert('Success', 'Password has been reset successfully. Please log in with your new password.', [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
            ]);
        } catch (error: any) {
            handleError(error, 'reset-password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Reset Password</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="lock-open-check" size={64} color={THEME.primary} />
                    </View>

                    <Text style={styles.description}>
                        Create a new password for your account. Choose a strong password that you haven't used before.
                    </Text>

                    {error && (
                        <View style={{ marginBottom: 20, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, width: '100%' }}>
                            <Text style={{ color: '#DC2626', textAlign: 'center' }}>{error.message}</Text>
                        </View>
                    )}

                    <View style={styles.form}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-outline" size={20} color={THEME.subText} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter new password"
                                secureTextEntry={!showPassword}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <MaterialCommunityIcons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color={THEME.subText}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Confirm New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-check-outline" size={20} color={THEME.subText} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm new password"
                                secureTextEntry={!showPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                            onPress={handleResetPassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Reset Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: THEME.card,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    backBtn: {
        padding: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
    },
    scrollContent: {
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E0F2F1',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    description: {
        fontSize: 16,
        color: THEME.subText,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: THEME.text,
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 20,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: THEME.text,
    },
    submitBtn: {
        backgroundColor: THEME.primary,
        borderRadius: 12,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: THEME.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
