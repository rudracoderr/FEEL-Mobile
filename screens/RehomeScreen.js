
console.log("REHOME SCREEN LOADED");
import React, { useState, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  Image,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useForm, Controller } from 'react-hook-form';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../theme';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const CLOUDINARY_FOLDER = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'feel-adoptions';

function buildCloudinaryFileName(asset, index) {
  const fileName = asset.fileName || `adoption-image-${Date.now()}-${index + 1}`;
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

export default function RehomeScreen() {
  const navigation = useNavigation();

  const { control, handleSubmit: hookFormSubmit, formState: { errors } } = useForm({
    defaultValues: {
      animalName: '',
      species: '',
      breed: '',
      age: '',
      gender: '',
      description: '',
      stateName: '',
      city: '',
      area: ''
    }
  });

  const [vaccinated, setVaccinated] = useState(false);
  const [sterilized, setSterilized] = useState(false);

  const [selectedImages, setSelectedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [imageActionSheetVisible, setImageActionSheetVisible] = useState(false);
  const lastCameraUri = useRef(null);

  const takePhoto = async () => {
    setImageActionSheetVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      lastCameraUri.current = asset.uri;

      setSelectedImages((currentImages) => {
        const withoutOldCamera = currentImages.filter((img) => !img._fromCamera);
        return [...withoutOldCamera, { ...asset, _fromCamera: true }];
      });
    } catch (error) {
      console.error('Camera failed:', error);
      Alert.alert('Camera error', error.message);
    }
  };

  const pickFromGallery = async () => {
    setImageActionSheetVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to select images.');
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
          if (!nextImages.some((existingAsset) => existingAsset.uri === asset.uri)) {
            nextImages.push(asset);
          }
        });
        return nextImages;
      });
    } catch (error) {
      console.error('Image picking failed:', error);
      Alert.alert('Selection failed', error.message);
    }
  };

  const removeSelectedImage = (uriToRemove) => {
    if (lastCameraUri.current === uriToRemove) lastCameraUri.current = null;
    setSelectedImages((currentImages) => currentImages.filter((asset) => asset.uri !== uriToRemove));
  };

  const onSubmitForm = async (formData) => {
    console.log("FORM SUBMITTED");
    setSubmitting(true);
    try {
      let imageUrls = [];
      if (selectedImages.length > 0) {
        imageUrls = await Promise.all(selectedImages.map((asset, index) => uploadImageToCloudinary(asset, index)));
      }

      const payload = {
        animalName: formData.animalName.trim(),
        species: formData.species.trim(),
        breed: formData.breed.trim(),
        age: formData.age.trim(),
        gender: formData.gender.trim(),
        description: formData.description.trim(),
        location: {
          state: formData.stateName.trim(),
          city: formData.city.trim(),
          area: formData.area.trim()
        },
        health: {
          vaccinated,
          sterilized
        },
        photos: imageUrls
      };

      const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/adoptions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `Failed to submit adoption listing (${response.status})`);
      }

      Alert.alert('Success', 'Your adoption listing has been submitted and is awaiting review.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Submission failed:', error);
      Alert.alert('Submission failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Button variant="outline" onPress={() => navigation.goBack()} style={styles.backButton} disabled={submitting}>
          <ChevronLeft size={24} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>Rehome an Animal</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Basic Info</Text>

        <Controller
          control={control}
          rules={{
            required: 'Animal Name is required',
            pattern: {
              value: /^[a-zA-Z\s'-]{2,50}$/,
              message: 'Name must be 2-50 characters long and contain only letters, spaces, hyphens, and apostrophes'
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.animalName && styles.inputError]}
              placeholder="Animal Name *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="animalName"
        />
        {errors.animalName && <Text style={styles.errorText}>{errors.animalName.message}</Text>}

        <Controller
          control={control}
          rules={{ required: 'Species is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.species && styles.inputError]}
              placeholder="Species (e.g. Dog, Cat) *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="species"
        />
        {errors.species && <Text style={styles.errorText}>{errors.species.message}</Text>}

        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Breed (Optional)"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="breed"
        />

        <Controller
          control={control}
          rules={{ required: 'Age is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.age && styles.inputError]}
              placeholder="Age (e.g. 2 months, 3 years) *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="age"
        />
        {errors.age && <Text style={styles.errorText}>{errors.age.message}</Text>}

        <Controller
          control={control}
          rules={{ required: 'Gender is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.gender && styles.inputError]}
              placeholder="Gender (e.g. Male, Female) *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="gender"
        />
        {errors.gender && <Text style={styles.errorText}>{errors.gender.message}</Text>}

        <Controller
          control={control}
          rules={{ required: 'Description is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe the animal, behavior, reason for rehoming... *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              multiline
              textAlignVertical="top"
              editable={!submitting}
            />
          )}
          name="description"
        />
        {errors.description && <Text style={styles.errorText}>{errors.description.message}</Text>}

        <Text style={styles.sectionTitle}>Health & Medical</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Vaccinated</Text>
          <View style={styles.switchOptions}>
            <TouchableOpacity
              style={[styles.chip, vaccinated && styles.chipActive]}
              onPress={() => setVaccinated(true)}
              disabled={submitting}
            >
              <Text style={[styles.chipText, vaccinated && styles.chipTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, !vaccinated && styles.chipActive]}
              onPress={() => setVaccinated(false)}
              disabled={submitting}
            >
              <Text style={[styles.chipText, !vaccinated && styles.chipTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sterilized / Neutered</Text>
          <View style={styles.switchOptions}>
            <TouchableOpacity
              style={[styles.chip, sterilized && styles.chipActive]}
              onPress={() => setSterilized(true)}
              disabled={submitting}
            >
              <Text style={[styles.chipText, sterilized && styles.chipTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, !sterilized && styles.chipActive]}
              onPress={() => setSterilized(false)}
              disabled={submitting}
            >
              <Text style={[styles.chipText, !sterilized && styles.chipTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Location</Text>
        <Controller
          control={control}
          rules={{
            required: 'State is required',
            pattern: {
              value: /^[a-zA-Z\s]+$/,
              message: 'State must contain only letters and spaces'
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.stateName && styles.inputError]}
              placeholder="State *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="stateName"
        />
        {errors.stateName && <Text style={styles.errorText}>{errors.stateName.message}</Text>}

        <Controller
          control={control}
          rules={{
            required: 'City is required',
            pattern: {
              value: /^[a-zA-Z\s]+$/,
              message: 'City must contain only letters and spaces'
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              placeholder="City *"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="city"
        />
        {errors.city && <Text style={styles.errorText}>{errors.city.message}</Text>}

        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Area / Neighborhood (Optional)"
              placeholderTextColor={colors.textMuted}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              editable={!submitting}
            />
          )}
          name="area"
        />

        <Text style={styles.sectionTitle}>Photos</Text>
        <TouchableOpacity
          style={[styles.imageButton, submitting && styles.disabled]}
          onPress={() => setImageActionSheetVisible(true)}
          disabled={submitting}
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

        <View style={styles.footerSpacing} />

        <Button
          label={submitting ? 'Submitting...' : 'Submit Adoption Listing'}
          loading={submitting}
          disabled={submitting}
          onPress={() => {
            console.log("BUTTON PRESSED");
            hookFormSubmit(onSubmitForm)();
          }}
        />
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Photo action sheet */}
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
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add a Photo</Text>

            <TouchableOpacity style={styles.sheetButton} onPress={takePhoto} activeOpacity={0.8}>
              <Camera size={22} color={colors.text} strokeWidth={2} />
              <Text style={styles.sheetButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetButton} onPress={pickFromGallery} activeOpacity={0.8}>
              <Image source={{ uri: 'https://img.icons8.com/ios/50/000000/image-gallery.png' }} style={{ width: 22, height: 22, tintColor: colors.text }} />
              <Text style={styles.sheetButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetCancelButton]}
              onPress={() => setImageActionSheetVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  container: {
    padding: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    color: colors.text,
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
    height: 120,
    paddingTop: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  switchLabel: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text,
  },
  switchOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}10`,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  imageButtonText: {
    marginLeft: spacing.sm,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  imagePreviewSection: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  imagePreview: {
    position: 'relative',
    marginRight: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  preview: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  retakeButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.round,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retakeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.6,
  },
  footerSpacing: {
    height: spacing.xl,
  },
  bottomSpacing: {
    height: spacing.xxl * 2,
  },

  // Bottom Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: radius.round,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.heading,
    fontSize: 18,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  sheetButtonText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  sheetCancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  sheetCancelText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 0,
  },
});
