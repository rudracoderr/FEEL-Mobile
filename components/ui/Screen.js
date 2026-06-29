import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';

export default function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
});
