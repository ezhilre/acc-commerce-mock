/**
 * Firebase Configuration
 * Central config file for all Firebase credentials.
 * Import this wherever Firebase services are needed.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyDj0N0-wvJulJLrwcY7FsyNZTViBJES4FQ',
  authDomain: 'acc-ecommerce.firebaseapp.com',
  projectId: 'acc-ecommerce',
  storageBucket: 'acc-ecommerce.firebasestorage.app',
  messagingSenderId: '717475898576',
  appId: '1:717475898576:web:bea8be581bf245bed8aad5',
  measurementId: 'G-40KZMKP9XE',
};

/** Firebase SDK CDN base URL (version-pinned) */
export const FIREBASE_SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2';

// ── Kafka / AWS API Gateway config ────────────────────────────────────────────

/** AWS API Gateway base URL for the Kafka REST Proxy */
export const KAFKA_REST_PROXY_BASE = 'https://i3wygncpai.execute-api.eu-west-1.amazonaws.com/prod';

/** Kafka topic name for beta-commerce signup events */
export const KAFKA_SIGNUP_TOPIC = 'beta-commerce-signup-events';
