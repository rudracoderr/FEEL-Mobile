import { StyleSheet, Text, View } from 'react-native';
import { getStatusToken, radius } from '../../theme';

export default function StatusBadge({ status, style }) {
  const token = getStatusToken(status);

  return (
    <View style={[styles.badge, { backgroundColor: token.background }, style]}>
      <Text style={[styles.text, { color: token.color }]}>{token.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '900',
  },
});
