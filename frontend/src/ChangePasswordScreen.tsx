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
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from './BottomNav';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from './api/client';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';
import { accessibility as a11y, spacing } from './theme';

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
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="alert-circle" size={20} color="#FFF" accessibilityElementsHidden />
            <Text style={styles.errorText}>{error.message}</Text>
            <TouchableOpacity
                onPress={onDismiss}
                style={styles.errorDismiss}
                accessibilityLabel="Dismiss error"
                accessibilityRole="button"
                accessibilityHint="Removes the error message from the screen"
            >
                <MaterialCommunityIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
        </View>
    );
};

const MAX_FORM_WIDTH = 440;

export default function ChangePasswordScreen({ navigation }: any) {
    const { width } = useWindowDimensions();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { handleError, error, clearError } = useErrorHandler();
    const formMaxWidth = width > MAX_FORM_WIDTH ? MAX_FORM_WIDTH : undefined;

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
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                        accessibilityHint="Returns to the previous screen"
                    >
                        <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} accessibilityRole="header">Change Password</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ErrorBanner error={error} onDismiss={clearError} />

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, formMaxWidth && { maxWidth: formMaxWidth, alignSelf: 'center' }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
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
                            <MaterialCommunityIcons name="lock-outline" size={20} color={THEME.subText} style={styles.inputIcon} accessibilityElementsHidden />
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
                                accessibilityLabel="Current password"
                                accessibilityHint="Enter your current password. Optional if you signed in with Google."
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.visibilityToggle}
                                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                accessibilityRole="button"
                                accessibilityState={{ checked: showPassword }}
                            >
                                <MaterialCommunityIcons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={24}
                                    color={THEME.subText}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-plus-outline" size={20} color={THEME.subText} style={styles.inputIcon} accessibilityElementsHidden />
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
                                accessibilityLabel="New password"
                                accessibilityHint="At least 6 characters"
                            />
                        </View>

                        <Text style={styles.label}>Confirm New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-check-outline" size={20} color={THEME.subText} style={styles.inputIcon} accessibilityElementsHidden />
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
                                accessibilityLabel="Confirm new password"
                                accessibilityHint="Re-enter your new password"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                            onPress={handleChangePassword}
                            disabled={loading}
                            accessibilityLabel="Update password"
                            accessibilityRole="button"
                            accessibilityHint="Saves your new password"
                            accessibilityState={{ disabled: loading }}
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
            <BottomNav />
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
        minWidth: a11y.minTouchTargetSize,
        minHeight: a11y.minTouchTargetSize,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    headerSpacer: {
        width: a11y.minTouchTargetSize,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 32,
        alignItems: 'center',
        flexGrow: 1,
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
        minHeight: a11y.minTouchTargetSize,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: THEME.text,
        minHeight: a11y.minTouchTargetSize,
        paddingVertical: 12,
    },
    visibilityToggle: {
        minWidth: a11y.minTouchTargetSize,
        minHeight: a11y.minTouchTargetSize,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtn: {
        backgroundColor: THEME.primary,
        borderRadius: 12,
        minHeight: a11y.minTouchTargetSize,
        paddingVertical: spacing.md,
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
        padding: spacing.sm,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderRadius: 8,
    },
    errorText: {
        color: '#FFF',
        marginLeft: spacing.sm,
        flex: 1,
        fontSize: 14,
    },
    errorDismiss: {
        minWidth: a11y.minTouchTargetSize,
        minHeight: a11y.minTouchTargetSize,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
