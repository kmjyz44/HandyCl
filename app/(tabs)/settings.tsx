import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setStripeConfigured(data.stripe_configured);
      setTelegramConfigured(data.telegram_configured);
      setAiEnabled(data.ai_enabled);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {};
      if (stripeKey) updates.stripe_api_key = stripeKey;
      if (telegramToken) updates.telegram_bot_token = telegramToken;
      updates.ai_enabled = aiEnabled;

      await api.updateSettings(updates);
      Alert.alert('Success', 'Settings saved successfully');
      setStripeKey('');
      setTelegramToken('');
      loadSettings();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Configure API keys and integrations</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Integration</Text>
          <View style={styles.card}>
            <View style={styles.integrationHeader}>
              <Ionicons name="card" size={32} color="#635bff" />
              <View style={styles.integrationInfo}>
                <Text style={styles.integrationName}>Stripe</Text>
                <Text style={styles.integrationDescription}>
                  Process payments securely
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: stripeConfigured ? '#d1fae5' : '#fee2e2' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: stripeConfigured ? '#10b981' : '#ef4444' },
                  ]}
                >
                  {stripeConfigured ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Stripe API Key</Text>
            <TextInput
              style={styles.input}
              value={stripeKey}
              onChangeText={setStripeKey}
              placeholder="sk_test_..."
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Get your API key from{' '}
              <Text style={styles.link}>https://dashboard.stripe.com/apikeys</Text>
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telegram Notifications</Text>
          <View style={styles.card}>
            <View style={styles.integrationHeader}>
              <Ionicons name="paper-plane" size={32} color="#0088cc" />
              <View style={styles.integrationInfo}>
                <Text style={styles.integrationName}>Telegram Bot</Text>
                <Text style={styles.integrationDescription}>
                  Send task notifications
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: telegramConfigured ? '#d1fae5' : '#fee2e2' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: telegramConfigured ? '#10b981' : '#ef4444' },
                  ]}
                >
                  {telegramConfigured ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Bot Token</Text>
            <TextInput
              style={styles.input}
              value={telegramToken}
              onChangeText={setTelegramToken}
              placeholder="123456:ABC-DEF..."
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Create a bot via @BotFather on Telegram to get your token
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Features</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => setAiEnabled(!aiEnabled)}
            >
              <View style={styles.switchInfo}>
                <Ionicons name="bulb" size={24} color="#f59e0b" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.switchLabel}>Enable AI Features</Text>
                  <Text style={styles.switchDescription}>
                    AI-powered recommendations and automation
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.switch,
                  { backgroundColor: aiEnabled ? '#2563eb' : '#d1d5db' },
                ]}
              >
                <View
                  style={[
                    styles.switchThumb,
                    { transform: [{ translateX: aiEnabled ? 20 : 0 }] },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2563eb" />
          <Text style={styles.infoText}>
            All API keys are stored securely and encrypted. Keys are never exposed in
            responses.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  integrationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  integrationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  integrationDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  link: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  switchDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});
