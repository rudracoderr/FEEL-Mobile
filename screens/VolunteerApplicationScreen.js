import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  CheckCircle,
  Clock,
  HeartHandshake,
  RefreshCw,
  ShieldOff,
  XCircle,
} from 'lucide-react-native';
import { auth } from '../firebase';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';
import { colors, radius, spacing, typography } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchMyProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/users/${uid}`);
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to load profile');
  return text ? JSON.parse(text) : null;
}

async function submitVolunteerApplication(profile) {
  if (!profile) throw new Error('Profile data missing');
  const payload = {
    uid: profile.uid,
    email: profile.email,
    fullName: profile.fullName || '',
    age: profile.age ?? null,
    phone: profile.phone || '',
    city: profile.city || '',
    location: profile.location,
    isVolunteer: true, // backend converts this → volunteerStatus:"pending"
  };
  const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Application submission failed');
  return text ? JSON.parse(text) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components for each status state
// ─────────────────────────────────────────────────────────────────────────────

function HeroIcon({ children, bg }) {
  return (
    <View style={[styles.iconRing, { backgroundColor: bg }]}>
      {children}
    </View>
  );
}

function RoleRow({ emoji, label }) {
  return (
    <View style={styles.roleRow}>
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <Text style={styles.roleLabel}>{label}</Text>
    </View>
  );
}

// volunteerStatus === 'none' or default — show apply CTA
function ApplyState({ onApply, submitting }) {
  return (
    <>
      <View style={styles.hero}>
        <HeroIcon bg={colors.primarySoft}>
          <HeartHandshake size={40} color={colors.primary} strokeWidth={2} />
        </HeroIcon>
        <Text style={styles.kicker}>FEEL Volunteer Program</Text>
        <Text style={styles.heroTitle}>Become a Volunteer</Text>
        <Text style={styles.heroSubtitle}>
          Help rescue animals in your community by becoming a certified FEEL volunteer.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What volunteers do</Text>
        <RoleRow emoji="🚨" label="Respond to nearby rescue alerts" />
        <RoleRow emoji="📍" label="Travel to the animal's location" />
        <RoleRow emoji="🤝" label="Coordinate with reporters on-site" />
        <RoleRow emoji="📸" label="Document and resolve rescues" />
        <RoleRow emoji="❤️" label="Make a real difference every day" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Requirements</Text>
        <RoleRow emoji="📱" label="Must have location access enabled" />
        <RoleRow emoji="🏙️" label="Must be in a city with active rescues" />
        <RoleRow emoji="⏱️" label="Available to respond within 60 minutes" />
        <RoleRow emoji="🔒" label="Application reviewed by FEEL admin team" />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        onPress={onApply}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Apply to Volunteer</Text>
        )}
      </TouchableOpacity>
    </>
  );
}

// volunteerStatus === 'pending'
function PendingState() {
  return (
    <View style={styles.centeredSection}>
      <HeroIcon bg={colors.warningSoft}>
        <Clock size={40} color={colors.medium} strokeWidth={2} />
      </HeroIcon>
      <Text style={styles.stateTitle}>Application Under Review</Text>
      <Text style={styles.stateSubtitle}>
        Your volunteer application has been submitted and is currently being reviewed by the FEEL admin team.
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: colors.warningSoft }]}>
        <Text style={[styles.statusBadgeText, { color: colors.medium }]}>
          ⏳  Pending Approval
        </Text>
      </View>
      <Text style={styles.stateNote}>
        You'll gain volunteer access once an admin approves your application. This usually takes 1–3 days.
      </Text>
    </View>
  );
}

// volunteerStatus === 'approved'
function ApprovedState() {
  return (
    <View style={styles.centeredSection}>
      <HeroIcon bg={colors.successSoft}>
        <CheckCircle size={40} color={colors.success} strokeWidth={2} />
      </HeroIcon>
      <Text style={styles.stateTitle}>You're a Volunteer!</Text>
      <Text style={styles.stateSubtitle}>
        Your application has been approved. You can now respond to rescue alerts in your area.
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: colors.successSoft }]}>
        <Text style={[styles.statusBadgeText, { color: colors.success }]}>
          ✅  Active Volunteer
        </Text>
      </View>
      <View style={styles.card} style={{ marginTop: spacing.xl }}>
        <Text style={styles.cardTitle}>Your volunteer perks</Text>
        <RoleRow emoji="🗂️" label="Access the Claimed Rescues tab" />
        <RoleRow emoji="🔔" label="Get notified of nearby rescue alerts" />
        <RoleRow emoji="🏆" label="Track your rescue impact on your profile" />
      </View>
    </View>
  );
}

// volunteerStatus === 'rejected'
function RejectedState({ onReapply, submitting, rejectionReason }) {
  return (
    <View style={styles.centeredSection}>
      <HeroIcon bg={colors.dangerSoft}>
        <XCircle size={40} color={colors.critical} strokeWidth={2} />
      </HeroIcon>
      <Text style={styles.stateTitle}>Application Not Approved</Text>
      <Text style={styles.stateSubtitle}>
        Unfortunately your previous application was not approved at this time.
      </Text>
      {rejectionReason ? (
        <View style={[styles.reasonCard, { borderColor: '#FECACA', backgroundColor: colors.dangerSoft }]}>
          <Text style={styles.reasonLabel}>Reason from admin</Text>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </View>
      ) : null}
      <View style={[styles.statusBadge, { backgroundColor: colors.dangerSoft }]}>
        <Text style={[styles.statusBadgeText, { color: colors.critical }]}>
          ✕  Application Rejected
        </Text>
      </View>
      <Text style={styles.stateNote}>
        You may reapply. If your circumstances have changed, please submit a new application.
      </Text>
      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.buttonDisabled, { marginTop: spacing.xl }]}
        onPress={onReapply}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <RefreshCw size={16} color="#fff" strokeWidth={2.5} style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Reapply Now</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// volunteerStatus === 'suspended'
function SuspendedState({ suspensionReason }) {
  return (
    <View style={styles.centeredSection}>
      <HeroIcon bg={colors.dangerSoft}>
        <ShieldOff size={40} color={colors.critical} strokeWidth={2} />
      </HeroIcon>
      <Text style={styles.stateTitle}>Volunteer Access Suspended</Text>
      <Text style={styles.stateSubtitle}>
        Your volunteer account has been temporarily suspended by the FEEL admin team.
      </Text>
      {suspensionReason ? (
        <View style={[styles.reasonCard, { borderColor: '#FECACA', backgroundColor: colors.dangerSoft }]}>
          <Text style={styles.reasonLabel}>Reason</Text>
          <Text style={styles.reasonText}>{suspensionReason}</Text>
        </View>
      ) : null}
      <View style={[styles.statusBadge, { backgroundColor: colors.dangerSoft }]}>
        <Text style={[styles.statusBadgeText, { color: colors.critical }]}>
          ⛔  Suspended
        </Text>
      </View>
      <Text style={styles.stateNote}>
        If you believe this is a mistake, please contact the FEEL support team for assistance.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function VolunteerApplicationScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const data = await fetchMyProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    load(true);
  };

  const handleApply = async () => {
    if (!profile) return;
    setSubmitting(true);
    try {
      const updated = await submitVolunteerApplication(profile);
      setProfile(updated);
    } catch (err) {
      Alert.alert('Submission failed', err.message || 'Could not submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const volunteerStatus = profile?.volunteerStatus || 'none';
  const suspensionReason = profile?.volunteerSuspensionReason || null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Back button row */}
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Status-specific content */}
        {(volunteerStatus === 'none') && (
          <ApplyState onApply={handleApply} submitting={submitting} />
        )}
        {volunteerStatus === 'pending' && (
          <PendingState />
        )}
        {volunteerStatus === 'approved' && (
          <ApprovedState />
        )}
        {volunteerStatus === 'rejected' && (
          <RejectedState
            onReapply={handleApply}
            submitting={submitting}
            rejectionReason={suspensionReason}
          />
        )}
        {volunteerStatus === 'suspended' && (
          <SuspendedState suspensionReason={suspensionReason} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 60,
  },

  // Back
  backRow: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },

  // Loading / error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.meta,
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.critical,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  heroSubtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 320,
  },

  // Role card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  roleEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  roleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // CTA button
  primaryButton: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  // Centered status states (pending / approved / rejected / suspended)
  centeredSection: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  stateTitle: {
    ...typography.heading,
    textAlign: 'center',
  },
  stateSubtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 320,
  },
  statusBadge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stateNote: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Reason card (rejection / suspension reason)
  reasonCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.critical,
    marginBottom: spacing.xs,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '600',
  },
});
