import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import StatusModal from '../components/ui/StatusModal';
import { normalizeApiError } from '../utils/apiErrorHandler';
import { normalizeDeviceError } from '../utils/deviceErrorHandler';

function normalizeSignupError(error) {
  const code = String(error?.code || '').toLowerCase();

  switch (code) {
    case 'auth/email-already-in-use':
      return {
        type: 'warning',
        title: 'Email Already In Use',
        message: 'An account with this email already exists.',
      };
    case 'auth/weak-password':
      return {
        type: 'warning',
        title: 'Weak Password',
        message: 'Please choose a stronger password.',
      };
    case 'auth/invalid-email':
      return {
        type: 'warning',
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      };
    case 'auth/network-request-failed':
      return {
        type: 'error',
        title: 'No Internet Connection',
        message: 'No internet connection.',
      };
    case 'auth/too-many-requests':
      return {
        type: 'warning',
        title: 'Too Many Attempts',
        message: 'Too many signup attempts. Please try again later.',
      };
    case 'auth/operation-not-allowed':
      return {
        type: 'error',
        title: 'Signup Disabled',
        message: 'Creating new accounts is currently disabled.',
      };
    case 'auth/internal-error':
      return {
        type: 'error',
        title: 'Signup Failed',
        message: 'Unable to create your account right now. Please try again.',
      };
    default: {
      const deviceLikeError = normalizeDeviceError(error, {
        source: 'signup',
        fallbackMessage: '',
      });

      if (deviceLikeError?.type && deviceLikeError.type !== 'unknown_device_error') {
        return {
          type: 'error',
          title: deviceLikeError.title,
          message: deviceLikeError.message,
        };
      }

      const apiLikeError = normalizeApiError(null, {
        fallbackMessage: 'Unable to create your account right now. Please try again.',
      });

      return {
        type: 'error',
        title: apiLikeError.title || 'Signup Failed',
        message: apiLikeError.message || 'Unable to create your account right now. Please try again.',
      };
    }
  }
}

export default function SignupScreen({ onSwitchToLogin, onSignupStart, onSignupSuccess, onSignupCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedback, setFeedback] = useState({
    type: 'info',
    title: '',
    message: '',
  });

  const openFeedback = (nextFeedback) => {
    setFeedback(nextFeedback);
    setFeedbackVisible(true);
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
  };

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      openFeedback({
        type: 'warning',
        title: 'Missing Fields',
        message: 'Please enter your email and password.',
      });
      return;
    }

    setLoading(true);
    try {
      onSignupStart?.();

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      console.log('Firebase signup uid:', user.uid);

      onSignupSuccess?.({
        uid: user.uid,
        email: user.email,
      });

      openFeedback({
        type: 'success',
        title: 'Success',
        message: 'Account created successfully.',
      });
    } catch (error) {
      openFeedback(normalizeSignupError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay
        visible={loading}
        title="Creating Account"
        message="Please wait while we set up your account."
      />
      <StatusModal
        visible={feedbackVisible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        primaryButton={{
          label: 'OK',
          onPress: closeFeedback,
          variant: 'primary',
        }}
        onRequestClose={closeFeedback}
      />
      <View style={styles.hero}>
        <Text style={styles.kicker}>FEEL Rescue</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the rescue network and help respond faster.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToLogin} disabled={loading}>
        <Text style={styles.switchText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#050505',
  },
  hero: {
    marginBottom: 28,
  },
  kicker: {
    color: '#ff6b2c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#232323',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#121212',
    color: '#ffffff',
  },
  button: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ff6b2c',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  switchText: {
    textAlign: 'center',
    color: '#a1a1aa',
    fontWeight: '600',
  },
});
