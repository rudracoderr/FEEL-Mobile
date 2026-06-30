import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, UserRound } from 'lucide-react-native';
import { auth } from '../firebase';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';
import RescueDetailsModal from '../components/RescueDetailsModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import StatusModal from '../components/ui/StatusModal';
import SeverityBadge from '../components/ui/SeverityBadge';
import { normalizeApiError } from '../utils/apiErrorHandler';
import { colors, radius, spacing, typography } from '../theme';

const FILTERS = ['all', 'pending', 'accepted', 'resolved'];

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
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

export default function MyReportsScreen() {
  const navigation = useNavigation();
  const [currentUserUid, setCurrentUserUid] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screenError, setScreenError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted) setCurrentUserUid(user?.uid || null);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const fetchMyReports = useCallback(async (isRefresh = false) => {
    if (!currentUserUid) {
      setReports([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setScreenError(null);
      if (!isRefresh) setLoading(true);
      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports/by-reporter/${currentUserUid}`);
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load your reports');
      }
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (fetchError) {
      const apiError = normalizeApiError(fetchError, { fallbackMessage: 'Failed to load your reports' });
      
      if (isRefresh) {
        openStatusModal({
          type: 'error',
          title: apiError.title,
          message: apiError.message,
          primaryButton: {
            ...apiError.primaryAction,
            onPress: apiError.primaryAction?.label === 'Try Again' ? () => {
              closeStatusModal();
              setRefreshing(true);
              fetchMyReports(true);
            } : closeStatusModal,
          },
          secondaryButton: apiError.secondaryAction ? {
            ...apiError.secondaryAction,
            onPress: closeStatusModal,
          } : undefined,
        });
      } else {
        setScreenError({
          title: apiError.title,
          message: apiError.message,
          primaryAction: apiError.primaryAction,
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserUid]);

  useEffect(() => {
    if (currentUserUid !== null) fetchMyReports();
  }, [currentUserUid, fetchMyReports]);

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetchMyReports(true);
  };

  const filteredReports = useMemo(
    () => reports.filter((report) => activeFilter === 'all' || (report.status || 'pending').toLowerCase() === activeFilter),
    [reports, activeFilter]
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header onBack={() => navigation.goBack()} count={null} />
        <LoadingState message="Loading your reports..." />
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
      <Header onBack={() => navigation.goBack()} count={reports.length} />

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            const label = filter.charAt(0).toUpperCase() + filter.slice(1);
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.85}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {screenError ? (
        <View style={styles.content}>
          <EmptyState title={screenError.title || 'Something went wrong'} message={screenError.message} />
          {screenError.primaryAction?.label === 'Try Again' && (
            <Button 
              label="Try Again" 
              onPress={() => fetchMyReports(false)} 
              variant="primary" 
              style={{ marginTop: spacing.xl }} 
            />
          )}
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.content}>
          <EmptyState
            title={activeFilter === 'all' ? "You haven't submitted any reports yet" : `No ${activeFilter} reports`}
            message={activeFilter === 'all' ? 'Submitted reports will appear here with status and resolution updates.' : 'Try a different filter above.'}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          <SectionHeader title="Report history" subtitle="Track status, volunteer assignment, and resolution proof." />
          {filteredReports.map((report) => (
            <TouchableOpacity key={report._id} activeOpacity={0.88} onPress={() => setSelectedReport(report)}>
              <Card style={styles.reportCard}>
                <View style={styles.cardTop}>
                  <View style={styles.badges}>
                    <StatusBadge status={report.status} />
                    <SeverityBadge severity={report.severity} />
                  </View>
                  <Text style={styles.time}>{getTimeAgo(report.date || report.createdAt)}</Text>
                </View>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <Text style={styles.reportMeta}>{report.address || report.landmark || 'Location shared'}</Text>
                <View style={styles.volunteerRow}>
                  <UserRound size={16} color={colors.textSecondary} strokeWidth={2.2} />
                  <Text style={styles.volunteerText}>
                    {report.assignedVolunteer?.fullName
                      ? `Assigned to ${report.assignedVolunteer.fullName}`
                      : 'Volunteer not assigned yet'}
                  </Text>
                </View>
                {report.status === 'resolved' && report.resolutionRemark ? (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Resolution update</Text>
                    <Text style={styles.resolutionText} numberOfLines={2}>{report.resolutionRemark}</Text>
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <RescueDetailsModal
        visible={Boolean(selectedReport)}
        report={selectedReport}
        currentUserUid={currentUserUid}
        onClose={() => setSelectedReport(null)}
      />
    </View>
  );
}

function Header({ onBack, count }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.75} hitSlop={10}>
        <ArrowLeft size={21} color={colors.text} strokeWidth={2.4} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.title}>My Reports</Text>
        {count !== null ? (
          <Text style={styles.subtitle}>{count === 0 ? 'No reports yet' : `${count} report${count !== 1 ? 's' : ''} submitted`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 28,
  },
  subtitle: {
    ...typography.meta,
    marginTop: 2,
    fontWeight: '700',
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
    paddingVertical: 9,
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
  content: {
    padding: spacing.lg,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 108,
  },
  reportCard: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  time: {
    ...typography.meta,
    fontWeight: '800',
  },
  reportTitle: {
    ...typography.heading,
    fontSize: 18,
  },
  reportMeta: {
    ...typography.meta,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  volunteerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  volunteerText: {
    flex: 1,
    ...typography.meta,
    fontWeight: '800',
  },
  resolutionBox: {
    marginTop: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  resolutionLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  resolutionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
