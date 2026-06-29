import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react-native';
import ReportImageGallery from './ReportImageGallery';
import Card from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import { BACKEND_BASE_URL, fetchWithTimeout, fetchPublicWithTimeout } from '../apiClient';
import { colors, radius, spacing, typography } from '../theme';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_FOLDER = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'feel-reports';

async function uploadResolutionImage(asset) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary upload settings are missing.');
  }

  const formData = new FormData();
  const fileName = asset.fileName || `resolution-${Date.now()}.jpg`;
  const finalName = fileName.includes('.') ? fileName : `${fileName}.jpg`;

  formData.append('file', {
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    name: finalName,
  });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  if (CLOUDINARY_FOLDER) {
    formData.append('folder', CLOUDINARY_FOLDER);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const responseText = await response.text();
  const responseData = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    throw new Error(responseData?.error?.message || 'Failed to upload resolution image');
  }

  if (!responseData.secure_url) {
    throw new Error('Cloudinary upload did not return an image URL.');
  }

  return responseData.secure_url;
}

const REASONS = ['Fake Report', 'Spam', 'Wrong Location', 'Duplicate Report', 'Other'];

function sanitizePhoneNumber(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function isValidPhoneNumber(value) {
  const digitsOnly = sanitizePhoneNumber(value).replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

function buildDialPhone(value) {
  return sanitizePhoneNumber(value).replace(/(?!^)\+/g, '');
}

function buildWhatsAppPhone(value) {
  const digitsOnly = sanitizePhoneNumber(value).replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }

  return digitsOnly;
}

function getPhoneFromContact(value) {
  if (!value) {
    return '';
  }

  const normalized = String(value).trim();
  return isValidPhoneNumber(normalized) ? normalized : '';
}

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return 'Date unavailable';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString();
}

async function handleCall(phone) {
  if (!phone) {
    Alert.alert('Phone unavailable', 'Phone number is not available yet.');
    return;
  }

  if (!isValidPhoneNumber(phone)) {
    Alert.alert('Invalid phone number', 'The phone number looks invalid.');
    return;
  }

  try {
    await Linking.openURL(`tel:${buildDialPhone(phone)}`);
  } catch (_error) {
    Alert.alert('Unable to open dialer', 'Please try calling manually.');
  }
}

async function handleWhatsApp(phone) {
  const whatsappPhone = buildWhatsAppPhone(phone);

  const webLink = `https://wa.me/${whatsappPhone}`;

  console.log('Opening:', webLink);

  await Linking.openURL(webLink);
}

export default function RescueDetailsModal({
  visible,
  report,
  currentUserUid,
  onClose,
  onCancelRescue,
  cancellingRescue,
  isSuspended,
  onUpdateProgress,
}) {
  const [resolutionFormVisible, setResolutionFormVisible] = useState(false);
  const [resolutionPhotoAsset, setResolutionPhotoAsset] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);
  const [isAbuseModalVisible, setIsAbuseModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [submittingAbuse, setSubmittingAbuse] = useState(false);
  const [hydratedReport, setHydratedReport] = useState(report || null);

  useEffect(() => {
    let isActive = true;

    if (!visible || !report?._id) {
      setHydratedReport(report || null);
      return () => {
        isActive = false;
      };
    }

    setHydratedReport(report || null);

    (async () => {
      try {
        const response = await fetchPublicWithTimeout(`${BACKEND_BASE_URL}/api/reports/${report._id}`);
        const fullReport = await response.json();

        if (!response.ok) {
          throw new Error(fullReport?.error || fullReport?.message || 'Failed to load rescue details.');
        }

        if (isActive) {
          setHydratedReport(fullReport);
        }
      } catch (error) {
        console.error('Failed to hydrate rescue details:', error);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [visible, report]);

  const displayReport = hydratedReport || report;
  const isResolved = (displayReport?.status || '').toLowerCase() === 'resolved';

  const pickResolutionPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to attach a resolution photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setResolutionPhotoAsset(result.assets[0]);
    } catch (error) {
      console.error('Resolution photo pick failed:', error);
      Alert.alert('Photo selection failed', error.message);
    }
  };

  const handleSubmitResolution = async () => {
    if (!displayReport?._id || !currentUserUid) {
      Alert.alert('Error', 'Required information is missing.');
      return;
    }

    const note = resolutionNote.trim();
    if (!resolutionPhotoAsset) {
      Alert.alert('Photo required', 'Please attach a resolution photo.');
      return;
    }

    if (!note) {
      Alert.alert('Note required', 'Please enter a resolution note.');
      return;
    }

    setResolutionSubmitting(true);
    try {
      const photoUrl = await uploadResolutionImage(resolutionPhotoAsset);

      if (typeof onUpdateProgress === 'function') {
        await onUpdateProgress('Resolved', {
          photoUrl,
          note,
        });
      }

      setResolutionFormVisible(false);
      setResolutionPhotoAsset(null);
      setResolutionNote('');
    } catch (error) {
      console.error('Resolution submission failed:', error);
      Alert.alert('Failed to resolve', error.message || 'Please try again.');
    } finally {
      setResolutionSubmitting(false);
    }
  };

  const openResolutionForm = () => {
    setResolutionPhotoAsset(null);
    setResolutionNote('');
    setResolutionFormVisible(true);
  };

  const closeResolutionForm = () => {
    if (resolutionSubmitting) return;
    setResolutionFormVisible(false);
    setResolutionPhotoAsset(null);
    setResolutionNote('');
  };

  const submitAbuseReport = async () => {
    if (!report?._id || !currentUserUid || !selectedReason) {
      Alert.alert('Error', 'Required fields are missing.');
      return;
    }

    try {
      setSubmittingAbuse(true);
      const response = await fetchWithTimeout(
        `${BACKEND_BASE_URL}/api/reports/${displayReport._id}/abuse`,
        {
          method: 'POST',
          body: JSON.stringify({
            reportedByUid: currentUserUid,
            reason: selectedReason,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to submit abuse report.');
      }

      Alert.alert(
        'Thank you',
        'This report has been flagged for review.',
        [{
          text: 'OK',
          onPress: () => {
            setIsAbuseModalVisible(false);
            setSelectedReason(null);
          },
        }]
      );
    } catch (err) {
      console.error('Failed to submit abuse report:', err);
      Alert.alert('Error', err.message || 'Failed to submit abuse report.');
    } finally {
      setSubmittingAbuse(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.82} hitSlop={10}>
            <X size={22} color={colors.text} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {displayReport ? (
            <>
              {/* Image Gallery */}
              <View style={styles.imageWrap}>
                <ReportImageGallery
                  imageUrls={displayReport.imageUrls || []}
                  height={280}
                  borderRadius={radius.lg}
                  style={styles.galleryImage}
                  counterStyle={styles.galleryCounter}
                />
              </View>

              {/* Report Info Card */}
              <Card style={styles.infoCard}>
                <View style={styles.badgeRow}>
                  <StatusBadge status={displayReport.status} />
                </View>
                <Text style={styles.title}>{displayReport.title}</Text>
                <View style={styles.metaRow}>
                  <UserRound size={15} color={colors.textSecondary} strokeWidth={2.2} />
                  <Text style={styles.metaText}>Reporter: {displayReport.reporterName || 'Anonymous'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <ShieldCheck size={15} color={colors.textSecondary} strokeWidth={2.2} />
                  <Text style={styles.metaText}>Progress: {displayReport.volunteerProgress || 'Assigned'}</Text>
                </View>
                {displayReport.address ? (
                  <View style={styles.metaRow}>
                    <MapPin size={15} color={colors.textSecondary} strokeWidth={2.2} />
                    <Text style={styles.metaText}>{displayReport.address}</Text>
                  </View>
                ) : null}
                {displayReport.landmark ? (
                  <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
                    <MapPin size={15} color={colors.textSecondary} strokeWidth={2.2} />
                    <Text style={styles.metaText}>Landmark: {displayReport.landmark}</Text>
                  </View>
                ) : null}
              </Card>

              {/* Resolution Section (if resolved) */}
              {isResolved ? (
                <View style={styles.resolutionSection}>
                  <View style={styles.resolutionHeader}>
                    <CheckCircle size={18} color={colors.success} strokeWidth={2.5} />
                    <Text style={styles.resolutionHeading}>Resolved</Text>
                  </View>
                  <Text style={styles.resolutionLabel}>Admin Remark</Text>
                  <Text style={styles.resolutionBody}>
                    {displayReport.resolutionRemark || 'No admin remark provided.'}
                  </Text>
                  <Text style={styles.resolutionLabel}>Resolved At</Text>
                  <Text style={styles.resolutionDate}>{formatDateLabel(displayReport.resolvedAt)}</Text>
                </View>
              ) : null}

              {/* Timeline Section */}
              <Card style={styles.timelineCard}>
                <Text style={styles.sectionHeading}>Rescue Timeline</Text>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineBody}>
                    <View style={styles.timelineLabelRow}>
                      <FileText size={15} color={colors.primary} strokeWidth={2.3} />
                      <Text style={styles.timelineLabel}>Report Created</Text>
                    </View>
                    <Text style={styles.timelineDate}>{formatDateLabel(displayReport.date || displayReport.createdAt)}</Text>
                  </View>
                </View>
                {displayReport.acceptedAt ? (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotPrimary]} />
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineLabelRow}>
                        <ShieldCheck size={15} color={colors.primary} strokeWidth={2.3} />
                        <Text style={styles.timelineLabel}>Volunteer Accepted</Text>
                      </View>
                      <Text style={styles.timelineDate}>{formatDateLabel(displayReport.acceptedAt)}</Text>
                    </View>
                  </View>
                ) : null}
                {displayReport.resolvedAt ? (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotSuccess]} />
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineLabelRow}>
                        <CheckCircle size={15} color={colors.success} strokeWidth={2.3} />
                        <Text style={styles.timelineLabel}>Rescue Resolved</Text>
                      </View>
                      <Text style={styles.timelineDate}>{formatDateLabel(displayReport.resolvedAt)}</Text>
                    </View>
                  </View>
                ) : null}
              </Card>

              {/* Volunteer Section */}
              <Card style={styles.volunteerCard}>
                <Text style={styles.sectionHeading}>Volunteer Responding</Text>
                {displayReport.assignedVolunteer?.uid ? (
                  <View style={styles.metaRow}>
                    <UserRound size={15} color={colors.textSecondary} strokeWidth={2.2} />
                    <Text style={styles.metaText}>
                      Name: {displayReport.assignedVolunteer.fullName || 'Unknown volunteer'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.metaText}>Volunteer not assigned yet.</Text>
                )}

                {(() => {
                  const reportStatus = (displayReport.status || '').toLowerCase();
                  const isContactPhase = ['accepted', 'resolved'].includes(reportStatus);
                  const isReporter = currentUserUid === displayReport.reporterUid;
                  const assignedVolunteerUid = displayReport.assignedVolunteer?.uid || null;
                  const isAssignedVolunteer = currentUserUid === assignedVolunteerUid;
                  const volunteerPhone = displayReport.assignedVolunteer?.phone || '';
                  const reporterPhone = getPhoneFromContact(displayReport.reporterContact);

                  if (!isContactPhase) {
                    return null;
                  }

                  if (isReporter && assignedVolunteerUid) {
                    return (
                      <>
                        <View style={styles.metaRow}>
                          <Phone size={15} color={colors.textSecondary} strokeWidth={2.2} />
                          <Text style={styles.metaText}>Phone: {volunteerPhone || 'Not available'}</Text>
                        </View>
                        <View style={styles.contactActions}>
                          <TouchableOpacity
                            style={[styles.contactButton, styles.callButton]}
                            onPress={() => handleCall(volunteerPhone)}
                            activeOpacity={0.85}
                          >
                            <Phone size={16} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.contactButtonText}>Call Volunteer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.contactButton, styles.whatsappButton]}
                            onPress={() => handleWhatsApp(volunteerPhone)}
                            activeOpacity={0.85}
                          >
                            <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.contactButtonText}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );
                  }

                  if (isAssignedVolunteer) {
                    const handleCancelPress = () => {
                      Alert.alert(
                        'Release Rescue',
                        'Are you sure you want to release this rescue? It will become available again for other volunteers.',
                        [
                          { text: 'Keep Rescue', style: 'cancel' },
                          {
                            text: 'Release',
                            style: 'destructive',
                            onPress: () => {
                              if (typeof onCancelRescue === 'function') {
                                onCancelRescue();
                              }
                            },
                          },
                        ],
                        { cancelable: true }
                      );
                    };

                    return (
                      <View style={styles.reporterSection}>
                        <Text style={styles.subsectionHeading}>Reporter Information</Text>
                        <View style={styles.metaRow}>
                          <UserRound size={15} color={colors.textSecondary} strokeWidth={2.2} />
                          <Text style={styles.metaText}>Name: {displayReport.reporterName || 'Anonymous'}</Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Phone size={15} color={colors.textSecondary} strokeWidth={2.2} />
                          <Text style={styles.metaText}>Phone: {reporterPhone || 'Not available'}</Text>
                        </View>
                        <View style={styles.contactActions}>
                          <TouchableOpacity
                            style={[styles.contactButton, styles.callButton]}
                            onPress={() => handleCall(reporterPhone)}
                            activeOpacity={0.85}
                          >
                            <Phone size={16} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.contactButtonText}>Call Reporter</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.contactButton, styles.whatsappButton]}
                            onPress={() => handleWhatsApp(reporterPhone)}
                            activeOpacity={0.85}
                          >
                            <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.contactButtonText}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>

                        {displayReport.status === 'accepted' && (
                          <View style={styles.progressSection}>
                            <Text style={styles.progressHeading}>Update Rescue Progress</Text>
                            {(displayReport.volunteerProgress || 'Assigned') === 'Assigned' && (
                              <TouchableOpacity
                                style={styles.progressButton}
                                onPress={() => onUpdateProgress && onUpdateProgress('On The Way')}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.progressButtonText}>On The Way</Text>
                              </TouchableOpacity>
                            )}
                            {(displayReport.volunteerProgress || 'Assigned') === 'On The Way' && (
                              <TouchableOpacity
                                style={styles.progressButton}
                                onPress={() => onUpdateProgress && onUpdateProgress('Reached Location')}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.progressButtonText}>Reached Location</Text>
                              </TouchableOpacity>
                            )}
                            {(displayReport.volunteerProgress || 'Assigned') === 'Reached Location' && (
                              <TouchableOpacity
                                style={[styles.progressButton, styles.progressResolveButton]}
                                onPress={openResolutionForm}
                                activeOpacity={0.85}
                              >
                                <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={styles.progressButtonText}>Mark as Resolved</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        <TouchableOpacity
                          style={[styles.cancelButton, (cancellingRescue || isSuspended) && styles.cancelButtonDisabled]}
                          onPress={handleCancelPress}
                          disabled={Boolean(cancellingRescue) || Boolean(isSuspended)}
                          activeOpacity={0.85}
                        >
                          {cancellingRescue ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.cancelButtonText}>Cancel Rescue</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return null;
                })()}
              </Card>

              {/* Description */}
              {displayReport.description ? (
                <Card style={styles.descriptionCard}>
                  <Text style={styles.sectionHeading}>Description</Text>
                  <Text style={styles.descriptionText}>{displayReport.description}</Text>
                </Card>
              ) : null}

              {/* Report Abuse Button */}
              {currentUserUid ? (
                <TouchableOpacity
                  style={styles.abuseButton}
                  onPress={() => setIsAbuseModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <AlertTriangle size={18} color={colors.critical} strokeWidth={2.3} />
                  <Text style={styles.abuseButtonText}>Report Abuse</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>

      {/* Report Abuse Modal */}
      <Modal
        visible={isAbuseModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!submittingAbuse) {
            setIsAbuseModalVisible(false);
            setSelectedReason(null);
          }
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (!submittingAbuse) {
              setIsAbuseModalVisible(false);
              setSelectedReason(null);
            }
          }}
        >
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Report Abuse</Text>
            <Text style={styles.modalSubtitle}>
              Why are you reporting this rescue report? Your report helps us keep the community safe.
            </Text>

            {REASONS.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                  onPress={() => setSelectedReason(r)}
                  activeOpacity={0.8}
                  disabled={submittingAbuse}
                >
                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.reasonText, isSelected && styles.reasonTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {submittingAbuse && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => {
                  setIsAbuseModalVisible(false);
                  setSelectedReason(null);
                }}
                disabled={submittingAbuse}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  styles.modalSubmitButton,
                  (!selectedReason || submittingAbuse) && styles.modalSubmitButtonDisabled,
                ]}
                onPress={submitAbuseReport}
                disabled={!selectedReason || submittingAbuse}
              >
                <Text style={styles.modalSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Resolution Form Modal */}
      <Modal
        visible={resolutionFormVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeResolutionForm}
      >
        <Pressable style={styles.overlay} onPress={closeResolutionForm}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Mark as Resolved</Text>
            <Text style={styles.modalSubtitle}>
              Provide a photo and note to document the rescue outcome.
            </Text>

            {/* Photo picker */}
            <TouchableOpacity
              style={styles.photoButton}
              onPress={pickResolutionPhoto}
              disabled={resolutionSubmitting}
              activeOpacity={0.85}
            >
              {resolutionPhotoAsset ? (
                <Image
                  source={{ uri: resolutionPhotoAsset.uri }}
                  style={styles.photoPreview}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Camera size={28} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.photoButtonText}>Add Resolution Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {resolutionPhotoAsset && (
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setResolutionPhotoAsset(null)}
                disabled={resolutionSubmitting}
              >
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </TouchableOpacity>
            )}

            {/* Note input */}
            <TextInput
              style={styles.noteInput}
              placeholder="Rescue outcome notes..."
              placeholderTextColor={colors.textMuted}
              value={resolutionNote}
              onChangeText={setResolutionNote}
              multiline
              textAlignVertical="top"
              editable={!resolutionSubmitting}
            />

            {resolutionSubmitting && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={closeResolutionForm}
                disabled={resolutionSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  styles.resolutionSubmitButton,
                  ((!resolutionPhotoAsset || !resolutionNote.trim() || resolutionSubmitting)) && styles.modalSubmitButtonDisabled,
                ]}
                onPress={handleSubmitResolution}
                disabled={!resolutionPhotoAsset || !resolutionNote.trim() || resolutionSubmitting}
              >
                <Text style={styles.modalSubmitText}>Confirm Resolve</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  imageWrap: {
    marginBottom: spacing.lg,
  },
  galleryImage: {
    width: '100%',
  },
  galleryCounter: {
    right: spacing.md,
    bottom: spacing.md,
  },
  infoCard: {
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 24,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.meta,
    fontWeight: '700',
    flex: 1,
  },
  resolutionSection: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resolutionHeading: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '900',
  },
  resolutionLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: 3,
  },
  resolutionBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  resolutionDate: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineCard: {
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    ...typography.body,
    fontWeight: '900',
    fontSize: 15,
    marginBottom: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
    marginTop: 5,
  },
  timelineDotPrimary: {
    backgroundColor: colors.primary,
  },
  timelineDotSuccess: {
    backgroundColor: colors.success,
  },
  timelineBody: {
    flex: 1,
  },
  timelineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  timelineLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  timelineDate: {
    ...typography.meta,
    marginTop: 2,
  },
  volunteerCard: {
    marginBottom: spacing.lg,
  },
  subsectionHeading: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  contactActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  callButton: {
    backgroundColor: '#2563EB',
  },
  whatsappButton: {
    backgroundColor: colors.success,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reporterSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  progressSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  progressHeading: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  progressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginBottom: spacing.sm,
  },
  progressResolveButton: {
    backgroundColor: colors.success,
  },
  progressButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  cancelButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.critical,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  descriptionCard: {
    marginBottom: spacing.lg,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  abuseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  abuseButtonText: {
    color: colors.critical,
    fontSize: 14,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.body,
    fontWeight: '900',
    fontSize: 20,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    ...typography.meta,
    marginBottom: spacing.xl,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  reasonOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  reasonTextActive: {
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalSubmitButton: {
    backgroundColor: colors.primary,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.45,
    backgroundColor: colors.primary,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  photoButton: {
    height: 150,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
  },
  photoButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  removePhotoButton: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  removePhotoText: {
    color: colors.critical,
    fontSize: 13,
    fontWeight: '700',
  },
  noteInput: {
    height: 110,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  resolutionSubmitButton: {
    backgroundColor: colors.success,
  },
});
