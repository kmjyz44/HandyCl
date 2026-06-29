import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRequest = async () => {
    if (!email.trim()) { setErrorMsg('Enter your email'); return; }
    setErrorMsg('');
    setLoading(true);
    try {
      await api.passwordRecoveryRequest({ email: email.trim().toLowerCase() });
      showAlert('Check your email', 'If the account exists, we sent a 6-digit reset code.');
      setStep('reset');
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.detail || 'Could not send the reset code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code.trim() || !newPassword) { setErrorMsg('Enter the code and a new password'); return; }
    if (newPassword.length < 6) { setErrorMsg('Password must be at least 6 characters'); return; }
    setErrorMsg('');
    setLoading(true);
    try {
      await api.passwordRecoveryVerify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: newPassword,
      });
      showAlert('Password updated', 'You can now sign in with your new password.');
      router.replace('/login');
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.detail || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="forgot-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="lock-closed" size={56} color="#2563eb" />
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Enter your email and we will send a reset code.'
              : `Enter the code we sent to ${email} and your new password.`}
          </Text>
        </View>

        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {step === 'request' ? (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  data-testid="forgot-email-input"
                />
              </View>
              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRequest} disabled={loading} data-testid="forgot-send-code-btn">
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  data-testid="forgot-code-input"
                />
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  data-testid="forgot-new-password-input"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading} data-testid="forgot-reset-btn">
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset password</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRequest} style={styles.linkContainer} disabled={loading} data-testid="forgot-resend-link">
                <Text style={styles.linkText}>Didn't get it? <Text style={styles.link}>Resend code</Text></Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkContainer}>
            <Text style={styles.linkText}>Remembered it? <Text style={styles.link}>Back to sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backBtn: { position: 'absolute', top: 16, left: 16, padding: 8 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', marginTop: 16 },
  subtitle: { fontSize: 15, color: '#6b7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 8 },
  form: { width: '100%' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, fontSize: 16, color: '#111827' },
  eyeIcon: { padding: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  linkContainer: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 14, color: '#6b7280' },
  link: { color: '#2563eb', fontWeight: '600' },
});
