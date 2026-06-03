import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert, showConfirm } from '../utils/alert';

type AccountType = 'bank' | 'card';

export default function PayoutSetup() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<AccountType>('card');

  // shared
  const [holderName, setHolderName] = useState('');
  // card
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  // bank
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const load = async () => {
    try {
      const list = await api.getPayoutAccounts();
      setAccounts(Array.isArray(list) ? list : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setHolderName('');
    setCardNumber(''); setCardExpMonth(''); setCardExpYear(''); setCardCvc('');
    setBankName(''); setRoutingNumber(''); setAccountNumber('');
  };

  const submit = async () => {
    if (!holderName.trim()) {
      showAlert('Помилка', "Введіть ім'я власника");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        account_type: tab,
        account_holder_name: holderName.trim(),
      };
      if (tab === 'card') {
        payload.card_number = cardNumber.replace(/\s+/g, '');
        payload.card_exp_month = parseInt(cardExpMonth, 10);
        payload.card_exp_year = parseInt(cardExpYear, 10);
        payload.card_cvc = cardCvc;
      } else {
        payload.bank_name = bankName.trim();
        payload.routing_number = routingNumber.replace(/\D/g, '');
        payload.account_number = accountNumber.replace(/\D/g, '');
      }
      await api.createPayoutAccount(payload);
      showAlert('Готово', 'Спосіб виплати додано');
      reset();
      load();
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || e?.message || 'Не вдалося зберегти');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    showConfirm(
      'Видалити?',
      'Цей спосіб буде видалено зі способів виплат.',
      async () => {
        try {
          await api.deletePayoutAccount(id);
          load();
        } catch (e: any) {
          showAlert('Помилка', e?.message || 'Не вдалось видалити');
        }
      },
      'Видалити',
      'Скасувати',
    );
  };

  const makeDefault = async (id: string) => {
    try {
      await api.setDefaultPayoutAccount(id);
      load();
    } catch (e: any) {
      showAlert('Помилка', e?.message || 'Не вдалось зберегти');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Спосіб виплати' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={styles.h1}>Куди ми переказуватимемо ваші гроші</Text>
        <Text style={styles.sub}>
          Введіть номер дебетової картки або реквізити банківського рахунку.
          Ми зберігаємо лише останні 4 цифри. Повний номер буде використано
          для безпечного підключення до платіжного процесора.
        </Text>

        {/* Existing accounts */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />
        ) : accounts.length > 0 ? (
          <View style={styles.list}>
            <Text style={styles.h2}>Збережені реквізити</Text>
            {accounts.map((a) => (
              <View key={a.account_id} style={styles.acc} data-testid={`payout-account-${a.account_id}`}>
                <View style={styles.accIcon}>
                  <Ionicons
                    name={a.account_type === 'card' ? 'card' : 'business'}
                    size={20}
                    color="#2563eb"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accTitle}>
                    {a.account_type === 'card'
                      ? `${(a.card_brand || 'Картка').toUpperCase()} •••• ${a.card_last4}`
                      : `${a.bank_name || 'Банк'} •••• ${a.account_number_last4}`}
                  </Text>
                  <Text style={styles.accSub}>
                    {a.account_holder_name || '—'} · {a.is_default ? 'Основний' : 'Резерв'}
                    {a.is_verified ? ' · ✓' : ' · очікує верифікації'}
                  </Text>
                </View>
                {!a.is_default && (
                  <TouchableOpacity onPress={() => makeDefault(a.account_id)} style={styles.accBtn} data-testid={`set-default-${a.account_id}`}>
                    <Text style={styles.accBtnText}>Основний</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => remove(a.account_id)} style={[styles.accBtn, styles.accBtnDanger]} data-testid={`delete-${a.account_id}`}>
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'card' && styles.tabActive]}
            onPress={() => setTab('card')}
            data-testid="tab-card"
          >
            <Ionicons name="card-outline" size={18} color={tab === 'card' ? '#fff' : '#374151'} />
            <Text style={[styles.tabText, tab === 'card' && styles.tabTextActive]}>Дебетова картка</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'bank' && styles.tabActive]}
            onPress={() => setTab('bank')}
            data-testid="tab-bank"
          >
            <Ionicons name="business-outline" size={18} color={tab === 'bank' ? '#fff' : '#374151'} />
            <Text style={[styles.tabText, tab === 'bank' && styles.tabTextActive]}>Банк (ACH)</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Ім'я власника рахунку</Text>
          <TextInput
            value={holderName}
            onChangeText={setHolderName}
            placeholder="John Doe"
            style={styles.input}
            data-testid="payout-holder-name"
          />

          {tab === 'card' ? (
            <>
              <Text style={styles.label}>Номер дебетової картки</Text>
              <TextInput
                value={cardNumber}
                onChangeText={(t) => setCardNumber(t.replace(/[^\d\s]/g, ''))}
                placeholder="4242 4242 4242 4242"
                keyboardType="number-pad"
                style={styles.input}
                data-testid="payout-card-number"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Місяць (MM)</Text>
                  <TextInput
                    value={cardExpMonth}
                    onChangeText={(t) => setCardExpMonth(t.replace(/\D/g, '').slice(0, 2))}
                    placeholder="12"
                    keyboardType="number-pad"
                    style={styles.input}
                    data-testid="payout-card-exp-month"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Рік (YYYY)</Text>
                  <TextInput
                    value={cardExpYear}
                    onChangeText={(t) => setCardExpYear(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2028"
                    keyboardType="number-pad"
                    style={styles.input}
                    data-testid="payout-card-exp-year"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>CVC</Text>
                  <TextInput
                    value={cardCvc}
                    onChangeText={(t) => setCardCvc(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    keyboardType="number-pad"
                    style={styles.input}
                    secureTextEntry
                    data-testid="payout-card-cvc"
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Назва банку</Text>
              <TextInput
                value={bankName}
                onChangeText={setBankName}
                placeholder="Chase, Wells Fargo, ..."
                style={styles.input}
                data-testid="payout-bank-name"
              />
              <Text style={styles.label}>Routing number (9 цифр)</Text>
              <TextInput
                value={routingNumber}
                onChangeText={(t) => setRoutingNumber(t.replace(/\D/g, '').slice(0, 9))}
                placeholder="110000000"
                keyboardType="number-pad"
                style={styles.input}
                data-testid="payout-routing-number"
              />
              <Text style={styles.label}>Account number</Text>
              <TextInput
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 17))}
                placeholder="000123456789"
                keyboardType="number-pad"
                style={styles.input}
                data-testid="payout-account-number"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={submit}
            disabled={saving}
            data-testid="save-payout-method-btn"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Зберегти спосіб виплати</Text>}
          </TouchableOpacity>

          <Text style={styles.helper}>
            🔒 Дані захищено. Після підключення Stripe Connect ваші кошти автоматично
            переказуватимуться на цю картку/рахунок після кожного виконаного завдання.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  h1: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
  list: { marginBottom: 16 },
  acc: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  accIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center',
  },
  accTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  accSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  accBtn: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  accBtnDanger: { backgroundColor: '#fef2f2' },
  accBtnText: { fontSize: 11, color: '#374151', fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
    backgroundColor: '#fff',
  },
  saveBtn: {
    marginTop: 16, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  helper: { fontSize: 11, color: '#6b7280', marginTop: 10, lineHeight: 16 },
});
