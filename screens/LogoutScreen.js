import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LogoutScreen({ onConfirm, onCancel }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Confirm Logout</Text>
        <Text style={styles.subtitle}>Are you sure you want to sign out of your account?</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.confirm]} onPress={onConfirm}>
            <Text style={styles.confirmText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#e5eef6',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    color: '#475569',
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minWidth: 110,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#f1f5f9',
  },
  confirm: {
    backgroundColor: '#ef4444',
  },
  cancelText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
