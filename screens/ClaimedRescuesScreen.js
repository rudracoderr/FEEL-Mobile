import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import ReportImageGallery from '../components/ReportImageGallery';
import RescueDetailsModal from '../components/RescueDetailsModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import SectionHeader from '../components/ui/SectionHeader';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge from '../components/ui/StatusBadge';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';
import { colors, radius, spacing, typography } from '../theme';

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(fromCoordinates, toCoordinates) {
  if (!Array.isArray(fromCoordinates) || !Array.isArray(toCoordinates)) return null;
  const [fromLongitude, fromLatitude] = fromCoordinates;
  const [toLongitude, toLatitude] = toCoordinates;
  if (![fromLongitude, fromLatitude, toLongitude, toLatitude].every((value) => typeof value === 'number')) return null;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const latitude1 = toRadians(fromLatitude);
  const latitude2 = toRadians(toLatitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2) *
      Math.cos(latitude1) * Math.cos(latitude2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistanceLabel(distanceKm) {
  if (distanceKm === null || Number.isNaN(distanceKm)) return 'Distance unavailable';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

function formatDateLabel(dateValue) {
  if (!dateValue) return 'Date unavailable';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString();
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['active', 'completed'];

function ClaimedRescueCard({ report, distanceLabel, onPress }) {
  const progress = report.volunteerProgress || (report.status === 'resolved' ? 'Resolved' : 'Assigned');

  const openGoogleMaps = () => {
    const coordinates = report?.location?.coordinates;
    if (!report?.location || !Array.isArray(coordinates) || coordinates.length !== 2) {
      Alert.alert('Location unavailable for this rescue.');
      return;
    }
    const [longitude, latitude] = coordinates;
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      Alert.alert('Location unavailable for this rescue.');
      return;
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`).catch(() => {
      Alert.alert('Location unavailable for this rescue.');
    });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <Card style={styles.card}>
        <ReportImageGallery imageUrls={report.imageUrls || []} height={170} />
        <View style={styles.badgeRow}>
          <StatusBadge status={report.status} />
          <SeverityBadge severity={report.severity} />
        </View>
        <Text style={styles.cardTitle}>{report.title}</Text>
        <Text style={styles.meta}>Reporter: {report.reporterName || 'Anonymous'}</Text>
        <View style={styles.progressBox}>
          <Text style={styles.progressLabel}>Current status</Text>
          <Text style={styles.progressValue}>{progress}</Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={15} color={colors.textSecondary} />
          <Text style={styles.metaText}>{distanceLabel}</Text>
        </View>
        <Text style={styles.meta}>Accepted: {formatDateLabel(report.acceptedAt)}</Text>
        {report.resolvedAt ? <Text style={styles.meta}>Resolved: {formatDateLabel(report.resolvedAt)}</Text> : null}
        <View style={styles.actions}>
          <Button label="View Workflow" onPress={onPress} style={styles.actionButton} />
          <Button label="Navigate" variant="outline" onPress={openGoogleMaps} style={styles.actionButton} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function ClaimedRescuesScreen({ currentUserProfile }) {
  const volunteerUid = currentUserProfile?.uid || null;
  const currentUserCoordinates = currentUserProfile?.location?.coordinates || null;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const horizontalScrollRef = useRef(null);

  const fetchClaimedReports = async () => {
    if (!volunteerUid) {
      setReports([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError('');
      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/claimed/${volunteerUid}`);
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to load claimed rescues');
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (fetchError) {
      console.error('Failed to fetch claimed rescues:', fetchError);
      setError(fetchError.message || 'Failed to load claimed rescues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClaimedReports();
  }, [volunteerUid]);

  const activeReports = useMemo(() => reports.filter((report) => report.status === 'accepted'), [reports]);
  const resolvedReports = useMemo(() => reports.filter((report) => report.status === 'resolved'), [reports]);

  const handleCancelRescue = async (report) => {
    if (!volunteerUid) {
      Alert.alert('Sign in required', 'Please sign in again to cancel this rescue.');
      return;
    }

    try {
      setCancellingId(report._id);
      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/${report._id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ uid: volunteerUid }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to cancel rescue');
      setReports((previousReports) => previousReports.filter((item) => item._id !== report._id));
      setSelectedReport(null);
      Alert.alert('Rescue Released', 'The rescue is available again for other volunteers.');
    } catch (cancelError) {
      Alert.alert('Unable to cancel', cancelError.message || 'Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdateProgress = async (report, nextProgress, resolutionDetails) => {
    if (!volunteerUid) {
      Alert.alert('Sign in required', 'Please sign in again to update progress.');
      return;
    }

    try {
      const payload = { progress: nextProgress };
      if (resolutionDetails) payload.resolutionDetails = resolutionDetails;
      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/${report._id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Failed to update progress');
      const updatedReport = data.report;
      setReports((previousReports) => previousReports.map((item) => (item._id === updatedReport._id ? updatedReport : item)));
      setSelectedReport(updatedReport);
      Alert.alert('Progress Updated', `Status changed to: ${nextProgress}`);
    } catch (progressError) {
      Alert.alert('Unable to update progress', progressError.message || 'Please try again.');
    }
  };

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetchClaimedReports();
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    const index = TABS.indexOf(tab);
    if (index !== -1) {
      horizontalScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    }
  };

  const onScroll = (e) => {
    const xOffset = e.nativeEvent.contentOffset.x;
    if (xOffset < 0 || xOffset > SCREEN_WIDTH * (TABS.length - 1)) return;
    const index = Math.round(xOffset / SCREEN_WIDTH);
    if (index >= 0 && index < TABS.length) {
      setActiveTab((prev) => (prev !== TABS[index] ? TABS[index] : prev));
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState message="Loading claimed rescues..." />
      </View>
    );
  }

  const isSuspended = currentUserProfile?.isSuspended || currentUserProfile?.volunteerStatus === 'suspended';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.heading}>Claimed Rescues</Text>
        <Text style={styles.subheading}>Volunteer workflow and active response status</Text>
      </View>

      {isSuspended ? (
        <View style={styles.suspensionBanner}>
          <Text style={styles.suspensionText}>Your volunteer account has been suspended.</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.filterWrap}>
        <View style={styles.filterRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'active' ? 'Active' : 'Completed';
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabPress(tab)}
                activeOpacity={0.85}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        contentContainerStyle={{ width: SCREEN_WIDTH * TABS.length }}
        scrollEventThrottle={16}
      >
        {/* Pane 0: Active */}
        <View style={{ width: SCREEN_WIDTH }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader title="Active rescues" subtitle="Cases still needing volunteer action." />
            {activeReports.length === 0 ? (
              <EmptyState title="No active rescues" message="Claimed rescues will appear here once you accept a case." style={styles.empty} />
            ) : (
              activeReports.map((report) => (
                <ClaimedRescueCard
                  key={report._id}
                  report={report}
                  distanceLabel={formatDistanceLabel(calculateDistanceKm(currentUserCoordinates, report.location?.coordinates))}
                  onPress={() => setSelectedReport(report)}
                />
              ))
            )}
          </ScrollView>
        </View>

        {/* Pane 1: Completed */}
        <View style={{ width: SCREEN_WIDTH }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader title="Resolved rescues" subtitle="Completed cases stay available for review." />
            {resolvedReports.length === 0 ? (
              <EmptyState title="No resolved rescues yet" message="Completed rescues will appear here." style={styles.empty} />
            ) : (
              resolvedReports.map((report) => (
                <ClaimedRescueCard
                  key={report._id}
                  report={report}
                  distanceLabel={formatDistanceLabel(calculateDistanceKm(currentUserCoordinates, report.location?.coordinates))}
                  onPress={() => setSelectedReport(report)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>

      <RescueDetailsModal
        visible={Boolean(selectedReport)}
        report={selectedReport}
        currentUserUid={volunteerUid}
        onClose={() => setSelectedReport(null)}
        onCancelRescue={selectedReport ? () => handleCancelRescue(selectedReport) : undefined}
        onUpdateProgress={selectedReport ? (nextProgress, resolutionDetails) => handleUpdateProgress(selectedReport, nextProgress, resolutionDetails) : undefined}
        cancellingRescue={selectedReport ? cancellingId === selectedReport._id : false}
        isSuspended={isSuspended}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  heading: {
    ...typography.title,
  },
  subheading: {
    ...typography.meta,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  suspensionBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },
  suspensionText: {
    color: colors.critical,
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    color: colors.critical,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    fontWeight: '800',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 108,
  },
  filterWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  empty: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  cardTitle: {
    ...typography.heading,
    fontSize: 19,
  },
  meta: {
    ...typography.meta,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  progressBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  progressLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  progressValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    ...typography.meta,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
  },
});
