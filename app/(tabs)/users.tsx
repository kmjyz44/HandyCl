import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { showConfirm, showAlert } from '../../utils/alert';
import { useAuthStore } from '../../store/authStore';

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

  useEffect(() => {
    loadUsers();
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
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {users.map((user) => (
          <View key={user.user_id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
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
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
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
    fontSize: 14,
    fontWeight: '600',
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
