import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
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
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [connectLoading, setConnectLoading] = useState(false);

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

  const [paypalEmail, setPaypalEmail] = useState('');
  const [zelleHandle, setZelleHandle] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');
  const [savingContacts, setSavingContacts] = useState(false);
  // Methods the admin has enabled — executors only see/configure these
  const [enabledMethods, setEnabledMethods] = useState<string[]>([]);
  const [finixStatus, setFinixStatus] = useState<any>(null);
  const [finixLoading, setFinixLoading] = useState(false);
  const [showFinixForm, setShowFinixForm] = useState(false);
  const [finixFormError, setFinixFormError] = useState('');
  const [kyc, setKyc] = useState({
    first_name: '', last_name: '', dob: '', ssn: '',
    line1: '', city: '', region: '', postal_code: '',
    bank_account_number: '', bank_routing_number: '',
  });

  const load = async () => {
    try {
      const list = await api.getPayoutAccounts();
      setAccounts(Array.isArray(list) ? list : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
    try {
      const m = await api.getPaymentMethods();
      const ids = (m?.methods || []).map((x: any) => x.id);
      setEnabledMethods(ids);
      if (ids.includes('finix')) {
        try { setFinixStatus(await api.finixExecutorStatus()); } catch {}
      }
    } catch {}
    try {
      const c = await api.getTaskerPayoutContacts();
      setPaypalEmail(c?.paypal_email || '');
      setZelleHandle(c?.zelle_handle || '');
      setVenmoHandle(c?.venmo_handle || '');
    } catch {}
  };

  const onboardFinix = async () => {
    // If already onboarded, just refresh status; otherwise collect KYC.
    if (finixStatus?.onboarded) {
      setFinixLoading(true);
      try { setFinixStatus(await api.finixExecutorStatus()); } catch {}
      setFinixLoading(false);
      return;
    }
    setShowFinixForm(true);
  };

  const submitFinixOnboard = async () => {
    const k = kyc;
    setFinixFormError('');
    const fail = (m: string) => { setFinixFormError(m); return; };
    if (!k.first_name.trim() || !k.last_name.trim()) return fail('Please enter your first and last name');
    const dobMatch = k.dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dobMatch) return fail('Date of birth must be in MM/DD/YYYY format');
    if (!/^\d{9}$/.test(k.ssn.replace(/\D/g, ''))) return fail('SSN / Tax ID must contain exactly 9 digits');
    if (!k.line1.trim() || !k.city.trim() || !k.region.trim() || !k.postal_code.trim())
      return fail('Please fill in the full address (street, city, state, ZIP)');
    const acct = k.bank_account_number.replace(/\D/g, '');
    const routing = k.bank_routing_number.replace(/\D/g, '');
    if (!/^\d{6,17}$/.test(acct)) return fail('Invalid account number (6–17 digits)');
    if (!/^\d{9}$/.test(routing)) return fail('Routing number must contain exactly 9 digits');
    if (acct === routing) return fail('Account number and routing number must be different. Tip: use a sandbox routing like 122105155.');

    setFinixLoading(true);
    try {
      const r = await api.finixOnboardExecutor({
        first_name: k.first_name.trim(),
        last_name: k.last_name.trim(),
        dob: { month: Number(dobMatch[1]), day: Number(dobMatch[2]), year: Number(dobMatch[3]) },
        tax_id: k.ssn.replace(/\D/g, ''),
        business_type: 'INDIVIDUAL_SOLE_PROPRIETORSHIP',
        address: { line1: k.line1.trim(), city: k.city.trim(), region: k.region.trim().toUpperCase(), postal_code: k.postal_code.trim(), country: 'USA' },
        bank_account_number: acct,
        bank_routing_number: routing,
      } as any);
      setFinixStatus({ onboarded: true, merchant_id: r.merchant_id, onboarding_state: r.onboarding_state });
      setShowFinixForm(false);
      setFinixFormError('');
      showAlert('Done', r.onboarding_state === 'APPROVED'
        ? "Finix payouts are active — you're ready to accept payments."
        : 'Application submitted. Finix is reviewing your data — the status will update automatically (usually within a minute).');
    } catch (e: any) {
      setFinixFormError(e?.response?.data?.detail || 'Could not connect Finix. Please check your details and try again.');
    } finally {
      setFinixLoading(false);
    }
  };

  const saveContacts = async () => {
    setSavingContacts(true);
    try {
      await api.updateTaskerPayoutContacts({
        paypal_email: paypalEmail.trim(),
        zelle_handle: zelleHandle.trim(),
        venmo_handle: venmoHandle.trim(),
      });
      showAlert('Done', 'Contacts saved. Clients will see them at payment.');
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not save');
    } finally {
      setSavingContacts(false);
    }
  };

  const loadConnectStatus = async () => {
    try {
      const r = await api.stripeConnectStatus();
      setConnectStatus(r);
    } catch {
      setConnectStatus(null);
    }
  };

  useEffect(() => {
    load();
    loadConnectStatus();
    // If user just returned from Stripe onboarding (?stripe_return=1), re-check status
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('stripe_return')) {
      setTimeout(loadConnectStatus, 1500);
    }
  }, []);

  const startStripeConnect = async () => {
    setConnectLoading(true);
    try {
      const r = await api.stripeConnectOnboard();
      if (!r?.url) throw new Error('No onboarding URL returned');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = r.url;
      } else {
        const { Linking } = await import('react-native');
        await Linking.openURL(r.url);
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || e?.message || 'Could not start onboarding');
    } finally {
      setConnectLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const r = await api.stripeConnectDashboardLink();
      if (r?.url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.open(r.url, '_blank');
        } else {
          const { Linking } = await import('react-native');
          await Linking.openURL(r.url);
        }
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || e?.message || 'Could not open');
    }
  };

  const reset = () => {
    setHolderName('');
    setCardNumber(''); setCardExpMonth(''); setCardExpYear(''); setCardCvc('');
    setBankName(''); setRoutingNumber(''); setAccountNumber('');
  };

  const submit = async () => {
    if (!holderName.trim()) {
      showAlert('Error', 'Enter the account holder name');
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
      showAlert('Done', 'Payout method added');
      reset();
      load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    showConfirm(
      'Delete?',
      'This method will be removed from your payout methods.',
      async () => {
        try {
          await api.deletePayoutAccount(id);
          load();
        } catch (e: any) {
          showAlert('Error', e?.message || 'Could not delete');
        }
      },
      'Delete',
      'Cancel',
    );
  };

  const makeDefault = async (id: string) => {
    try {
      await api.setDefaultPayoutAccount(id);
      load();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not save');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Payout method' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={styles.h1}>Where we'll send your money</Text>
        <Text style={styles.sub}>
          Connect Stripe Connect — and funds will be automatically transferred to your card
          after each paid task. Stripe verifies your documents itself (5 min) — we
          don't need to do anything manually.
        </Text>

        {/* Stripe Connect — recommended (only if admin enabled Stripe) */}
        {enabledMethods.includes('stripe') && (
        <View style={[styles.connectCard, connectStatus?.charges_enabled && styles.connectCardActive]}>
          <View style={styles.connectHeader}>
            <View style={styles.connectIcon}>
              <Ionicons name="flash" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectTitle}>Stripe Connect (recommended)</Text>
              <Text style={styles.connectSub}>
                {connectStatus?.charges_enabled && connectStatus?.payouts_enabled
                  ? '✓ Active — funds will transfer automatically'
                  : connectStatus?.connected
                  ? '⏳ Connected, but onboarding needs to be completed'
                  : 'Complete onboarding once — and payouts are automatic'}
              </Text>
            </View>
          </View>
          {connectStatus?.charges_enabled && connectStatus?.payouts_enabled ? (
            <TouchableOpacity style={styles.connectBtnSecondary} onPress={openStripeDashboard} data-testid="open-stripe-dashboard-btn">
              <Text style={styles.connectBtnSecondaryText}>Open Stripe Dashboard</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.connectBtn, connectLoading && { opacity: 0.6 }]}
              onPress={startStripeConnect}
              disabled={connectLoading}
              data-testid="start-stripe-connect-btn"
            >
              {connectLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.connectBtnText}>
                  {connectStatus?.connected ? 'Continue onboarding' : 'Connect Stripe →'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Finix payouts onboarding (only if admin enabled Finix) */}
        {enabledMethods.includes('finix') && (
        <View style={[styles.connectCard, finixStatus?.onboarding_state === 'APPROVED' && styles.connectCardActive]}>
          <View style={styles.connectHeader}>
            <View style={[styles.connectIcon, { backgroundColor: '#1a8917' }]}>
              <Ionicons name="card" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectTitle}>Finix (auto-split, USA)</Text>
              <Text style={styles.connectSub}>
                {finixStatus?.onboarding_state === 'APPROVED'
                  ? '✓ Active — your share will arrive automatically'
                  : finixStatus?.onboarded
                  ? '⏳ Application submitted, awaiting Finix approval'
                  : 'Connect once — and receive your share automatically'}
              </Text>
            </View>
          </View>
          {finixStatus?.onboarding_state !== 'APPROVED' && (
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: '#1a8917' }, finixLoading && { opacity: 0.6 }]}
              onPress={onboardFinix}
              disabled={finixLoading}
              data-testid="finix-onboard-btn"
            >
              {finixLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.connectBtnText}>
                  {finixStatus?.onboarded ? 'Check status' : 'Connect Finix payouts →'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        )}

        {/* Manual / alternative payout methods — hidden when admin has enabled Finix (Finix-only payouts) */}
        {!enabledMethods.includes('finix') && (
        <>
        <Text style={styles.dividerLabel}>or save details manually (for reference)</Text>

        {/* PayPal / Zelle / Venmo contacts — for manual-split methods */}
        <View style={styles.altCard}>
          <Text style={styles.altTitle}>Alternative payout methods</Text>
          <Text style={styles.altSub}>
            If a client chooses PayPal / Zelle / Venmo — they will send money directly to these accounts.
          </Text>
          {enabledMethods.includes('paypal') && (<>
          <Text style={styles.label}>PayPal email</Text>
          <TextInput
            value={paypalEmail}
            onChangeText={setPaypalEmail}
            placeholder="you@paypal.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            data-testid="paypal-email-input"
          />
          </>)}
          {enabledMethods.includes('zelle') && (<>
          <Text style={styles.label}>Zelle (email or phone)</Text>
          <TextInput
            value={zelleHandle}
            onChangeText={setZelleHandle}
            placeholder="you@bank.com or +1 234 567 8900"
            autoCapitalize="none"
            style={styles.input}
            data-testid="zelle-handle-input"
          />
          </>)}
          {enabledMethods.includes('venmo') && (<>
          <Text style={styles.label}>Venmo username (without @)</Text>
          <TextInput
            value={venmoHandle}
            onChangeText={setVenmoHandle}
            placeholder="your-venmo-name"
            autoCapitalize="none"
            style={styles.input}
            data-testid="venmo-handle-input"
          />
          </>)}
          <TouchableOpacity
            style={[styles.saveBtn, savingContacts && { opacity: 0.5 }, { marginTop: 12 }]}
            onPress={saveContacts}
            disabled={savingContacts}
            data-testid="save-payout-contacts-btn"
          >
            {savingContacts ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save contacts</Text>}
          </TouchableOpacity>
        </View>

        {/* Existing accounts */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} color="#2563eb" />
        ) : accounts.length > 0 ? (
          <View style={styles.list}>
            <Text style={styles.h2}>Saved details</Text>
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
                      ? `${(a.card_brand || 'Card').toUpperCase()} •••• ${a.card_last4}`
                      : `${a.bank_name || 'Bank'} •••• ${a.account_number_last4}`}
                  </Text>
                  <Text style={styles.accSub}>
                    {a.account_holder_name || '—'} · {a.is_default ? 'Primary' : 'Backup'}
                    {a.is_verified ? ' · ✓' : ' · awaiting verification'}
                  </Text>
                </View>
                {!a.is_default && (
                  <TouchableOpacity onPress={() => makeDefault(a.account_id)} style={styles.accBtn} data-testid={`set-default-${a.account_id}`}>
                    <Text style={styles.accBtnText}>Primary</Text>
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
            <Text style={[styles.tabText, tab === 'card' && styles.tabTextActive]}>Debit card</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'bank' && styles.tabActive]}
            onPress={() => setTab('bank')}
            data-testid="tab-bank"
          >
            <Ionicons name="business-outline" size={18} color={tab === 'bank' ? '#fff' : '#374151'} />
            <Text style={[styles.tabText, tab === 'bank' && styles.tabTextActive]}>Bank (ACH)</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Account holder name</Text>
          <TextInput
            value={holderName}
            onChangeText={setHolderName}
            placeholder="John Doe"
            style={styles.input}
            data-testid="payout-holder-name"
          />

          {tab === 'card' ? (
            <>
              <Text style={styles.label}>Debit card number</Text>
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
                  <Text style={styles.label}>Month (MM)</Text>
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
                  <Text style={styles.label}>Year (YYYY)</Text>
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
              <Text style={styles.label}>Bank name</Text>
              <TextInput
                value={bankName}
                onChangeText={setBankName}
                placeholder="Chase, Wells Fargo, ..."
                style={styles.input}
                data-testid="payout-bank-name"
              />
              <Text style={styles.label}>Routing number (9 digits)</Text>
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save payout method</Text>}
          </TouchableOpacity>

          <Text style={styles.helper}>
            🔒 Your data is protected. After connecting Stripe Connect, your funds will automatically
            be transferred to this card/account after each completed task.
          </Text>
        </View>
        </>
        )}
      </ScrollView>

      {/* Finix KYC onboarding form */}
      <Modal visible={showFinixForm} animationType="slide" transparent>
        <View style={fx.overlay}>
          <View style={fx.sheet}>
            <View style={fx.sheetHeader}>
              <Text style={fx.sheetTitle}>Connect Finix payouts</Text>
              <TouchableOpacity onPress={() => { if (!finixLoading) { setShowFinixForm(false); setFinixFormError(''); } }} data-testid="finix-form-close">
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={fx.note}>Finix (USA) requires this data to verify the payout recipient. Data is sent directly to Finix.</Text>
              <View style={fx.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={fx.lbl}>First name</Text>
                  <TextInput style={fx.inp} value={kyc.first_name} onChangeText={(v) => setKyc({ ...kyc, first_name: v })} placeholder="Oleh" data-testid="kyc-first-name" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fx.lbl}>Last name</Text>
                  <TextInput style={fx.inp} value={kyc.last_name} onChangeText={(v) => setKyc({ ...kyc, last_name: v })} placeholder="Koval" data-testid="kyc-last-name" />
                </View>
              </View>
              <Text style={fx.lbl}>Date of birth (MM/DD/YYYY)</Text>
              <TextInput style={fx.inp} value={kyc.dob} onChangeText={(v) => setKyc({ ...kyc, dob: v })} placeholder="07/15/1988" keyboardType="numbers-and-punctuation" data-testid="kyc-dob" />
              <Text style={fx.lbl}>SSN / Tax ID (9 digits)</Text>
              <TextInput style={fx.inp} value={kyc.ssn} onChangeText={(v) => setKyc({ ...kyc, ssn: v })} placeholder="123456789" keyboardType="number-pad" data-testid="kyc-ssn" />
              <Text style={fx.lbl}>Address</Text>
              <TextInput style={fx.inp} value={kyc.line1} onChangeText={(v) => setKyc({ ...kyc, line1: v })} placeholder="123 Market St" data-testid="kyc-line1" />
              <View style={fx.row2}>
                <View style={{ flex: 2 }}>
                  <Text style={fx.lbl}>City</Text>
                  <TextInput style={fx.inp} value={kyc.city} onChangeText={(v) => setKyc({ ...kyc, city: v })} placeholder="San Francisco" data-testid="kyc-city" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fx.lbl}>State</Text>
                  <TextInput style={fx.inp} value={kyc.region} onChangeText={(v) => setKyc({ ...kyc, region: v })} placeholder="CA" autoCapitalize="characters" maxLength={2} data-testid="kyc-region" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fx.lbl}>ZIP</Text>
                  <TextInput style={fx.inp} value={kyc.postal_code} onChangeText={(v) => setKyc({ ...kyc, postal_code: v })} placeholder="94103" keyboardType="number-pad" data-testid="kyc-zip" />
                </View>
              </View>
              <Text style={[fx.lbl, { marginTop: 8, color: '#1a8917' }]}>Payout bank</Text>
              <Text style={fx.lbl}>Account number</Text>
              <TextInput style={fx.inp} value={kyc.bank_account_number} onChangeText={(v) => setKyc({ ...kyc, bank_account_number: v })} placeholder="123123123" keyboardType="number-pad" data-testid="kyc-account" />
              <Text style={fx.lbl}>Routing number (9 digits)</Text>
              <TextInput style={fx.inp} value={kyc.bank_routing_number} onChangeText={(v) => setKyc({ ...kyc, bank_routing_number: v })} placeholder="122105155 (test)" keyboardType="number-pad" data-testid="kyc-routing" />
            </ScrollView>
            <View style={fx.footer}>
              {!!finixFormError && (
                <View style={fx.errBox} data-testid="finix-form-error">
                  <Text style={fx.errText}>{finixFormError}</Text>
                </View>
              )}
              <TouchableOpacity style={[fx.btn, { backgroundColor: '#1a8917' }, finixLoading && { opacity: 0.6 }]} onPress={submitFinixOnboard} disabled={finixLoading} data-testid="kyc-submit">
                {finixLoading ? <ActivityIndicator color="#fff" /> : <Text style={fx.btnText}>Connect payouts</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  connectCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: '#635bff',
  },
  connectCardActive: { borderColor: '#22c55e' },
  connectHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  connectIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#635bff',
    alignItems: 'center', justifyContent: 'center',
  },
  connectTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  connectSub: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  connectBtn: {
    backgroundColor: '#635bff', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  connectBtnSecondary: {
    backgroundColor: '#ecfdf5', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#86efac',
  },
  connectBtnSecondaryText: { color: '#16a34a', fontSize: 13, fontWeight: '700' },

  dividerLabel: {
    fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  altCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  altTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  altSub: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 8, lineHeight: 17 },
});


const fx = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  note: { fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 17 },
  row2: { flexDirection: 'row', gap: 8 },
  lbl: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 4 },
  inp: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  errBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 12 },
  errText: { color: '#dc2626', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
