import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useForm, Controller } from 'react-hook-form';
import { BACKEND_BASE_URL, fetchWithTimeout } from '../apiClient';

async function postUserToBackend(payload) {
  const url = `${BACKEND_BASE_URL}/api/users`;
  console.log('Sending completed profile to backend:', url);
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log('Complete profile response status:', response.status);
  console.log('Complete profile response body:', responseText);

  if (!response.ok) {
    throw new Error(responseText || `Backend request failed with status ${response.status}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

async function getCurrentGeoJsonLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Location permission denied. Please allow location access to continue.');
  }

  const currentLocation = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const { latitude, longitude } = currentLocation.coords;

  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

export default function CompleteProfileScreen({ route, profile, onComplete }) {
  const signupProfile = profile || route?.params || null;
  // When the user arrived via the "Become a Volunteer" path, submit their
  // application at the same time as profile creation. The backend converts
  // isVolunteer:true → volunteerStatus:"pending" automatically.
  const volunteerIntent = Boolean(route?.params?.volunteerIntent || profile?.volunteerIntent);
  
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      fullName: '',
      age: '',
      phone: '',
      city: ''
    }
  });

  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async (formData) => {
    console.log("FORM SUBMITTED");
    if (!signupProfile?.uid || !signupProfile?.email) {
      Alert.alert('Missing signup data', 'Please restart signup so we can continue with your profile.');
      return;
    }

    const { fullName, age, phone, city } = formData;
    const parsedAge = Number(age);

    setLoading(true);
    try {
      const location = await getCurrentGeoJsonLocation();
      console.log('Current location coordinates:', location.coordinates);

      const payload = {
        uid: signupProfile.uid,
        email: signupProfile.email,
        fullName: fullName.trim(),
        age: parsedAge,
        phone: phone.trim(),
        city: city.trim(),
        location,
        // Sending isVolunteer:true signals to the backend that this user wants
        // to apply. The backend sets volunteerStatus:"pending" and keeps
        // isVolunteer:false until an admin approves.
        ...(volunteerIntent ? { isVolunteer: true } : {}),
      };

      console.log('Complete profile payload:', payload);

      const data = await postUserToBackend(payload);
      console.log('Complete profile saved successfully:', data);

      Alert.alert('Success', 'Profile completed successfully.', [
        {
          text: 'Go to Home',
          onPress: () => onComplete?.(data),
        },
      ]);
    } catch (error) {
      console.error('Complete profile save failed:', error);
      Alert.alert('Save failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!signupProfile) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackTitle}>Complete Profile</Text>
        <Text style={styles.fallbackText}>Missing signup details. Please sign up again.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.headerLabel}>One more step</Text>
        <Text style={styles.headerTitle}>Complete your profile</Text>
        <Text style={styles.headerText}>We will save your extra details and current location automatically.</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Text style={styles.accountText}>Email: {signupProfile.email}</Text>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <Controller
          control={control}
          rules={{
            required: 'Full name is required',
            pattern: {
              value: /^[a-zA-Z\s'-]{2,50}$/,
              message: 'Name must be 2-50 characters long and contain only letters, spaces, hyphens, and apostrophes'
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Enter full name"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="fullName"
        />
        {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}

        <Text style={styles.fieldLabel}>Age</Text>
        <Controller
          control={control}
          rules={{
            required: 'Age is required',
            pattern: {
              value: /^[1-9]\d*$/,
              message: 'Age must be a positive number'
            },
            validate: value => {
              const parsedAge = Number(value);
              if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
                return 'Please enter a valid age';
              }
              return true;
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.age && styles.inputError]}
              placeholder="Enter age"
              keyboardType="numeric"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="age"
        />
        {errors.age && <Text style={styles.errorText}>{errors.age.message}</Text>}

        <Text style={styles.fieldLabel}>Phone Number</Text>
        <Controller
          control={control}
          rules={{
            required: 'Phone number is required',
            pattern: {
              value: /^[0-9]{10}$/,
              message: 'Phone number must be exactly 10 digits'
            }
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="phone"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}

        <Text style={styles.fieldLabel}>City</Text>
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
              placeholder="Enter city"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          name="city"
        />
        {errors.city && <Text style={styles.errorText}>{errors.city.message}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit(handleSaveProfile)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  headerCard: {
    backgroundColor: '#0f766e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  headerLabel: {
    color: '#ccfbf1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  headerText: {
    color: '#d1fae5',
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  accountText: {
    color: '#475569',
    marginBottom: 4,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: '#0f172a',
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 16,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchHint: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  fallbackTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  fallbackText: {
    textAlign: 'center',
    color: '#475569',
  },
});