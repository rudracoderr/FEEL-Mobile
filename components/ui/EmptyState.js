import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export default function EmptyState({ title, message, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.heading,
    fontSize: 18,
    textAlign: 'center',
  },
  message: {
    ...typography.meta,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
