"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { signInWithPopup } from "firebase/auth"
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from "@/lib/firebase"

export interface User {
  uid: string
  email: string | null
  displayName: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  firebaseEnabled: boolean
  signIn: (email: string, password?: string) => Promise<void>
  signUp: (email: string, password?: string, displayName?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseEnabled: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const firebaseEnabled = isFirebaseConfigured()

  useEffect(() => {
    if (!firebaseEnabled) {
      const storedAuth = localStorage.getItem("penpad_local_auth")
      if (storedAuth) {
        try {
          const parsedUser = JSON.parse(storedAuth)
          setUser(parsedUser)
        } catch (e) {
          console.error("Local auth parse failed", e)
        }
      }
      setLoading(false)
      return
    }

    const storedAuth = localStorage.getItem("penpad_local_auth")
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth)
        setUser(parsedUser)
      } catch (e) {
        console.error("Local auth parse failed", e)
      }
    }
    setLoading(false)
  }, [firebaseEnabled])

  const setLocalUser = (u: User | null) => {
    setUser(u)
    if (u) {
      localStorage.setItem("penpad_local_auth", JSON.stringify(u))
    } else {
      localStorage.removeItem("penpad_local_auth")
    }
  }

  const signIn = async (email: string) => {
    await new Promise(r => setTimeout(r, 600))
    setLocalUser({ uid: email, email, displayName: email.split('@')[0] })
  }

  const signUp = async (email: string, password?: string, displayName?: string) => {
    await new Promise(r => setTimeout(r, 600))
    setLocalUser({ uid: email, email, displayName: displayName || email.split('@')[0] })
  }

  const signInWithGoogle = async () => {
    if (!firebaseEnabled) {
      throw new Error("Firebase is not configured. Please add Firebase environment variables.")
    }
    
    const auth = getFirebaseAuth()
    const googleProvider = getGoogleProvider()
    
    if (!auth || !googleProvider) {
      throw new Error("Firebase authentication not initialized")
    }

    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user
      setLocalUser({ 
        uid: firebaseUser.uid, 
        email: firebaseUser.email, 
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User' 
      })
    } catch (err: unknown) {
      console.error("Google sign in error", err)
      throw err
    }
  }

  const signOut = async () => {
    if (firebaseEnabled) {
      const auth = getFirebaseAuth()
      if (auth) {
        const { signOut: firebaseSignOut } = await import("firebase/auth")
        await firebaseSignOut(auth)
      }
    }
    await new Promise(r => setTimeout(r, 400))
    setLocalUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, firebaseEnabled, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
