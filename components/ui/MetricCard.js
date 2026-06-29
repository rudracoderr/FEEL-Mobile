import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export default function MetricCard({ label, value, tone = 'primary', style }) {
  const color = tone === 'critical'
    ? colors.critical
    : tone === 'success'
      ? colors.success
      : tone === 'medium'
        ? colors.medium
        : colors.primary;

  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 78,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    justifyContent: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
});
