"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { signInWithPopup } from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"

export interface User {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password?: string) => Promise<void>
  signUp: (email: string, password?: string, displayName?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check local storage for existing session
    const storedAuth = localStorage.getItem("penpad_local_auth")
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth)
        setUser(parsedUser)
      } catch (e) {
        console.error("Local auth parse failed", e)
      }
    }
    // Set loading to false immediately after checking
    setLoading(false)
  }, [])

  const setLocalUser = (u: User | null) => {
    setUser(u)
    if (u) {
      localStorage.setItem("penpad_local_auth", JSON.stringify(u))
    } else {
      localStorage.removeItem("penpad_local_auth")
    }
  }

  const signIn = async (email: string) => {
    await new Promise(r => setTimeout(r, 600)) // simulate tiny network delay
    setLocalUser({ uid: email, email, displayName: email.split('@')[0] })
  }

  const signUp = async (email: string, password?: string, displayName?: string) => {
    await new Promise(r => setTimeout(r, 600))
    setLocalUser({ uid: email, email, displayName: displayName || email.split('@')[0] })
  }

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user
      setLocalUser({ 
        uid: firebaseUser.uid, 
        email: firebaseUser.email, 
        displayName: firebaseUser.displayName 
      })
    } catch (err: unknown) {
      console.error("Google sign in error", err)
      throw err
    }
  }

  const signOut = async () => {
    await new Promise(r => setTimeout(r, 400))
    setLocalUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
