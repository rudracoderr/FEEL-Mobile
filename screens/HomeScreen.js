import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
import { useForm, Controller } from 'react-hook-form';
import { Bell, Camera, HeartHandshake, MapPin, Plus, RefreshCw, PawPrint, Home } from 'lucide-react-native';
import { auth } from '../firebase';
import { BACKEND_BASE_URL, UnauthenticatedError, fetchPublicWithTimeout, fetchWithTimeout } from '../apiClient';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import StatusModal from '../components/ui/StatusModal';
import SectionHeader from '../components/ui/SectionHeader';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge from '../components/ui/StatusBadge';
import { normalizeApiError } from '../utils/apiErrorHandler';
import { normalizeDeviceError } from '../utils/deviceErrorHandler';
import { colors, radius, spacing, typography } from '../theme';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_FOLDER = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'feel-reports';

function buildCloudinaryFileName(asset, index) {
  const fileName = asset.fileName || `report-image-${Date.now()}-${index + 1}`;

  if (fileName.includes('.')) {
    return fileName;
  }

  const mimeType = asset.mimeType || '';
  const extension = mimeType.split('/')[1] || 'jpg';
  return `${fileName}.${extension}`;
}

async function uploadImageToCloudinary(asset, index) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary upload settings are missing.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    type: asset.mimeType || 'image/jpeg',
    name: buildCloudinaryFileName(asset, index),
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
    throw new Error(responseData?.error?.message || 'Failed to upload image to Cloudinary');
  }

  if (!responseData.secure_url) {
    throw new Error('Cloudinary upload did not return an image URL.');
  }

  return responseData.secure_url;
}

function formatReadableAddress(address) {
  if (!address) return '';

  const streetLine = [address.streetNumber, address.street].filter(Boolean).join(' ').trim();
  const localityLine = [address.city, address.subregion, address.region].filter(Boolean).join(', ').trim();

  return [streetLine || address.name, localityLine].filter(Boolean).join(', ').trim();
}

function normalizeReports(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reports)) return data.reports;
  return [];
}

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

function getReportErrorModalType(errorType) {
  switch (errorType) {
    case 'bad_request':
    case 'unauthorized':
    case 'forbidden':
    case 'not_found':
    case 'rate_limited':
      return 'warning';
    case 'network':
    case 'timeout':
    case 'server_error':
    case 'unknown_error':
    default:
      return 'error';
  }
}

function getReportErrorMessage(errorType) {
  switch (errorType) {
    case 'bad_request':
      return 'Please check the form details and try again.';
    case 'unauthorized':
      return 'Please sign in again and retry the report submission.';
    case 'forbidden':
      return 'You do not have permission to submit this report.';
    case 'not_found':
      return 'The report could not be submitted right now.';
    case 'rate_limited':
      return 'Please wait a moment before submitting another report.';
    case 'server_error':
      return 'Something went wrong on our side. Please try again soon.';
    case 'network':
      return 'Please check your internet connection and try again.';
    case 'timeout':
      return 'The request took too long. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function getApiErrorModalType(apiErrorType) {
  switch (apiErrorType) {
    case 'network':
    case 'timeout':
    case 'server_error':
    case 'unknown_error':
      return 'error';
    default:
      return 'warning';
  }
}

export default function HomeScreen({ currentUserProfile }) {
  const navigation = useNavigation();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [backendUser, setBackendUser] = useState(currentUserProfile || null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  
  const { control: reportControl, handleSubmit: submitReportForm, formState: { errors: reportErrors }, reset: resetReportHookForm } = useForm({
    defaultValues: {
      title: '',
      description: '',
      reportLandmark: ''
    }
  });

  const [severity, setSeverity] = useState('medium');
  const [selectedImages, setSelectedImages] = useState([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [imageActionSheetVisible, setImageActionSheetVisible] = useState(false);
  const [adoptionSheetVisible, setAdoptionSheetVisible] = useState(false);
  const [reportLocation, setReportLocation] = useState(null);
  const [reportAddress, setReportAddress] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState({
    type: 'info',
    title: '',
    message: '',
  });
  // Track which image was taken with the camera so we can offer Retake
  const lastCameraUri = useRef(null);

  const closeStatusModal = () => {
    setStatusModalVisible(false);
  };

  const openStatusModal = (config) => {
    setStatusModalConfig(config);
    setStatusModalVisible(true);
  };

  const loadReports = async () => {
    try {
      // Public endpoint — no auth required, works for guests and signed-in users.
      const response = await fetchPublicWithTimeout(`${BACKEND_BASE_URL}/api/reports`);
      const data = await response.json();
      if (response.ok) {
        setReports(normalizeReports(data));
      }
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        // Fired during logout — silently ignore.
        return;
      }
      throw error; // Re-throw real errors to the caller.
    }
  };

  // Recover lost camera images after Android process death
  useEffect(() => {
    const recoverLostImage = async () => {
      try {
        const pendingResult = await ImagePicker.getPendingResultAsync();
        if (pendingResult && pendingResult.length > 0) {
          const recoveredAsset = pendingResult[0];
          if (recoveredAsset.uri) {
            lastCameraUri.current = recoveredAsset.uri;
            setSelectedImages((currentImages) => {
              const withoutOldCamera = currentImages.filter((img) => !img._fromCamera);
              return [...withoutOldCamera, { ...recoveredAsset, _fromCamera: true }];
            });
            setReportModalVisible(true);
          }
        }
      } catch (error) {
        console.error('Failed to recover pending camera image:', error);
      }
    };
    recoverLostImage();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setFirebaseUser(user);

      // Always load reports — guests see the feed too.
      try {
        setLoading(true);
        if (user) {
          // Authenticated: load user profile alongside reports.
          const [userResponse] = await Promise.all([
            fetchWithTimeout(`${BACKEND_BASE_URL}/api/users/${user.uid}`),
            loadReports(),
          ]);
          const responseText = await userResponse.text();

          if (userResponse.status === 404) {
            if (isMounted) setBackendUser(null);
          } else if (!userResponse.ok) {
            throw new Error(responseText || `Failed to load user details (${userResponse.status})`);
          } else {
            const userData = responseText ? JSON.parse(responseText) : null;
            if (isMounted) setBackendUser(userData);
          }
        } else {
          // Guest: only load reports, no profile fetch.
          setBackendUser(null);
          await loadReports();
        }
      } catch (error) {
        console.error('Failed to load home data:', error);
        if (isMounted) {
          setBackendUser(currentUserProfile || null);
          const apiError = normalizeApiError(error, { fallbackMessage: 'Failed to load your dashboard.' });
          openStatusModal({
            type: getApiErrorModalType(apiError.type),
            title: apiError.title,
            message: apiError.message,
            primaryButton: {
              ...apiError.primaryAction,
              onPress: apiError.primaryAction?.label === 'Try Again' ? () => {
                closeStatusModal();
                refreshHome();
              } : closeStatusModal,
            },
            secondaryButton: apiError.secondaryAction ? {
              ...apiError.secondaryAction,
              onPress: closeStatusModal,
            } : undefined,
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUserProfile]);

  const refreshHome = async () => {
    if (refreshing) return;

    try {
      setRefreshing(true);
      if (firebaseUser) {
        // Authenticated refresh: update profile + reports.
        const [userResponse] = await Promise.all([
          fetchWithTimeout(`${BACKEND_BASE_URL}/api/users/${firebaseUser.uid}`),
          loadReports(),
        ]);
        const responseText = await userResponse.text();
        if (userResponse.status === 404) {
          setBackendUser(null);
        } else if (userResponse.ok && responseText) {
          setBackendUser(JSON.parse(responseText));
        }
      } else {
        // Guest refresh: reports only.
        await loadReports();
      }
    } catch (error) {
      if (error instanceof UnauthenticatedError) return; // logout — suppress
      console.error('Failed to refresh home:', error);
      const apiError = normalizeApiError(error, { fallbackMessage: 'Failed to refresh your dashboard.' });
      openStatusModal({
        type: getApiErrorModalType(apiError.type),
        title: apiError.title,
        message: apiError.message,
        primaryButton: {
          ...apiError.primaryAction,
          onPress: apiError.primaryAction?.label === 'Try Again' ? () => {
            closeStatusModal();
            refreshHome();
          } : closeStatusModal,
        },
        secondaryButton: apiError.secondaryAction ? {
          ...apiError.secondaryAction,
          onPress: closeStatusModal,
        } : undefined,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const username = backendUser?.fullName || firebaseUser?.email?.split('@')?.[0] || 'there';
  const reporterName = backendUser?.fullName || username;
  const reporterContact = backendUser?.phone || '';
  const deviceToken = currentUserProfile?.deviceToken || backendUser?.deviceToken || null;

  const activeReports = useMemo(
    () => reports.filter((report) => ['pending', 'accepted'].includes((report.status || 'pending').toLowerCase())),
    [reports]
  );
  const summary = useMemo(() => ({
    active: activeReports.length,
    critical: activeReports.filter((report) => (report.severity || '').toLowerCase() === 'critical').length,
    medium: activeReports.filter((report) => (report.severity || '').toLowerCase() === 'medium').length,
    low: activeReports.filter((report) => (report.severity || '').toLowerCase() === 'low').length,
  }), [activeReports]);

  const featuredReport = useMemo(() => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...activeReports].sort((a, b) => {
      const severityDiff = (rank[(a.severity || '').toLowerCase()] ?? 4) - (rank[(b.severity || '').toLowerCase()] ?? 4);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    })[0] || null;
  }, [activeReports]);

  const recentActivity = useMemo(
    () => [...reports]
      .sort((a, b) => new Date(b.resolvedAt || b.acceptedAt || b.date || 0) - new Date(a.resolvedAt || a.acceptedAt || a.date || 0))
      .slice(0, 3),
    [reports]
  );

  const refreshReportLocation = async () => {
    setLocationLoading(true);
    setLocationError('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied. Please allow location access to create a report.');
      }

      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = currentLocation.coords;
      const reverseGeocodeResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      const readableAddress = formatReadableAddress(reverseGeocodeResults?.[0]);

      setReportLocation({ type: 'Point', coordinates: [longitude, latitude] });
      setReportAddress(readableAddress || `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`);
    } catch (error) {
      console.error('Failed to load report location:', error);
      const deviceError = normalizeDeviceError(error, { source: 'location' });
      setReportLocation(null);
      setReportAddress('');
      setLocationError(deviceError.message);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if (!reportModalVisible) {
      setReportLocation(null);
      setReportAddress('');
      resetReportHookForm();
      setLocationError('');
      setLocationLoading(false);
      return undefined;
    }

    let isMounted = true;
    const loadCurrentLocation = async () => {
      if (isMounted) await refreshReportLocation();
    };
    loadCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, [reportModalVisible]);

  const takePhoto = async () => {
    setImageActionSheetVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        const deviceError = normalizeDeviceError({ code: 'CAMERA_PERMISSION_DENIED' }, { source: 'camera' });
        openStatusModal({
          type: 'warning',
          title: deviceError.title,
          message: deviceError.message,
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      // Mark this uri so we can offer Retake
      lastCameraUri.current = asset.uri;

      setSelectedImages((currentImages) => {
        // Replace the previous camera image if user retakes
        const withoutOldCamera = currentImages.filter((img) => !img._fromCamera);
        return [...withoutOldCamera, { ...asset, _fromCamera: true }];
      });
    } catch (error) {
      console.error('Camera failed:', error);
      const deviceError = normalizeDeviceError(error, { source: 'camera' });
      openStatusModal({
        type: 'error',
        title: deviceError.title,
        message: deviceError.message,
      });
    }
  };

  const pickFromGallery = async () => {
    setImageActionSheetVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const deviceError = normalizeDeviceError({ code: 'GALLERY_PERMISSION_DENIED' }, { source: 'gallery' });
        openStatusModal({
          type: 'warning',
          title: deviceError.title,
          message: deviceError.message,
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;

      setSelectedImages((currentImages) => {
        const nextImages = [...currentImages];
        result.assets.forEach((asset) => {
          if (!nextImages.some((existingAsset) => existingAsset.uri === asset.uri))
            nextImages.push(asset);
        });
        return nextImages;
      });
    } catch (error) {
      console.error('Image picking failed:', error);
      const deviceError = normalizeDeviceError(error, { source: 'gallery' });
      openStatusModal({
        type: 'error',
        title: deviceError.title,
        message: deviceError.message,
      });
    }
  };

  const removeSelectedImage = (uriToRemove) => {
    if (lastCameraUri.current === uriToRemove) lastCameraUri.current = null;
    setSelectedImages((currentImages) => currentImages.filter((asset) => asset.uri !== uriToRemove));
  };

  const resetReportForm = () => {
    setReportModalVisible(false);
    setImageActionSheetVisible(false);
    resetReportHookForm();
    setSeverity('medium');
    setSelectedImages([]);
    lastCameraUri.current = null;
    setReportLocation(null);
    setReportAddress('');
    setLocationError('');
    setLocationLoading(false);
  };

  const handleSubmitReport = async (formData) => {
    console.log("FORM SUBMITTED");
    if (!selectedImages.length) {
      openStatusModal({
        type: 'warning',
        title: 'Missing Images',
        message: 'Please add at least one image to your report.',
      });
      return;
    }

    if (!reportLocation || !Array.isArray(reportLocation.coordinates)) {
      openStatusModal({
        type: 'warning',
        title: 'Missing Location',
        message: 'Please refresh location before submitting your report.',
      });
      return;
    }

    setReportSubmitting(true);
    try {
      const imageUrls = await Promise.all(selectedImages.map((asset, index) => uploadImageToCloudinary(asset, index)));
      const normalizedSeverity = severity.charAt(0).toUpperCase() + severity.slice(1);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        severity: normalizedSeverity,
        reporterName,
        reporterUid: firebaseUser?.uid || null,
        reporterContact,
        location: reportLocation,
        address: reportAddress.trim(),
        landmark: formData.reportLandmark.trim(),
        reporterDeviceToken: deviceToken,
        imageUrls,
      };

      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/reports`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();

      if (!response.ok) {
        let responseData = null;

        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = responseText;
          }
        }

        throw {
          message: typeof responseData === 'string' ? responseData : responseData?.message || responseData?.error || responseText,
          status: response.status,
          responseData,
        };
      }

      openStatusModal({
        type: 'success',
        title: 'Report Submitted',
        message: 'Your rescue report is now visible to nearby volunteers.',
      });
      resetReportForm();
      await loadReports();
    } catch (error) {
      console.error('Report submission failed:', error);
      const normalizedError = normalizeApiError(error, {
        fallbackMessage: 'Please try again.',
      });

      openStatusModal({
        type: getReportErrorModalType(normalizedError.type),
        title: normalizedError.title || 'Report Failed',
        message: getReportErrorMessage(normalizedError.type),
      });
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LoadingOverlay
        visible={loading || reportSubmitting}
        title={loading ? "Loading Dashboard" : "Submitting Report"}
        message={loading ? "Please wait while we load rescue reports." : "Please wait while we send your rescue report."}
      />
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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshHome}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Hero Banner ──────────────────────────────────── */}
        <View style={styles.heroBanner}>
          {/* Soft background swoosh */}
          <View style={styles.heroSwoosh} />
          {/* Paw print decorations */}
          <Text style={styles.pawTopRight}>🐾</Text>
          <Text style={styles.pawBottomLeft}>🐾</Text>

          {/* Top-right icon buttons — absolutely positioned */}
          <View style={styles.heroIconRow}>
            <TouchableOpacity
              style={styles.heroIconButton}
              onPress={() => navigation.navigate('Donations')}
              activeOpacity={0.82}
            >
              <HeartHandshake size={19} color={colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroIconButton} activeOpacity={0.82}>
              <Bell size={19} color={colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Left: greeting + tagline */}
          <View style={styles.heroLeft}>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.userName}>{username} 👋</Text>
            <Text style={styles.heroTagline}>Every rescue brings hope.{`\n`}Let's make a difference today. 🧡</Text>
          </View>

          {/* Right: local backgroundless mascot */}
          <Image
            source={require('../assets/image.png')}
            style={styles.heroMascot}
            resizeMode="contain"
          />
        </View>

        <View style={styles.paddedContent}>

          {/* ── 1. Nearby Emergency (Highest priority) ────────── */}
          <SectionHeader title="🚨 Urgent Rescue Needed" subtitle="Highest-priority active case in your area." />
          {featuredReport ? (
            <Card style={styles.featuredCard}>
              <View style={styles.featuredTop}>
                <View style={styles.badges}>
                  <StatusBadge status={featuredReport.status} />
                  <SeverityBadge severity={featuredReport.severity} />
                </View>
                <Text style={styles.featuredTime}>{getTimeAgo(featuredReport.date || featuredReport.createdAt)}</Text>
              </View>
              <Text style={styles.featuredTitle}>{featuredReport.title}</Text>
              <Text style={styles.featuredMeta}>{featuredReport.address || featuredReport.landmark || 'Location shared with volunteers'}</Text>
              <Text style={styles.featuredDescription} numberOfLines={3}>{featuredReport.description}</Text>
              <Button label="View Details & Navigate" onPress={() => navigation.navigate('RescueFeed')} style={styles.featuredButton} />
            </Card>
          ) : (
            <Card style={styles.featuredCard}>
              <Text style={styles.emptyTitle}>No rescue reports nearby.</Text>
              <Text style={styles.emptyText}>Be the first to report an animal in your area.</Text>
            </Card>
          )}

          {/* ── 2. Quick Actions (Side-by-side) ─────────────────── */}
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                if (!firebaseUser) {
                  // Guest: prompt to sign in before creating a report.
                  openStatusModal({
                    type: 'info',
                    title: 'Sign in required',
                    message: 'Please sign in to report an animal in distress.',
                    primaryButton: {
                      label: 'Sign In',
                      onPress: () => {
                        closeStatusModal();
                        navigation.navigate('Login');
                      },
                    },
                    secondaryButton: {
                      label: 'Cancel',
                      onPress: closeStatusModal,
                    },
                  });
                  return;
                }
                setReportModalVisible(true);
              }}
              activeOpacity={0.86}
            >
              <View style={styles.quickIconCircle}>
                <Plus size={22} color={colors.primary} strokeWidth={2.8} />
              </View>
              <Text style={styles.quickActionLabel}>Report Rescue</Text>
              <Text style={styles.quickActionSub}>Report animal in distress</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('RescueFeed')}
              activeOpacity={0.86}
            >
              <View style={styles.quickIconCircle}>
                <HeartHandshake size={22} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.quickActionLabel}>View Rescues</Text>
              <Text style={styles.quickActionSub}>Explore active cases</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setAdoptionSheetVisible(true)}
              activeOpacity={0.86}
            >
              <View style={styles.quickIconCircle}>
                <PawPrint size={22} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.quickActionLabel}>Adoptions</Text>
              <Text style={styles.quickActionSub}>Adopt or Rehome</Text>
            </TouchableOpacity>
          </View>

          {/* ── 3. Community Status (Compact Metrics Row) ──────── */}
          <SectionHeader title="Community Impact Today" />
          <Card style={styles.summaryCard}>
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: colors.text }]}>{summary.active}</Text>
                <Text style={styles.summaryStatLabel}>Active</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: colors.critical }]}>{summary.critical}</Text>
                <Text style={styles.summaryStatLabel}>Critical</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: colors.medium }]}>{summary.medium}</Text>
                <Text style={styles.summaryStatLabel}>Medium</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: colors.success }]}>{summary.low}</Text>
                <Text style={styles.summaryStatLabel}>Low</Text>
              </View>
            </View>
          </Card>

          {/* ── 4. Recent Activity ──────────────────────────────── */}
          <SectionHeader title="Recent Activity" />
          <Card style={styles.timelineCard}>
            {recentActivity.length ? recentActivity.map((report) => (
              <View key={report._id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{report.title}</Text>
                  <Text style={styles.timelineMeta}>{getTimeAgo(report.resolvedAt || report.acceptedAt || report.date)} · {report.status || 'pending'}</Text>
                </View>
              </View>
            )) : (
              <Text style={styles.emptyText}>No recent rescue activity yet.</Text>
            )}
          </Card>

        </View>

      </ScrollView>
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        onRequestClose={resetReportForm}
      >
        <SafeAreaView style={styles.modalScreen}>
          <ScrollView contentContainerStyle={styles.modalContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report a Rescue</Text>
              <TouchableOpacity onPress={resetReportForm}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>

            <Controller
              control={reportControl}
              rules={{ required: 'Title is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, reportErrors.title && styles.inputError]}
                  placeholder="Rescue title"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                />
              )}
              name="title"
            />
            {reportErrors.title && <Text style={styles.errorText}>{reportErrors.title.message}</Text>}

            <Controller
              control={reportControl}
              rules={{ required: 'Description is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.textArea, reportErrors.description && styles.inputError]}
                  placeholder="Describe the situation..."
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  multiline
                  textAlignVertical="top"
                />
              )}
              name="description"
            />
            {reportErrors.description && <Text style={styles.errorText}>{reportErrors.description.message}</Text>}

            <View style={styles.locationHeaderRow}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TouchableOpacity
                style={[styles.refreshButton, locationLoading && styles.disabled]}
                onPress={refreshReportLocation}
                disabled={locationLoading}
                activeOpacity={0.85}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={14} color={colors.primary} strokeWidth={2.4} />
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.locationCard}>
              <MapPin size={17} color={colors.primary} strokeWidth={2.3} />
              <Text style={[styles.locationValue, locationError && styles.locationError]}>
                {locationLoading
                  ? 'Fetching current GPS location...'
                  : locationError || reportAddress || 'Location will appear here after refresh.'}
              </Text>
            </View>

            <Controller
              control={reportControl}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="Nearby landmark (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                />
              )}
              name="reportLandmark"
            />

            <Text style={styles.fieldLabel}>Severity</Text>
            <View style={styles.severityRow}>
              {['low', 'medium', 'high', 'critical'].map((option) => {
                const isActive = severity === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.severityChip, isActive && styles.severityChipActive]}
                    onPress={() => setSeverity(option)}
                    disabled={reportSubmitting}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.severityChipText, isActive && styles.severityChipTextActive]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.imageButton, reportSubmitting && styles.disabled]}
              onPress={() => setImageActionSheetVisible(true)}
              disabled={reportSubmitting}
            >
              <Camera size={18} color={colors.primary} strokeWidth={2.4} />
              <Text style={styles.imageButtonText}>
                {selectedImages.length ? `${selectedImages.length} photo(s) added — Add More` : 'Add Photo'}
              </Text>
            </TouchableOpacity>

            {selectedImages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewSection}>
                {selectedImages.map((asset) => (
                  <View key={asset.uri} style={styles.imagePreview}>
                    <Image source={{ uri: asset.uri }} style={styles.preview} />
                    {/* Retake — only for the camera-captured image */}
                    {asset._fromCamera && (
                      <TouchableOpacity style={styles.retakeButton} onPress={takePhoto}>
                        <Camera size={12} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.retakeText}>Retake</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => removeSelectedImage(asset.uri)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Button
              label="Submit Report"
              onPress={() => submitReportForm(handleSubmitReport)()}
              disabled={reportSubmitting || locationLoading || !reportLocation}
              style={styles.submitButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Photo action sheet ─────────────────────────────── */}
      <Modal
        visible={imageActionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImageActionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setImageActionSheetVisible(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Photo</Text>

            <TouchableOpacity style={styles.sheetOption} onPress={takePhoto} activeOpacity={0.82}>
              <View style={styles.sheetOptionIcon}>
                <Camera size={22} color={colors.primary} strokeWidth={2.3} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionLabel}>📷 Take Photo</Text>
                <Text style={styles.sheetOptionSub}>Use your camera to capture a photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={pickFromGallery} activeOpacity={0.82}>
              <View style={styles.sheetOptionIcon}>
                <Camera size={22} color={colors.primary} strokeWidth={2.3} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionLabel}>🖼️ Choose From Gallery</Text>
                <Text style={styles.sheetOptionSub}>Pick one or more photos from your library</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setImageActionSheetVisible(false)}
              activeOpacity={0.82}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Adoption action sheet ─────────────────────────────── */}
      <Modal
        visible={adoptionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdoptionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setAdoptionSheetVisible(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Adoption Center</Text>

            <TouchableOpacity style={styles.sheetOption} onPress={() => {
              setAdoptionSheetVisible(false);
              navigation.navigate('Adopt');
            }} activeOpacity={0.82}>
              <View style={styles.sheetOptionIcon}>
                <PawPrint size={22} color={colors.primary} strokeWidth={2.3} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionLabel}>🐶 I Want to Adopt</Text>
                <Text style={styles.sheetOptionSub}>Find a loving companion in need of a home</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={() => {
              setAdoptionSheetVisible(false);
              navigation.navigate('Rehome');
            }} activeOpacity={0.82}>
              <View style={styles.sheetOptionIcon}>
                <Home size={22} color={colors.primary} strokeWidth={2.3} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionLabel}>🏠 I Want to Rehome an Animal</Text>
                <Text style={styles.sheetOptionSub}>Submit an animal to find them a safe home</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setAdoptionSheetVisible(false)}
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

// QuickAction is no longer used individually as it was replaced by the inline side-by-side cards.

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingBottom: 108,
  },
  paddedContent: {
    paddingHorizontal: spacing.lg,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  // ── Hero Banner
  heroBanner: {
    backgroundColor: '#FFF1EA',
    marginBottom: spacing.xl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
    minHeight: 180,
  },
  heroSwoosh: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#FFE4D4',
    top: -90,
    right: -60,
  },
  pawTopRight: {
    position: 'absolute',
    top: spacing.sm,
    right: 100,
    fontSize: 18,
    opacity: 0.22,
    transform: [{ rotate: '20deg' }],
  },
  pawBottomLeft: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    fontSize: 14,
    opacity: 0.15,
    transform: [{ rotate: '-15deg' }],
  },
  heroLeft: {
    flex: 1,
    paddingRight: spacing.md,
    alignSelf: 'flex-start',
    paddingTop: 10,

  },
  heroIconRow: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 10,

  },
  heroIconButton: {
    marginTop: 18,
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  userName: {
    ...typography.title,
    fontSize: 36,
    marginTop: 10,
    lineHeight: 42,
  },
  heroTagline: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  heroMascot: {
    width: 120,
    height: 150,
    alignSelf: 'flex-end',
    marginBottom: -25,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  quickActionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  featuredCard: {
    marginBottom: spacing.xxl,
  },
  featuredTop: {
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
  featuredTime: {
    ...typography.meta,
    fontWeight: '800',
  },
  featuredTitle: {
    ...typography.heading,
  },
  featuredMeta: {
    ...typography.meta,
    marginTop: spacing.xs,
    fontWeight: '800',
  },
  featuredDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  featuredButton: {
    marginTop: spacing.lg,
  },
  summaryCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xxl,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  summaryStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  emptyTitle: {
    ...typography.heading,
    fontSize: 18,
  },
  emptyText: {
    ...typography.meta,
    marginTop: spacing.sm,
  },
  timelineCard: {
    marginBottom: spacing.xxl,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  timelineBody: {
    flex: 1,
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  timelineMeta: {
    ...typography.meta,
    marginTop: 2,
  },
  reportSection: {
    marginTop: spacing.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reportTitle: {
    ...typography.heading,
  },
  closeButton: {
    color: colors.textSecondary,
    fontWeight: '900',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    marginBottom: spacing.md,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  textArea: {
    height: 118,
    paddingVertical: spacing.md,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#FFD6C3',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  locationValue: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  locationError: {
    color: colors.critical,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  severityChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  severityChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  severityChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  severityChipTextActive: {
    color: '#FFFFFF',
  },
  imageButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  imageButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  imagePreviewSection: {
    marginBottom: spacing.md,
  },
  imagePreview: {
    marginRight: spacing.md,
  },
  preview: {
    width: 106,
    height: 106,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: colors.critical,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  // Action sheet
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
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sheetOptionSub: {
    ...typography.meta,
    marginTop: 2,
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
