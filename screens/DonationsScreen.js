import { StyleSheet, Text, View } from 'react-native';

export default function DonationsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Donations</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.comingSoonCard}>
          <Text style={styles.emoji}>💝</Text>
          <Text style={styles.heading}>Coming Soon</Text>
          <Text style={styles.text}>
            We're building a donation system to support rescue operations and volunteer work.
          </Text>
          <Text style={styles.subtitle}>Check back soon!</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  comingSoonCard: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#232323',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#ff6b2c',
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
