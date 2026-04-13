import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let app: ReturnType<typeof initializeApp> | null = null
let authInstance: ReturnType<typeof getAuth> | null = null
let dbInstance: ReturnType<typeof getFirestore> | null = null
let googleProviderInstance: GoogleAuthProvider | null = null

export const getFirebaseApp = () => {
  if (!app && typeof window !== 'undefined') {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return app
}

export const getFirebaseAuth = () => {
  if (!authInstance && typeof window !== 'undefined') {
    const firebaseApp = getFirebaseApp()
    if (firebaseApp) {
      authInstance = getAuth(firebaseApp)
    }
  }
  return authInstance
}

export const getFirebaseDb = () => {
  if (!dbInstance && typeof window !== 'undefined') {
    const firebaseApp = getFirebaseApp()
    if (firebaseApp) {
      dbInstance = getFirestore(firebaseApp)
    }
  }
  return dbInstance
}

export const getGoogleProvider = () => {
  if (!googleProviderInstance && typeof window !== 'undefined') {
    googleProviderInstance = new GoogleAuthProvider()
    googleProviderInstance.setCustomParameters({ prompt: 'select_account' })
  }
  return googleProviderInstance
}

export const isFirebaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
}
