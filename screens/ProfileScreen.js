import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChevronRight, HeartHandshake, HelpCircle, Info, Lock, MapPin, ShieldCheck, UserRound } from 'lucide-react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingState from '../components/ui/LoadingState';
import MetricCard from '../components/ui/MetricCard';
import SectionHeader from '../components/ui/SectionHeader';
import { colors, radius, spacing, typography } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Guest welcome screen shown to unauthenticated users on the Profile tab
// ─────────────────────────────────────────────────────────────────────────────
function GuestProfileScreen() {
  const navigation = useNavigation();

  return (
    <View style={guestStyles.screen}>
      <View style={guestStyles.content}>
        {/* Mascot paw */}
        <View style={guestStyles.pawContainer}>
          <Text style={guestStyles.pawEmoji}>🐾</Text>
        </View>

        {/* Brand name */}
        <Text style={guestStyles.brand}>FEEL</Text>
        <Text style={guestStyles.tagline}>
          Welcome to FEEL
        </Text>
        <Text style={guestStyles.description}>
          Join the FEEL community to report animals, track rescues, and help animals in need.
        </Text>

        {/* Feature highlights */}
        <View style={guestStyles.featuresCard}>
          <FeatureRow emoji="🚨" label="Report animals in distress" />
          <FeatureRow emoji="📍" label="Track active rescues near you" />
          <FeatureRow emoji="🤝" label="Connect with local volunteers" />
          <FeatureRow emoji="❤️" label="Make a difference every day" />
        </View>

        {/* Sign In */}
        <TouchableOpacity
          style={guestStyles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.87}
        >
          <Text style={guestStyles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        {/* Create Account — standard signup, no volunteer intent */}
        <TouchableOpacity
          style={guestStyles.secondaryButton}
          onPress={() => navigation.navigate('Signup')}
          activeOpacity={0.87}
        >
          <Text style={guestStyles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>

        {/* Become a Volunteer — signup with volunteer intent stored as route param */}
        <TouchableOpacity
          style={guestStyles.volunteerButton}
          onPress={() => navigation.navigate('Signup', { volunteerIntent: true })}
          activeOpacity={0.87}
        >
          <Text style={guestStyles.volunteerButtonText}>🤝  Become a Volunteer</Text>
        </TouchableOpacity>

        <Text style={guestStyles.browsingNote}>
          You're browsing as a guest. Sign in to unlock full features.
        </Text>
      </View>
    </View>
  );
}

function FeatureRow({ emoji, label }) {
  return (
    <View style={guestStyles.featureRow}>
      <Text style={guestStyles.featureEmoji}>{emoji}</Text>
      <Text style={guestStyles.featureLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated profile screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ onLogout, currentUserProfile }) {
  const navigation = useNavigation();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [backendUser, setBackendUser] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [claimedReports, setClaimedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async (user, isRefresh = false) => {
    if (!user) {
      setBackendUser(null);
      setMyReports([]);
      setClaimedReports([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (!isRefresh) setLoading(true);
      const userResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/users/${user.uid}`);
      const responseText = await userResponse.text();

      // 404 = user has Firebase auth but hasn't completed their profile yet
      // (race condition during the signup → CompleteProfile flow).
      // Treat as null — profile will be populated after CompleteProfileScreen saves.
      if (userResponse.status === 404) {
        setBackendUser(null);
        setMyReports([]);
        setClaimedReports([]);
        return;
      }

      if (!userResponse.ok) {
        throw new Error(responseText || 'Failed to load user details');
      }

      const userData = responseText ? JSON.parse(responseText) : null;
      setBackendUser(userData);

      // Only fetch reports when the backend profile exists.
      const reportsResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/by-reporter/${user.uid}`);
      const reportsData = await reportsResponse.json();
      setMyReports(reportsResponse.ok && Array.isArray(reportsData.reports) ? reportsData.reports : []);

      if (userData?.isVolunteer) {
        const claimedResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/claimed/${user.uid}`);
        const claimedData = await claimedResponse.json();
        setClaimedReports(claimedResponse.ok && Array.isArray(claimedData.reports) ? claimedData.reports : []);
      } else {
        setClaimedReports([]);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setFirebaseUser(user);
      await loadProfile(user);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (auth.currentUser) {
        loadProfile(auth.currentUser, true);
      }
    });
    return unsubscribeFocus;
  }, [navigation]);

  useEffect(() => {
    if (currentUserProfile) {
      setBackendUser(currentUserProfile);
    } else if (!firebaseUser) {
      setBackendUser(null);
    }
  }, [currentUserProfile, firebaseUser]);

  const displayName = backendUser?.fullName || firebaseUser?.email?.split('@')?.[0] || 'User';
  const email = firebaseUser?.email || backendUser?.email || 'No email';
  const city = backendUser?.city || 'City not set';
  const volunteerStatus = backendUser?.volunteerStatus || (backendUser?.isVolunteer ? 'Volunteer' : 'Community Member');
  const initial = displayName.charAt(0).toUpperCase();
  const metrics = useMemo(() => ({
    submitted: myReports.length,
    active: claimedReports.filter((report) => report.status === 'accepted').length,
    completed: claimedReports.filter((report) => report.status === 'resolved').length,
  }), [myReports, claimedReports]);

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    loadProfile(firebaseUser, true);
  };

  const handleLogout = async () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: () => onLogout?.(),
        style: 'destructive',
      },
    ]);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  // ── Guest state ────────────────────────────────────────────────────────────
  if (!firebaseUser) {
    return <GuestProfileScreen />;
  }

  // ── Authenticated state ────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Text style={styles.title}>Profile</Text>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.profileMeta}>
            <View style={styles.metaPill}>
              <ShieldCheck size={14} color={colors.primary} strokeWidth={2.4} />
              <Text style={styles.metaPillText}>{volunteerStatus}</Text>
            </View>
            <View style={styles.metaPill}>
              <MapPin size={14} color={colors.primary} strokeWidth={2.4} />
              <Text style={styles.metaPillText}>{city}</Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Impact metrics" subtitle="Only real activity from your account is shown." />
        <View style={styles.metricsRow}>
          <MetricCard label="Reports Submitted" value={metrics.submitted} />
          <MetricCard label="Active Rescues" value={metrics.active} tone="medium" />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard label="Rescues Completed" value={metrics.completed} tone="success" />
        </View>

        <SectionHeader title="Recent activity" />
        <Card style={styles.activityCard}>
          {myReports.slice(0, 3).length ? myReports.slice(0, 3).map((report) => (
            <View key={report._id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>{report.title}</Text>
                <Text style={styles.activityMeta}>{report.status || 'pending'}</Text>
              </View>
            </View>
          )) : (
            <Text style={styles.activityMeta}>No recent submitted reports yet.</Text>
          )}
        </Card>

        <SectionHeader title="Settings" />
        <Card style={styles.settingsCard}>
          {/* Volunteer entry point — shown when user hasn't applied or was rejected */}
          {(backendUser?.volunteerStatus === 'none' || backendUser?.volunteerStatus === 'rejected' || !backendUser?.volunteerStatus) ? (
            <SettingsRow
              icon={HeartHandshake}
              label="Become a Volunteer"
              iconColor={colors.primary}
              onPress={() => navigation.navigate('VolunteerApplication')}
            />
          ) : null}
          <SettingsRow icon={UserRound} label="My Reports" onPress={() => navigation.navigate('MyReports')} />
          <SettingsRow icon={Bell} label="Notifications" />
          <SettingsRow icon={Lock} label="Privacy" />
          <SettingsRow icon={HelpCircle} label="Help" />
          <SettingsRow icon={Info} label="About FEEL" />
        </Card>

        <View style={styles.logoutSection}>
          <Button label="Logout" variant="danger" onPress={handleLogout} />
          <Text style={styles.footerText}>You will be returned to the home screen.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsRow({ icon: Icon, label, onPress, iconColor }) {
  const tint = iconColor || colors.primary;
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      <View style={[styles.settingsIcon, { backgroundColor: tint === colors.primary ? colors.primarySoft : `${tint}18` }]}>
        <Icon size={18} color={tint} strokeWidth={2.3} />
      </View>
      <Text style={styles.settingsLabel}>{label}</Text>
      {onPress ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — authenticated profile
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 108,
  },
  title: {
    ...typography.title,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  name: {
    ...typography.heading,
    textAlign: 'center',
  },
  email: {
    ...typography.meta,
    marginTop: 4,
    textAlign: 'center',
  },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  metaPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  activityCard: {
    marginBottom: spacing.xxl,
  },
  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  activityMeta: {
    ...typography.meta,
    marginTop: 2,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  logoutSection: {
    marginTop: spacing.xxl,
  },
  footerText: {
    ...typography.meta,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — guest profile screen
// ─────────────────────────────────────────────────────────────────────────────
const guestStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg + 8,
    paddingBottom: 60,
  },
  pawContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pawEmoji: {
    fontSize: 40,
  },
  brand: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  featuresCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  featureEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  volunteerButton: {
    width: '100%',
    height: 52,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  volunteerButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '800',
  },
  browsingNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
