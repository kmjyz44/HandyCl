import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { showConfirm, showAlert } from '../../utils/alert';
import { useAuthStore } from '../../store/authStore';

// Self-contained Leaflet map (OpenStreetMap, no API key) showing a provider's
// coverage center + service radius. Rendered inside an iframe srcDoc on web.
const buildProviderMapHtml = (lat: number, lng: number, radiusKm?: number | null) => {
  const r = radiusKm && radiusKm > 0 ? Math.round(radiusKm * 1000) : 0;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var lat=${lat}, lng=${lng}, r=${r};
var map=L.map('map',{zoomControl:true,attributionControl:false}).setView([lat,lng],11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
L.marker([lat,lng]).addTo(map);
if(r>0){var c=L.circle([lat,lng],{radius:r,color:'#2563eb',fillColor:'#3b82f6',fillOpacity:0.15,weight:2}).addTo(map);map.fitBounds(c.getBounds(),{padding:[18,18]});}
</script></body></html>`;
};


const ROLE_OPTIONS = [
  { value: 'client', label: 'Client', icon: 'person-outline', color: '#10b981' },
  { value: 'provider', label: 'Pro', icon: 'briefcase-outline', color: '#2563eb' },
  { value: 'admin', label: 'Administrator', icon: 'shield-checkmark-outline', color: '#f59e0b' },
  { value: 'moderator', label: 'Moderator', icon: 'ribbon-outline', color: '#8b5cf6' },
  { value: 'support', label: 'Support', icon: 'headset-outline', color: '#0ea5e9' },
] as const;

const roleMeta = (role: string) => ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[0];

export default function Users() {
  const currentUserId = useAuthStore((s) => s.user?.user_id);
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('');

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleTarget, setRoleTarget] = useState<any>(null);

  // ── Ranking hours (admin add/subtract per category) ──
  const [rankModalVisible, setRankModalVisible] = useState(false);
  const [rankTarget, setRankTarget] = useState<any>(null);
  const [rankData, setRankData] = useState<any>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankCategory, setRankCategory] = useState<string>('*');
  const [rankHours, setRankHours] = useState('');
  const [rankReason, setRankReason] = useState('');

  // ── Provider detail (coverage / skills / prices / availability) ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailProfile, setDetailProfile] = useState<any>(null);
  const [detailSlots, setDetailSlots] = useState<any[]>([]);
  const [detailClient, setDetailClient] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openUserDetail = async (user: any) => {
    if (user.role !== 'provider' && user.role !== 'client') return;
    setDetailUser(user);
    setDetailProfile(null);
    setDetailSlots([]);
    setDetailClient(null);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      if (user.role === 'provider') {
        const [profile, avail] = await Promise.all([
          api.getExecutorProfile(user.user_id).catch(() => null),
          api.adminGetAvailability(user.user_id).catch(() => ({ slots: [] })),
        ]);
        setDetailProfile(profile);
        setDetailSlots((avail?.slots || avail?.availability || []) as any[]);
      } else {
        const detail = await api.adminGetClientDetail(user.user_id).catch(() => null);
        setDetailClient(detail);
      }
    } catch {
      // leave empty
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadTermsPdf = async (user: any) => {
    try {
      const blob = await api.adminDownloadTermsPdf(user.user_id);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob as any);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terms-acceptance-${user.name || user.user_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        showAlert('Not supported', 'Download the acceptance PDF from the web admin.');
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to generate PDF');
    }
  };

  const downloadProviderAgreementPdf = async (user: any) => {
    try {
      const blob = await api.adminDownloadProviderAgreementPdf(user.user_id);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob as any);
        const a = document.createElement('a');
        a.href = url;
        a.download = `provider-agreement-${user.name || user.user_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        showAlert('Not supported', 'Download the agreement PDF from the web admin.');
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to generate PDF');
    }
  };

  const handleVerifyIdentity = async (user: any) => {
    showConfirm(
      'Verify identity',
      `Manually mark ${user.name || user.email} as identity-verified? Use this only for providers you have verified by other means.`,
      async () => {
        try {
          await api.adminVerifyIdentity(user.user_id);
          showAlert('Done', 'Provider marked as identity-verified.');
          loadUsers();
        } catch (e: any) {
          showAlert('Error', e?.response?.data?.detail || 'Failed to verify');
        }
      }
    );
  };

  const handleUnverifyIdentity = async (user: any) => {
    showConfirm(
      'Revoke identity verification',
      `Revoke identity verification for ${user.name || user.email}? They will be hidden from clients and unable to accept jobs until re-verified.`,
      async () => {
        try {
          await api.adminUnverifyIdentity(user.user_id);
          showAlert('Done', 'Identity verification revoked.');
          loadUsers();
        } catch (e: any) {
          showAlert('Error', e?.response?.data?.detail || 'Failed to revoke');
        }
      }
    );
  };


  const openRankModal = async (user: any) => {
    setRankTarget(user);
    setRankData(null);
    setRankCategory('*');
    setRankHours('');
    setRankReason('');
    setRankModalVisible(true);
    setRankLoading(true);
    try {
      setRankData(await api.adminGetProviderRanking(user.user_id));
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to load ranking');
    } finally {
      setRankLoading(false);
    }
  };

  const submitRankAdjust = async (sign: 1 | -1) => {
    const h = parseFloat(rankHours);
    if (!h || h <= 0) { showAlert('Enter hours', 'Enter a positive number of hours.'); return; }
    try {
      await api.adminAdjustProviderRanking(rankTarget.user_id, {
        hours: sign * h,
        category: rankCategory,
        reason: rankReason.trim() || undefined,
      });
      showAlert('Done', `${sign > 0 ? 'Added' : 'Removed'} ${h}h (${rankCategory === '*' ? 'all categories' : rankCategory}).`);
      setRankHours('');
      setRankReason('');
      setRankData(await api.adminGetProviderRanking(rankTarget.user_id));
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to adjust');
    }
  };

  const openRoleModal = (user: any) => {
    setRoleTarget(user);
    setRoleModalVisible(true);
  };

  const handleChangeRole = async (newRole: string) => {
    if (!roleTarget || roleTarget.role === newRole) {
      setRoleModalVisible(false);
      return;
    }
    try {
      await api.changeUserRole(roleTarget.user_id, newRole);
      showAlert('Success', `Role changed to "${roleMeta(newRole).label}"`);
      setRoleModalVisible(false);
      const becameModerator = newRole === 'moderator';
      const target = roleTarget;
      setRoleTarget(null);
      await loadUsers();
      if (becameModerator) openModulesModal({ ...target, role: 'moderator' });
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || e.message || 'Could not change role');
    }
  };


  const [modModalVisible, setModModalVisible] = useState(false);
  const [modModules, setModModules] = useState<string[]>([]);
  const ALL_MODULES = ['tasks','bookings','users','payments','reviews','messages','services','analytics','settings'];
  const MODULE_LABELS: Record<string,string> = {
    tasks:'Tasks', bookings:'Bookings', users:'Users',
    payments:'Payments', reviews:'Reviews', messages:'Messages',
    services:'Services', analytics:'Analytics', settings:'Settings'
  };

  const handleSetModerator = async (user: any) => {
    showConfirm('Make moderator', `Grant ${user.name} the moderator role?`, async () => {
      try { await api.setModerator(user.user_id); showAlert('Success', `${user.name} is now a moderator`); loadUsers(); }
      catch (e: any) { showAlert('Error', e?.response?.data?.detail || e.message); }
    }, 'Confirm', 'Cancel');
  };

  const handleRemoveModerator = async (user: any) => {
    showConfirm('Remove moderator', `Remove the moderator role from ${user.name}?`, async () => {
      try { await api.removeModerator(user.user_id); showAlert('Success', 'Moderator role removed'); loadUsers(); }
      catch (e: any) { showAlert('Error', e?.response?.data?.detail || e.message); }
    }, 'Confirm', 'Cancel');
  };

  const openModulesModal = (user: any) => {
    setSelectedUser(user);
    setModModules(user.moderator_modules || ALL_MODULES);
    setModModalVisible(true);
  };

  const saveModules = async () => {
    try {
      await api.updateModeratorModules(selectedUser.user_id, modModules);
      showAlert('Success', 'Module access updated');
      setModModalVisible(false);
      loadUsers();
    } catch (e: any) { showAlert('Error', e?.response?.data?.detail || e.message); }
  };

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const [requireIdentity, setRequireIdentity] = useState(false);
  const [savingRequireIdentity, setSavingRequireIdentity] = useState(false);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      setRequireIdentity(!!s?.require_identity_verification);
    } catch {
      // ignore
    }
  };

  const toggleRequireIdentity = async (v: boolean) => {
    setSavingRequireIdentity(true);
    setRequireIdentity(v);
    try {
      await api.updateAdminSettings({ require_identity_verification: v });
    } catch (e: any) {
      setRequireIdentity(!v);
      showAlert('Error', e?.response?.data?.detail || 'Could not update setting');
    } finally {
      setSavingRequireIdentity(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadSettings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleBlock = async (permanent: boolean) => {
    if (!blockReason.trim()) {
      showAlert('Error', 'Please provide a reason for blocking');
      return;
    }

    try {
      const durationHours = permanent ? undefined : parseInt(blockDuration);
      if (!permanent && (!durationHours || durationHours <= 0)) {
        showAlert('Error', 'Please provide valid duration in hours');
        return;
      }

      await api.blockUser(selectedUser.user_id, blockReason, durationHours);
      showAlert('Success', `User blocked ${permanent ? 'permanently' : 'temporarily'}`);
      setBlockModalVisible(false);
      setBlockReason('');
      setBlockDuration('');
      loadUsers();
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to block user');
    }
  };

  const handleUnblock = async (userId: string) => {
    showConfirm('Unblock User', 'Are you sure you want to unblock this user?', async () => {
      try {
        await api.unblockUser(userId);
        showAlert('Success', 'User unblocked');
        loadUsers();
      } catch (error: any) {
        showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to unblock user');
      }
    }, 'Unblock', 'Cancel');
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    showConfirm(
      'Delete User',
      `Are you sure you want to permanently delete ${userEmail}? This action cannot be undone and will delete all their data.`,
      async () => {
        try {
          await api.deleteUser(userId);
          showAlert('Success', 'User deleted permanently');
          loadUsers();
        } catch (error: any) {
          showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to delete user');
        }
      },
      'Delete',
      'Cancel',
    );
  };

  const openBlockModal = (user: any) => {
    setSelectedUser(user);
    setBlockModalVisible(true);
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
        <Text style={styles.headerTitle}>User Management</Text>
        <Text style={styles.headerSubtitle}>Manage clients and providers</Text>
        <View style={styles.idGateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.idGateTitle}>Require identity verification</Text>
            <Text style={styles.idGateSub}>
              {requireIdentity
                ? 'ON — unverified providers are hidden from clients and can’t accept jobs.'
                : 'OFF — all providers are visible. Turn on once your providers are ID-verified.'}
            </Text>
          </View>
          <Switch
            value={requireIdentity}
            onValueChange={toggleRequireIdentity}
            disabled={savingRequireIdentity}
            data-testid="toggle-require-identity"
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {users.map((user) => (
          <View key={user.user_id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <TouchableOpacity
                style={styles.userInfo}
                activeOpacity={(user.role === 'provider' || user.role === 'client') ? 0.6 : 1}
                onPress={() => openUserDetail(user)}
                disabled={user.role !== 'provider' && user.role !== 'client'}
                data-testid={`user-card-${user.user_id}`}
              >
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                {user.role === 'provider' && (
                  <View style={styles.detailsHint}>
                    <Ionicons name="eye-outline" size={13} color="#2563eb" />
                    <Text style={styles.detailsHintText}>Tap to view coverage, skills, prices & availability</Text>
                  </View>
                )}
                {user.role === 'client' && (
                  <View style={styles.detailsHint}>
                    <Ionicons name="eye-outline" size={13} color="#2563eb" />
                    <Text style={styles.detailsHintText}>Tap to view contact, location & requested services</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View
                style={[styles.roleBadge, { backgroundColor: roleMeta(user.role).color + '22' }]}
              >
                <Text style={[styles.roleText, { color: roleMeta(user.role).color }]}>
                  {roleMeta(user.role).label}
                </Text>
              </View>
            </View>

            {user.is_blocked && (
              <View style={styles.blockedBanner}>
                <Ionicons name="ban" size={16} color="#ef4444" />
                <Text style={styles.blockedText}>
                  Blocked{user.blocked_until ? ' until ' + new Date(user.blocked_until).toLocaleString() : ' permanently'}
                </Text>
              </View>
            )}

            {user.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call" size={14} color="#6b7280" />
                <Text style={styles.infoText}>{user.phone}</Text>
              </View>
            )}

            <View style={styles.actions}>
              {user.user_id === currentUserId ? (
                <Text style={styles.selfNote}>This is your account</Text>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.roleButton]}
                    onPress={() => openRoleModal(user)}
                    data-testid={`change-role-btn-${user.user_id}`}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#6366f1" />
                    <Text style={[styles.actionText, { color: '#6366f1' }]}>Role</Text>
                  </TouchableOpacity>

                  {user.role === 'moderator' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: '#8b5cf6' }]}
                      onPress={() => openModulesModal(user)}
                      data-testid={`modules-btn-${user.user_id}`}
                    >
                      <Ionicons name="options-outline" size={16} color="#8b5cf6" />
                      <Text style={[styles.actionText, { color: '#8b5cf6' }]}>Modules</Text>
                    </TouchableOpacity>
                  )}

                  {user.role === 'provider' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: '#7c3aed' }]}
                      onPress={() => openRankModal(user)}
                      data-testid={`ranking-btn-${user.user_id}`}
                    >
                      <Ionicons name="stats-chart" size={16} color="#7c3aed" />
                      <Text style={[styles.actionText, { color: '#7c3aed' }]}>Ranking</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: '#0891b2' }]}
                    onPress={() => downloadTermsPdf(user)}
                    data-testid={`terms-pdf-btn-${user.user_id}`}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#0891b2" />
                    <Text style={[styles.actionText, { color: '#0891b2' }]}>Terms PDF</Text>
                  </TouchableOpacity>

                  {(user.role === 'provider' || user.role === 'client') && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: '#2563eb' }]}
                      onPress={() => router.push(`/admin-chat?user_id=${user.user_id}&name=${encodeURIComponent(user.name || 'User')}` as any)}
                      data-testid={`message-user-btn-${user.user_id}`}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#2563eb" />
                      <Text style={[styles.actionText, { color: '#2563eb' }]}>Message</Text>
                    </TouchableOpacity>
                  )}

                  {user.role === 'provider' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: '#0d9488' }]}
                      onPress={() => downloadProviderAgreementPdf(user)}
                      data-testid={`provider-agreement-pdf-btn-${user.user_id}`}
                    >
                      <Ionicons name="ribbon-outline" size={16} color="#0d9488" />
                      <Text style={[styles.actionText, { color: '#0d9488' }]}>Agreement PDF</Text>
                    </TouchableOpacity>
                  )}

                  {user.role === 'provider' && (
                    user.identity_verified ? (
                      <TouchableOpacity
                        style={[styles.actionButton, { borderColor: '#f59e0b' }]}
                        onPress={() => handleUnverifyIdentity(user)}
                        data-testid={`unverify-identity-btn-${user.user_id}`}
                      >
                        <Ionicons name="shield-checkmark" size={16} color="#059669" />
                        <Text style={[styles.actionText, { color: '#f59e0b' }]}>Revoke ID</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, { borderColor: '#7c3aed' }]}
                        onPress={() => handleVerifyIdentity(user)}
                        data-testid={`verify-identity-btn-${user.user_id}`}
                      >
                        <Ionicons name="shield-outline" size={16} color="#7c3aed" />
                        <Text style={[styles.actionText, { color: '#7c3aed' }]}>Verify ID</Text>
                      </TouchableOpacity>
                    )
                  )}

                  {user.is_blocked ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.unblockButton]}
                      onPress={() => handleUnblock(user.user_id)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={[styles.actionText, { color: '#10b981' }]}>Unblock</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.blockButton]}
                      onPress={() => openBlockModal(user)}
                    >
                      <Ionicons name="ban" size={16} color="#f59e0b" />
                      <Text style={[styles.actionText, { color: '#f59e0b' }]}>Block</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(user.user_id, user.email)}
                  >
                    <Ionicons name="trash" size={16} color="#ef4444" />
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Block User Modal */}
      <Modal visible={blockModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Block User</Text>
              <TouchableOpacity onPress={() => setBlockModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Reason for blocking</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={blockReason}
                onChangeText={setBlockReason}
                placeholder="e.g., Violated terms of service..."
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Duration (hours, leave empty for permanent)</Text>
              <TextInput
                style={styles.input}
                value={blockDuration}
                onChangeText={setBlockDuration}
                placeholder="e.g., 24, 48, 168 (7 days)"
                keyboardType="number-pad"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.temporaryButton]}
                  onPress={() => handleBlock(false)}
                >
                  <Text style={styles.modalButtonText}>Block Temporarily</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.permanentButton]}
                  onPress={() => handleBlock(true)}
                >
                  <Text style={styles.modalButtonText}>Block Permanently</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ranking Hours Modal (admin add/subtract per category) */}
      <Modal visible={rankModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ranking hours</Text>
              <TouchableOpacity onPress={() => setRankModalVisible(false)} data-testid="rank-close-btn">
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                {rankTarget?.name} — add or subtract ranking hours. Bonus hours boost the pro's
                position in the client-facing list.
              </Text>

              {rankLoading ? (
                <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <Text style={styles.label}>Apply to</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    <TouchableOpacity
                      style={[styles.catChip, rankCategory === '*' && styles.catChipOn]}
                      onPress={() => setRankCategory('*')}
                      data-testid="rank-cat-all"
                    >
                      <Text style={[styles.catChipText, rankCategory === '*' && styles.catChipTextOn]}>All categories</Text>
                    </TouchableOpacity>
                    {(rankData?.categories || []).map((c: any) => (
                      <TouchableOpacity
                        key={c.category_id}
                        style={[styles.catChip, rankCategory === c.category_id && styles.catChipOn]}
                        onPress={() => setRankCategory(c.category_id)}
                        data-testid={`rank-cat-${c.category_id}`}
                      >
                        <Text style={[styles.catChipText, rankCategory === c.category_id && styles.catChipTextOn]}>{c.category_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Current standing */}
                  <View style={styles.rankStandingBox}>
                    {rankData?.global_bonus_hours ? (
                      <Text style={styles.rankGlobal}>Global bonus (all categories): <Text style={{ fontWeight: '800', color: '#7c3aed' }}>+{rankData.global_bonus_hours}h</Text></Text>
                    ) : null}
                    {(rankData?.categories || []).length === 0 ? (
                      <Text style={{ color: '#9ca3af', fontSize: 13 }}>This pro has no active skill categories yet.</Text>
                    ) : (rankData?.categories || []).map((c: any) => (
                      <View key={c.category_id} style={styles.rankRow}>
                        <Text style={styles.rankRowName}>{c.category_name}</Text>
                        <Text style={styles.rankRowVal}>{c.worked_hours}h + bonus {c.bonus_hours}h · score {c.total_score}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.label}>Hours</Text>
                  <TextInput
                    style={styles.input}
                    value={rankHours}
                    onChangeText={setRankHours}
                    placeholder="e.g. 5"
                    keyboardType="decimal-pad"
                    data-testid="rank-hours-input"
                  />
                  <Text style={styles.label}>Reason (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={rankReason}
                    onChangeText={setRankReason}
                    placeholder="e.g. Manual correction"
                    data-testid="rank-reason-input"
                  />

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: '#10b981' }]}
                      onPress={() => submitRankAdjust(1)}
                      data-testid="rank-add-btn"
                    >
                      <Text style={styles.modalButtonText}>+ Add hours</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: '#ef4444' }]}
                      onPress={() => submitRankAdjust(-1)}
                      data-testid="rank-subtract-btn"
                    >
                      <Text style={styles.modalButtonText}>− Subtract</Text>
                    </TouchableOpacity>
                  </View>

                  {(rankData?.history || []).length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>History</Text>
                      {(rankData.history || []).slice(0, 15).map((h: any) => (
                        <View key={h.adj_id} style={styles.histRow}>
                          <Text style={[styles.histHours, { color: h.hours >= 0 ? '#10b981' : '#ef4444' }]}>{h.hours >= 0 ? '+' : ''}{h.hours}h</Text>
                          <Text style={styles.histMeta}>{h.category === '*' ? 'all' : h.category} · {h.source}{h.reason ? ` · ${h.reason}` : ''}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Moderator Modules Modal */}
      <Modal visible={modModalVisible} animationType='slide' transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Module access</Text>
              <TouchableOpacity onPress={() => setModModalVisible(false)}>
                <Ionicons name='close' size={24} color='#6b7280' />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                {selectedUser?.name} — select module access:
              </Text>
              {ALL_MODULES.map((mod) => (
                <TouchableOpacity
                  key={mod}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                  onPress={() => setModModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])}
                >
                  <Ionicons name={modModules.includes(mod) ? 'checkbox' : 'square-outline'} size={22} color={modModules.includes(mod) ? '#2563eb' : '#9ca3af'} />
                  <Text style={{ marginLeft: 12, fontSize: 15, color: '#111827' }}>{MODULE_LABELS[mod] || mod}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2563eb', marginTop: 16, marginBottom: 8 }]}
                onPress={saveModules}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal visible={roleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} data-testid="role-modal-close">
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                {roleTarget?.name} — select a new role:
              </Text>
              {ROLE_OPTIONS.map((opt) => {
                const active = roleTarget?.role === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.roleOption, active && { borderColor: opt.color, backgroundColor: opt.color + '14' }]}
                    onPress={() => handleChangeRole(opt.value)}
                    data-testid={`role-option-${opt.value}`}
                  >
                    <View style={[styles.roleOptionIcon, { backgroundColor: opt.color + '22' }]}>
                      <Ionicons name={opt.icon as any} size={20} color={opt.color} />
                    </View>
                    <Text style={styles.roleOptionLabel}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={opt.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Provider detail: coverage, skills, prices, availability */}
      <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{detailUser?.name}</Text>
                <Text style={styles.detailEmail}>{detailUser?.email}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailVisible(false)} data-testid="detail-close">
                <Ionicons name="close" size={26} color="#111827" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <ActivityIndicator style={{ marginVertical: 30 }} size="large" color="#2563eb" />
            ) : detailUser?.role === 'client' ? (
              !detailClient ? (
                <View style={{ padding: 24 }}>
                  <Text style={styles.detailEmptyBig}>No details available</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 24 }} data-testid="client-detail-body">
                  {/* Contact */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHead}>
                      <Ionicons name="call-outline" size={18} color="#2563eb" />
                      <Text style={styles.detailSectionTitle}>Contact</Text>
                    </View>
                    <Text style={styles.detailLine}>Phone: {detailClient.user?.phone || '—'}</Text>
                    <Text style={styles.detailLine}>Email: {detailClient.user?.email || '—'}</Text>
                  </View>

                  {/* Location */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHead}>
                      <Ionicons name="location-outline" size={18} color="#10b981" />
                      <Text style={styles.detailSectionTitle}>Location</Text>
                    </View>
                    <Text style={styles.detailLine}>{detailClient.location || 'No address on file'}</Text>
                    {(detailClient.user?.saved_addresses?.length > 0) && detailClient.user.saved_addresses.map((a: any, i: number) => (
                      <Text key={i} style={styles.detailMuted}>
                        {(a.label ? a.label + ': ' : '')}{a.address || a.formatted_address || ''}
                      </Text>
                    ))}
                  </View>

                  {/* Requested services */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHead}>
                      <Ionicons name="briefcase-outline" size={18} color="#7c3aed" />
                      <Text style={styles.detailSectionTitle}>Requested services</Text>
                    </View>
                    <Text style={styles.detailLine}>
                      {detailClient.stats?.total_tasks || 0} total · {detailClient.stats?.active_tasks || 0} active
                    </Text>
                    {(detailClient.stats?.categories?.length > 0) ? (
                      <View style={styles.chipsWrap}>
                        {detailClient.stats.categories.map((c: string, i: number) => (
                          <View key={i} style={styles.skillChip}>
                            <Text style={styles.skillChipText}>{c.replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.detailMuted}>No service category recorded yet.</Text>
                    )}
                  </View>

                  {/* Recent requests */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHead}>
                      <Ionicons name="list-outline" size={18} color="#f59e0b" />
                      <Text style={styles.detailSectionTitle}>Recent requests ({detailClient.tasks?.length || 0})</Text>
                    </View>
                    {(detailClient.tasks?.length > 0) ? detailClient.tasks.slice(0, 12).map((t: any, i: number) => (
                      <View key={i} style={styles.taskRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.taskTitle} numberOfLines={1}>{t.title || 'Untitled request'}</Text>
                          <Text style={styles.taskMeta} numberOfLines={1}>
                            {(t.category ? t.category + ' · ' : '')}{t.address || 'no address'}{t.scheduled_date ? ' · ' + t.scheduled_date : ''}
                          </Text>
                        </View>
                        <Text style={styles.taskStatus}>{(t.status || '').replace(/_/g, ' ')}</Text>
                      </View>
                    )) : (
                      <Text style={styles.detailMuted}>No requests yet.</Text>
                    )}
                  </View>
                </ScrollView>
              )
            ) : !detailProfile ? (
              <View style={{ padding: 24 }}>
                <Text style={styles.detailEmptyBig}>No provider profile yet</Text>
                <Text style={styles.detailMuted}>This provider hasn’t completed their profile (skills, coverage or rates).</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 24 }} data-testid="provider-detail-body">
                {/* Coverage */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHead}>
                    <Ionicons name="location-outline" size={18} color="#10b981" />
                    <Text style={styles.detailSectionTitle}>Service area</Text>
                  </View>
                  {detailProfile.service_radius_km != null && (
                    <Text style={styles.detailLine}>Radius: {Math.round(detailProfile.service_radius_km * 0.621371)} mi ({detailProfile.service_radius_km} km)</Text>
                  )}
                  {(detailProfile.service_cities?.length > 0) && (
                    <Text style={styles.detailLine}>Cities: {detailProfile.service_cities.join(', ')}</Text>
                  )}
                  {(detailProfile.service_zones?.length > 0) && (
                    <Text style={styles.detailLine}>Zones: {detailProfile.service_zones.join(', ')}</Text>
                  )}
                  {(detailProfile.service_zip_codes?.length > 0) && (
                    <Text style={styles.detailLine}>ZIPs: {detailProfile.service_zip_codes.join(', ')}</Text>
                  )}
                  {(detailProfile.user?.address || detailProfile.user?.city) && (
                    <Text style={styles.detailLine}>Based in: {detailProfile.user?.address || detailProfile.user?.city}</Text>
                  )}

                  {/* Coverage map: center + radius */}
                  {(detailProfile.latitude != null && detailProfile.longitude != null) ? (
                    <View style={{ marginTop: 10 }}>
                      {Platform.OS === 'web' ? (
                        // @ts-ignore web iframe
                        <iframe
                          title="provider-coverage"
                          srcDoc={buildProviderMapHtml(detailProfile.latitude, detailProfile.longitude, detailProfile.service_radius_km)}
                          style={{ width: '100%', height: 200, border: '1px solid #e5e7eb', borderRadius: 12 } as any}
                          data-testid="provider-coverage-map"
                        />
                      ) : (
                        <View style={styles.mapFallback}>
                          <Ionicons name="map-outline" size={26} color="#9ca3af" />
                          <Text style={styles.detailMuted}>Open the web dashboard to view the coverage map.</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.mapLinkBtn}
                        onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${detailProfile.latitude},${detailProfile.longitude}`)}
                        data-testid="provider-map-google-link"
                      >
                        <Ionicons name="open-outline" size={15} color="#2563eb" />
                        <Text style={styles.mapLinkText}>Open center on Google Maps</Text>
                      </TouchableOpacity>
                      <Text style={styles.detailMuted}>Center: {Number(detailProfile.latitude).toFixed(4)}, {Number(detailProfile.longitude).toFixed(4)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.detailMuted}>No map location set — provider hasn’t pinned a work location yet.</Text>
                  )}

                  {(!detailProfile.service_radius_km && !(detailProfile.service_cities?.length) && !(detailProfile.service_zones?.length) && detailProfile.latitude == null) && (
                    <Text style={styles.detailMuted}>No coverage area set.</Text>
                  )}
                </View>

                {/* Pricing */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHead}>
                    <Ionicons name="pricetag-outline" size={18} color="#2563eb" />
                    <Text style={styles.detailSectionTitle}>Pricing</Text>
                  </View>
                  <Text style={styles.detailLine}>Base rate: {detailProfile.hourly_rate != null ? `$${detailProfile.hourly_rate}/hr` : '—'}</Text>
                  <Text style={styles.detailLine}>Minimum: {detailProfile.minimum_hours != null ? `${detailProfile.minimum_hours} hr` : '—'}</Text>
                </View>

                {/* Skills */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHead}>
                    <Ionicons name="construct-outline" size={18} color="#7c3aed" />
                    <Text style={styles.detailSectionTitle}>Skills ({detailProfile.skills?.length || 0})</Text>
                  </View>
                  {(detailProfile.skills?.length > 0) ? (
                    <View style={styles.chipsWrap}>
                      {detailProfile.skills.map((sk: any, i: number) => (
                        <View key={i} style={styles.skillChip}>
                          <Text style={styles.skillChipText}>
                            {(sk.name || sk.label || sk.id || 'skill').toString().replace(/_/g, ' ')}
                            {sk.rate ? ` · $${sk.rate}/hr` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.detailMuted}>No skills added.</Text>
                  )}
                </View>

                {/* Availability */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHead}>
                    <Ionicons name="calendar-outline" size={18} color="#f59e0b" />
                    <Text style={styles.detailSectionTitle}>Availability ({detailSlots.filter(s => s.is_active !== false).length})</Text>
                  </View>
                  {detailSlots.filter(s => s.is_active !== false).length > 0 ? (
                    detailSlots.filter(s => s.is_active !== false).map((sl: any, i: number) => {
                      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      const label = sl.specific_date
                        ? `${sl.specific_date} · one-time`
                        : `${days[sl.day_of_week] ?? '?'} · weekly`;
                      return (
                        <View key={i} style={styles.slotRow}>
                          <Text style={styles.slotDay}>{label}</Text>
                          <Text style={styles.slotTime}>{sl.start_time}–{sl.end_time}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.detailMuted}>No availability set.</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  idGateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 12,
  },
  idGateTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  idGateSub: { fontSize: 11.5, color: '#6b7280', marginTop: 2, lineHeight: 15 },
  detailsHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  detailsHintText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  mapFallback: {
    height: 120, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12,
  },
  mapLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff',
  },
  mapLinkText: { color: '#2563eb', fontSize: 13, fontWeight: '700' },
  detailSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  detailName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  detailEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  detailEmptyBig: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  detailSection: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  detailLine: { fontSize: 14, color: '#374151', marginBottom: 4 },
  detailMuted: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: { backgroundColor: '#f3e8ff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  skillChipText: { fontSize: 13, color: '#7c3aed', fontWeight: '600', textTransform: 'capitalize' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  slotDay: { fontSize: 14, color: '#111827', fontWeight: '600' },
  slotTime: { fontSize: 14, color: '#6b7280' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  taskTitle: { fontSize: 14, color: '#111827', fontWeight: '600' },
  taskMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  taskStatus: { fontSize: 11, color: '#2563eb', fontWeight: '700', textTransform: 'capitalize' },
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
  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selfNote: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  roleButton: {
    borderColor: '#6366f1',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 10,
  },
  roleOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  blockedText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  blockButton: {
    borderColor: '#fde68a',
    backgroundColor: '#fef3c7',
  },
  unblockButton: {
    borderColor: '#a7f3d0',
    backgroundColor: '#d1fae5',
  },
  deleteButton: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalBody: {
    padding: 24,
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
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  temporaryButton: {
    backgroundColor: '#f59e0b',
  },
  permanentButton: {
    backgroundColor: '#ef4444',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  catChip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  catChipOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  catChipTextOn: { color: '#fff' },
  rankStandingBox: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 4 },
  rankGlobal: { fontSize: 13, color: '#374151', marginBottom: 8 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rankRowName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  rankRowVal: { fontSize: 12, color: '#6b7280' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  histHours: { fontSize: 13, fontWeight: '800', width: 52 },
  histMeta: { fontSize: 12, color: '#6b7280', flex: 1 },
});
