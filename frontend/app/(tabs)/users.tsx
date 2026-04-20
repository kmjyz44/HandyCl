import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('');

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
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
      Alert.alert('Error', 'Please provide a reason for blocking');
      return;
    }

    try {
      const durationHours = permanent ? undefined : parseInt(blockDuration);
      if (!permanent && (!durationHours || durationHours <= 0)) {
        Alert.alert('Error', 'Please provide valid duration in hours');
        return;
      }

      await api.blockUser(selectedUser.user_id, blockReason, durationHours);
      Alert.alert('Success', `User blocked ${permanent ? 'permanently' : 'temporarily'}`);
      setBlockModalVisible(false);
      setBlockReason('');
      setBlockDuration('');
      loadUsers();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to block user');
    }
  };

  const handleUnblock = async (userId: string) => {
    Alert.alert('Unblock User', 'Are you sure you want to unblock this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await api.unblockUser(userId);
            Alert.alert('Success', 'User unblocked');
            loadUsers();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to unblock user');
          }
        },
      },
    ]);
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${userEmail}? This action cannot be undone and will delete all their data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUser(userId);
              Alert.alert('Success', 'User deleted permanently');
              loadUsers();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete user');
            }
          },
        },
      ]
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
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor:
                      user.role === 'admin'
                        ? '#fef3c7'
                        : user.role === 'provider'
                        ? '#dbeafe'
                        : '#d1fae5',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    {
                      color:
                        user.role === 'admin'
                          ? '#f59e0b'
                          : user.role === 'provider'
                          ? '#2563eb'
                          : '#10b981',
                    },
                  ]}
                >
                  {user.role.toUpperCase()}
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
              {user.role !== 'admin' && (
                <>
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
});
