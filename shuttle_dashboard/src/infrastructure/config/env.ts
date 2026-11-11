export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Beroya on plus",
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1/shuttle",
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001",
  isProduction: process.env.NODE_ENV === "production",
  /** Firebase web config is public by design; access is guarded by Firebase rules, not secrecy. */
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDJpQ9Yd8JmucutDV8aqoABxX1jRUxNFQo",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "beroya-on-plus.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "beroya-on-plus",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "beroya-on-plus.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "360741913387",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:360741913387:web:f51afd3fd2b10e4708fb6e",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-ZBLLPFYSJ6",
  },
  /** Web Push certificate key pair from Firebase › Cloud Messaging. Optional: Firebase falls back to its default key. */
  firebaseVapidKey:
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ??
    "BJnePwrX4-lwe93lUa5Q7Anp8m1BuydoDRHWcBhE_apLrdgUEWx4EFGxBXL43PTWZmzwOQ5Yp3ok5LLkXZiaUFY",
} as const;
