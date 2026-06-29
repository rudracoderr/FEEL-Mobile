import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock, MapPin, Navigation, UserRound } from 'lucide-react-native';
import ReportImageGallery from './ReportImageGallery';
import Button from './ui/Button';
import Card from './ui/Card';
import SeverityBadge from './ui/SeverityBadge';
import StatusBadge from './ui/StatusBadge';
import { colors, radius, spacing, typography } from '../theme';

export default function RescueCard({
  report,
  imageUrl,
  imageUrls = [],
  title,
  description,
  severity = 'medium',
  reporterName,
  status = 'pending',
  distance,
  timeAgo,
  assignedVolunteerName,
  showAcceptButton = false,
  onAccept,
  onPress,
}) {
  const galleryImageUrls = imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [];
  const locationLabel = report?.address || report?.landmark || 'Location shared';

  const openGoogleMaps = () => {
    const coordinates = report?.location?.coordinates;

    if (!report?.location || !Array.isArray(coordinates) || coordinates.length !== 2) {
      Alert.alert('Location unavailable for this rescue.');
      return;
    }

    const longitude = coordinates[0];
    const latitude = coordinates[1];

    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      Alert.alert('Location unavailable for this rescue.');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Location unavailable for this rescue.');
    });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <Card style={styles.card}>
        <ReportImageGallery imageUrls={galleryImageUrls} height={176} style={styles.gallery} />

        <View style={styles.badgeRow}>
          <StatusBadge status={status} />
          <SeverityBadge severity={severity} />
        </View>

        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {description ? <Text style={styles.description} numberOfLines={2}>{description}</Text> : null}

        <View style={styles.metaList}>
          <MetaRow icon={MapPin} text={locationLabel} />
          {distance ? <MetaRow icon={Navigation} text={distance} /> : null}
          {timeAgo ? <MetaRow icon={Clock} text={timeAgo} /> : null}
          {assignedVolunteerName ? <MetaRow icon={UserRound} text={`Assigned to ${assignedVolunteerName}`} /> : null}
          {!assignedVolunteerName && reporterName ? <MetaRow icon={UserRound} text={`Reported by ${reporterName}`} /> : null}
        </View>

        <View style={styles.actions}>
          {showAcceptButton && onAccept ? (
            <Button label="Claim Rescue" onPress={onAccept} style={styles.actionButton} />
          ) : (
            <Button label="View Details" variant="secondary" onPress={onPress} style={styles.actionButton} />
          )}
          <Button label="Navigate" variant="outline" onPress={openGoogleMaps} style={styles.actionButton} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function MetaRow({ icon: Icon, text }) {
  return (
    <View style={styles.metaRow}>
      <Icon size={15} color={colors.textSecondary} strokeWidth={2.2} />
      <Text style={styles.metaText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  gallery: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  title: {
    ...typography.heading,
    fontSize: 19,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.meta,
    marginBottom: spacing.md,
  },
  metaList: {
    gap: 7,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    ...typography.meta,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
  },
});
