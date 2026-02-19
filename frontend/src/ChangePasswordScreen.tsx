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
import { api } from './api/client';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';

const THEME = {
    primary: '#059669',
    bg: '#F5F7FA',
    card: '#FFFFFF',
    text: '#1F2937',
    subText: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
};

const ErrorBanner = ({ error, onDismiss }: { error: ErrorDetails | null, onDismiss: () => void }) => {
    if (!error) return null;
    return (
        <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#FFF" />
            <Text style={styles.errorText}>{error.message}</Text>
            <TouchableOpacity onPress={onDismiss}>
                <MaterialCommunityIcons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
        </View>
    );
};

export default function ChangePasswordScreen({ navigation }: any) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { handleError, error, clearError } = useErrorHandler();

    const handleChangePassword = async () => {
        clearError();
        // For OAuth users, current password can be empty
        if (!newPassword || !confirmPassword) {
            handleError(new Error('Please fill in the new password fields'), 'validation');
            return;
        }

        if (newPassword.length < 6) {
            handleError(new Error('New password must be at least 6 characters long'), 'validation');
            return;
        }

        if (newPassword !== confirmPassword) {
            handleError(new Error('New passwords do not match'), 'validation');
            return;
        }

        setLoading(true);
        try {
            await api.changePassword({
                current_password: currentPassword || undefined,
                new_password: newPassword
            });
            Alert.alert('Success', 'Password updated successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            handleError(error, 'change-password');
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Change Password</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ErrorBanner error={error} onDismiss={clearError} />

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="lock-reset" size={64} color={THEME.primary} />
                    </View>

                    <Text style={styles.description}>
                        Enter your current and new password below. The new password must be at least 6 characters long.
                        {'\n\n'}
                        <Text style={{ fontStyle: 'italic', fontSize: 14 }}>
                            Note: If you signed up with Google, you can leave the current password field empty.
                        </Text>
                    </Text>

                    <View style={styles.form}>
                        <Text style={styles.label}>Current Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-outline" size={20} color={THEME.subText} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter current password"
                                secureTextEntry={!showPassword}
                                value={currentPassword}
                                onChangeText={(text) => {
                                    setCurrentPassword(text);
                                    if (error) clearError();
                                }}
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

                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-plus-outline" size={20} color={THEME.subText} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter new password"
                                secureTextEntry={!showPassword}
                                value={newPassword}
                                onChangeText={(text) => {
                                    setNewPassword(text);
                                    if (error) clearError();
                                }}
                                autoCapitalize="none"
                            />
                        </View>

                        <Text style={styles.label}>Confirm New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-check-outline" size={20} color={THEME.subText} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm new password"
                                secureTextEntry={!showPassword}
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    if (error) clearError();
                                }}
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Update Password</Text>
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
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        padding: 10,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 8,
    },
    errorText: {
        color: '#FFF',
        marginLeft: 8,
        flex: 1,
        fontSize: 14,
    },
});
