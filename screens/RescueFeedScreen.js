import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import * as Location from 'expo-location';
import { auth } from '../firebase';
import { BACKEND_BASE_URL, UnauthenticatedError, fetchPublicWithTimeout, fetchWithTimeout } from '../apiClient';
import RescueCard from '../components/RescueCard';
import RescueDetailsModal from '../components/RescueDetailsModal';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import StatusModal from '../components/ui/StatusModal';
import { normalizeApiError } from '../utils/apiErrorHandler';
import { colors, radius, spacing, typography } from '../theme';

const FILTERS = ['pending', 'accepted', 'resolved'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RADIUS_FILTERS = [
  { label: 'All', value: null },
  { label: '3 km', value: 3 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
];

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
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) return null;
  const rounded = Math.round(distanceKm * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} km away`;
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function normalizeReports(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reports)) return data.reports;
  return [];
}

export default function RescueFeedScreen() {
  const [reports, setReports] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [currentFirebaseUser, setCurrentFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [activeRadius, setActiveRadius] = useState(null); // null = All
  const [radiusSheetVisible, setRadiusSheetVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude }
  const horizontalScrollRef = useRef(null);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState({
    type: 'info',
    title: '',
    message: '',
  });

  const closeStatusModal = () => setStatusModalVisible(false);
  const openStatusModal = (config) => {
    setStatusModalConfig(config);
    setStatusModalVisible(true);
  };

  useEffect(() => {
    let isMounted = true;

    // Request location permission and get current position
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted) setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch (_) {
        // Location unavailable — radius filter will stay hidden
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setCurrentFirebaseUser(user || null);

      if (user) {
        // Authenticated: load this user's profile for volunteer features.
        try {
          const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/users/${user.uid}`);
          const responseText = await response.text();
          if (response.status === 404) {
            if (isMounted) setCurrentUserProfile(null);
          } else if (response.ok && responseText && isMounted) {
            setCurrentUserProfile(JSON.parse(responseText));
          }
        } catch (error) {
          console.error('Failed to load current user profile:', error);
          if (isMounted) setCurrentUserProfile(null);
        }
      } else {
        // Guest: no profile to load.
        if (isMounted) setCurrentUserProfile(null);
      }

      // Always fetch reports — guests see the feed too.
      fetchReports();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const fetchReports = async (isRefresh = false, radiusKm = activeRadius, location = userLocation) => {
    try {
      if (!isRefresh) setLoading(true);
      let url = `${BACKEND_BASE_URL}/api/reports`;
      if (radiusKm && location) {
        url += `?lat=${location.latitude}&lng=${location.longitude}&radius=${radiusKm}`;
      }
      // Public endpoint — no auth required, works for guests and signed-in users.
      const response = await fetchPublicWithTimeout(url);
      const data = await response.json();
      setReports(normalizeReports(data).reverse());
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        // User logged out — this is expected, suppress the alert silently.
        return;
      }
      console.error('Failed to fetch rescue reports:', error);
      const apiError = normalizeApiError(error, { fallbackMessage: 'Could not load rescue feed' });
      openStatusModal({
        type: 'error',
        title: apiError.title,
        message: apiError.message,
        primaryButton: {
          ...apiError.primaryAction,
          onPress: apiError.primaryAction?.label === 'Try Again' ? () => {
            closeStatusModal();
            onRefresh();
          } : closeStatusModal,
        },
        secondaryButton: apiError.secondaryAction ? {
          ...apiError.secondaryAction,
          onPress: closeStatusModal,
        } : undefined,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptReport = async (report) => {
    if (!currentFirebaseUser?.uid) {
      openStatusModal({
        type: 'warning',
        title: 'Sign in required',
        message: 'Please sign in again to accept this rescue.',
      });
      return;
    }

    const rescueAlreadyClaimedMessage = 'Rescue already claimed by another volunteer.';

    try {
      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/${report._id}/accept`, {
        method: 'PATCH',
        body: JSON.stringify({ uid: currentFirebaseUser.uid }),
      });
      const data = await response.json();

      if (response.status === 409 || data?.success === false) {
        openStatusModal({
          type: 'warning',
          title: 'Unable to accept',
          message: rescueAlreadyClaimedMessage,
        });
        return;
      }

      const refreshResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/${report._id}`);
      const refreshedReport = await refreshResponse.json();
      if (!refreshResponse.ok) {
        throw new Error(refreshedReport?.error || refreshedReport?.message || 'Failed to refresh rescue status');
      }

      setReports((previousReports) =>
        previousReports.map((item) => (item._id === refreshedReport._id ? refreshedReport : item))
      );
      if (selectedReport?._id === refreshedReport._id) setSelectedReport(refreshedReport);

      if (refreshedReport?.assignedVolunteer?.uid !== currentFirebaseUser.uid) {
        openStatusModal({
          type: 'warning',
          title: 'Unable to accept',
          message: rescueAlreadyClaimedMessage,
        });
        return;
      }

      openStatusModal({
        type: 'success',
        title: 'Accepted',
        message: 'You are now assigned to this rescue.',
      });
    } catch (error) {
      const apiError = normalizeApiError(error, { fallbackMessage: 'Please try again.' });
      openStatusModal({
        type: 'error',
        title: 'Unable to accept',
        message: apiError.message,
      });
    }
  };

  const currentUserCoordinates = currentUserProfile?.location?.coordinates;
  const currentUserIsVolunteer = Boolean(currentUserProfile?.isVolunteer);

  const displayReports = useMemo(() => reports.map((report) => {
    const distanceKm = calculateDistanceKm(currentUserCoordinates, report.location?.coordinates);
    return { ...report, distanceKm, distanceLabel: formatDistanceLabel(distanceKm) };
  }), [reports, currentUserCoordinates]);

  const reportsByFilter = useMemo(() => {
    const groups = { pending: [], accepted: [], resolved: [] };
    displayReports.forEach((report) => {
      const status = (report.status || 'pending').toLowerCase();
      if (groups[status]) {
        groups[status].push(report);
      }
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      });
    });

    return groups;
  }, [displayReports]);

  const filteredReportsCount = useMemo(() => {
    return (reportsByFilter[activeFilter] || []).length;
  }, [reportsByFilter, activeFilter]);

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetchReports(true, activeRadius, userLocation);
  };

  const handleRadiusChange = (value) => {
    setRadiusSheetVisible(false);
    setActiveRadius(value);
    fetchReports(false, value, userLocation);
  };

  const activeRadiusLabel = RADIUS_FILTERS.find((rf) => rf.value === activeRadius)?.label ?? 'All';

  const handleFilterPress = (filter) => {
    setActiveFilter(filter);
    const index = FILTERS.indexOf(filter);
    if (index !== -1) {
      horizontalScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    }
  };

  const onScroll = (e) => {
    const xOffset = e.nativeEvent.contentOffset.x;
    if (xOffset < 0 || xOffset > SCREEN_WIDTH * (FILTERS.length - 1)) return;
    const index = Math.round(xOffset / SCREEN_WIDTH);
    if (index >= 0 && index < FILTERS.length) {
      setActiveFilter((prev) => (prev !== FILTERS[index] ? FILTERS[index] : prev));
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState message="Loading rescue alerts..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusModal
        visible={statusModalVisible}
        type={statusModalConfig.type}
        title={statusModalConfig.title}
        message={statusModalConfig.message}
        primaryButton={
          statusModalConfig.primaryButton || {
            label: 'OK',
            onPress: closeStatusModal,
            variant: 'primary',
          }
        }
        secondaryButton={statusModalConfig.secondaryButton}
        onRequestClose={closeStatusModal}
      />
      {/* ── Compact header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Rescue Feed</Text>
          <Text style={styles.subtitle}>{filteredReportsCount} reports nearby</Text>
        </View>
        {userLocation ? (
          <TouchableOpacity
            style={styles.radiusPill}
            onPress={() => setRadiusSheetVisible(true)}
            activeOpacity={0.82}
          >
            <Text style={styles.radiusPillText}>📍 {activeRadiusLabel} ▼</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {(currentUserProfile?.isSuspended || currentUserProfile?.volunteerStatus === 'suspended') ? (
        <View style={styles.suspensionBanner}>
          <Text style={styles.suspensionText}>Your volunteer account has been suspended.</Text>
        </View>
      ) : null}

      {/* ── Status filter chips ─────────────────────────────── */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            const label = filter.charAt(0).toUpperCase() + filter.slice(1);
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => handleFilterPress(filter)}
                activeOpacity={0.85}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        contentContainerStyle={{ width: SCREEN_WIDTH * FILTERS.length }}
        scrollEventThrottle={16}
      >
        {FILTERS.map((filter) => {
          const list = reportsByFilter[filter] || [];
          return (
            <View key={filter} style={{ width: SCREEN_WIDTH }}>
              {list.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    title="No rescue alerts"
                    message={`No ${filter} rescues found.`}
                  />
                </View>
              ) : (
                <FlatList
                  data={list}
                  keyExtractor={(item, index) => item._id || String(index)}
                  contentContainerStyle={styles.feedContainer}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primary}
                      colors={[colors.primary]}
                    />
                  }
                  initialNumToRender={6}
                  maxToRenderPerBatch={8}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  renderItem={({ item: report }) => (
                    <RescueCard
                      report={report}
                      imageUrls={report.imageUrls || []}
                      title={report.title}
                      description={report.description}
                      severity={report.severity || 'medium'}
                      reporterName={report.reporterName}
                      status={report.status || 'pending'}
                      distance={report.distanceLabel}
                      timeAgo={getTimeAgo(report.date || report.createdAt)}
                      assignedVolunteerName={report.assignedVolunteer?.fullName}
                      showAcceptButton={
                        currentUserIsVolunteer &&
                        !currentUserProfile?.isSuspended &&
                        currentUserProfile?.volunteerStatus !== 'suspended' &&
                        (report.status || 'pending') === 'pending' &&
                        typeof report.distanceKm === 'number' &&
                        report.distanceKm <= 10
                      }
                      onAccept={() => handleAcceptReport(report)}
                      onPress={() => setSelectedReport(report)}
                    />
                  )}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      <RescueDetailsModal
        visible={Boolean(selectedReport)}
        report={selectedReport}
        currentUserUid={currentFirebaseUser?.uid || null}
        onClose={() => setSelectedReport(null)}
      />

      {/* ── Radius action sheet ─────────────────────────────── */}
      <Modal
        visible={radiusSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRadiusSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setRadiusSheetVisible(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Search Radius</Text>
            {RADIUS_FILTERS.map((rf) => {
              const isActive = activeRadius === rf.value;
              return (
                <TouchableOpacity
                  key={String(rf.value)}
                  style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
                  onPress={() => handleRadiusChange(rf.value)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>
                    {rf.label === 'All' ? '🌍  All distances' : `📍  Within ${rf.label}`}
                  </Text>
                  {isActive && <Text style={styles.sheetOptionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setRadiusSheetVisible(false)}
              activeOpacity={0.82}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header: title+count left, radius pill right
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.meta,
    marginTop: 2,
    fontWeight: '700',
  },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginLeft: spacing.md,
  },
  radiusPillText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  suspensionBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  suspensionText: {
    color: colors.critical,
    fontWeight: '800',
    fontSize: 13,
  },
  filterWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterRow: {
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
  feedContainer: {
    padding: spacing.lg,
    paddingBottom: 108,
  },
  emptyWrap: {
    padding: spacing.lg,
  },
  // Radius action sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.heading,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  sheetOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  sheetOptionText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '800',
  },
  sheetOptionTextActive: {
    color: colors.primary,
  },
  sheetOptionCheck: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  sheetCancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '900',
  },
});
