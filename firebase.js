import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBzjrQdIEOh-eSiTmLhT9ZIQDX847SnH7Y",
  authDomain: "feeeel-2ff59.firebaseapp.com",
  projectId: "feeeel-2ff59",
  storageBucket: "feeeel-2ff59.firebasestorage.app",
  messagingSenderId: "282240133835",
  appId: "1:282240133835:web:2d4e57246ef61b95b9c94e"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app);
}

export { app, auth };
