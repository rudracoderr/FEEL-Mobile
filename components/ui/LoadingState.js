import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
