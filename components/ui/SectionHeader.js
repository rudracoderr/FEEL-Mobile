import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export default function SectionHeader({ title, subtitle, action }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.section,
  },
  subtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
