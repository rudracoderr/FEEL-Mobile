import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import StatusModal from '../components/ui/StatusModal';
import { normalizeApiError } from '../utils/apiErrorHandler';

function normalizeFirebaseAuthError(error) {
  const code = String(error?.code || '').toLowerCase();

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return {
        type: 'error',
        title: 'Login Failed',
        message: 'Invalid email or password.',
      };
    case 'auth/too-many-requests':
      return {
        type: 'warning',
        title: 'Too Many Attempts',
        message: 'Too many login attempts. Please try again later.',
      };
    case 'auth/network-request-failed':
      return {
        type: 'error',
        title: 'No Internet Connection',
        message: 'No internet connection.',
      };
    case 'auth/invalid-email':
      return {
        type: 'warning',
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
      };
    case 'auth/user-disabled':
      return {
        type: 'error',
        title: 'Account Disabled',
        message: 'This account has been disabled.',
      };
    default: {
      const normalized = normalizeApiError(error, {
        fallbackMessage: 'Unable to sign in right now. Please try again.',
      });

      return {
        type: 'error',
        title: 'Login Failed',
        message: normalized.message || 'Unable to sign in right now. Please try again.',
      };
    }
  }
}

export default function LoginScreen({ onSwitchToSignup, onLoginSuccess }) {
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

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      openFeedback({
        type: 'warning',
        title: 'Missing Fields',
        message: 'Please enter email and password.',
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log(userCredential.user.uid);
      onLoginSuccess?.();
    } catch (error) {
      const normalizedError = normalizeFirebaseAuthError(error);
      openFeedback(normalizedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay
        visible={loading}
        title="Signing In"
        message="Please wait while we verify your account."
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to coordinate rescue alerts and volunteer action.</Text>
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
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToSignup} disabled={loading}>
        <Text style={styles.switchText}>Don't have an account? Sign Up</Text>
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
