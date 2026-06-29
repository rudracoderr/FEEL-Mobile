import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, X, MapPin } from 'lucide-react-native';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { colors, radius, spacing, typography } from '../theme';
import { BACKEND_BASE_URL, fetchPublicWithTimeout } from '../apiClient';

export default function AdoptScreen() {
  const navigation = useNavigation();
  const [adoptions, setAdoptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAdoption, setSelectedAdoption] = useState(null);

  const fetchAdoptions = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const response = await fetchPublicWithTimeout(`${BACKEND_BASE_URL}/api/adoptions`);
      const data = await response.json();
      if (response.ok && data.success) {
        setAdoptions(data.adoptionListings);
      }
    } catch (error) {
      console.error('Failed to fetch adoptions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdoptions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdoptions(true);
  };

  const renderCard = ({ item }) => {
    const photoUrl = item.photos && item.photos.length > 0 ? item.photos[0] : null;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => setSelectedAdoption(item)}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.animalName}</Text>
          <Text style={styles.cardSubtitle}>
            {item.species}{item.breed ? ` • ${item.breed}` : ''}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.age}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.gender}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={styles.locationText}>
              {item.location?.city}, {item.location?.state}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Button
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>Adopt a Friend</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingState message="Loading adoptions..." />
        </View>
      ) : adoptions.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            title="No adoptions"
            message="No adoption listings available yet."
          />
        </View>
      ) : (
        <FlatList
          data={adoptions}
          keyExtractor={(item) => item._id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Details Modal */}
      <Modal
        visible={Boolean(selectedAdoption)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAdoption(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAdoption && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedAdoption.animalName}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedAdoption(null)}
                  >
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView contentContainerStyle={styles.modalScroll}>
                  {selectedAdoption.photos && selectedAdoption.photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalImageScroll}>
                      {selectedAdoption.photos.map((photo, index) => (
                        <Image key={index} source={{ uri: photo }} style={styles.modalImage} />
                      ))}
                    </ScrollView>
                  )}
                  
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.descriptionText}>{selectedAdoption.description || 'No description provided.'}</Text>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Species:</Text>
                      <Text style={styles.detailValue}>{selectedAdoption.species}</Text>
                    </View>
                    {selectedAdoption.breed ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Breed:</Text>
                        <Text style={styles.detailValue}>{selectedAdoption.breed}</Text>
                      </View>
                    ) : null}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Age:</Text>
                      <Text style={styles.detailValue}>{selectedAdoption.age}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Gender:</Text>
                      <Text style={styles.detailValue}>{selectedAdoption.gender}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Location:</Text>
                      <Text style={styles.detailValue}>
                        {selectedAdoption.location?.city}, {selectedAdoption.location?.state}
                        {selectedAdoption.location?.area ? ` (${selectedAdoption.location.area})` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Health Details</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Vaccinated:</Text>
                      <Text style={styles.detailValue}>{selectedAdoption.health?.vaccinated ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sterilized:</Text>
                      <Text style={styles.detailValue}>{selectedAdoption.health?.sterilized ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    paddingHorizontal: 0,
    borderColor: colors.border,
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 18,
  },
  headerPlaceholder: {
    width: 44,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textSecondary,
    ...typography.body,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.heading,
    fontSize: 18,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  modalImageScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  modalImage: {
    width: 280,
    height: 220,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  modalSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    ...typography.body,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  detailValue: {
    ...typography.body,
    fontWeight: '600',
  },
});
