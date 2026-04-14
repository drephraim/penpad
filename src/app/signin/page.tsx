"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/Providers"
import { Brain } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setSubmitting(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      router.push("/dashboard")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred"
      if (message.includes("user-not-found") || message.includes("wrong-password") || message.includes("invalid-credential")) {
        setError("Invalid email or password")
      } else if (message.includes("email-already-in-use")) {
        setError("Email already in use")
      } else if (message.includes("weak-password")) {
        setError("Password should be at least 6 characters")
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    try {
      await signInWithGoogle()
      router.push("/dashboard")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred"
      if (message.includes("popup-closed-by-user")) {
        setError("Sign-in popup was closed. Try again.")
      } else {
        setError(message)
      }
    }
  }

  return (
    <div className="sign-page">
      <div className="sign-background">
        <div className="bg-grid" />
        <div className="bg-gradient-radial" />
      </div>

      <div className="sign-container">
        <Link href="/" className="logo">
          <div className="logo-icon">
            <Brain size={24} />
          </div>
          <span className="logo-text">PenPad</span>
        </Link>

        <div className="auth-card">
          <div className="auth-card-inner">
            <div className="auth-header">
              <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>
              <p>{isSignUp ? "Start your writing journey today" : "Continue where you left off"}</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {isSignUp && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </div>

              {isSignUp && (
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
              </button>
            </form>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <button
              className="btn btn-google"
              onClick={handleGoogleSignIn}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            <div className="auth-footer">
              {isSignUp ? (
                <>Already writing? <button type="button" onClick={() => { setIsSignUp(false); setError("") }}>Sign in</button></>
              ) : (
                <>New to PenPad? <button type="button" onClick={() => { setIsSignUp(true); setError("") }}>Create account</button></>
              )}
            </div>
          </div>
        </div>

        <Link href="/" className="back-link">
          ← Back to home
        </Link>
      </div>

      <style jsx>{`
        .sign-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 2rem;
        }

        .sign-background {
          position: fixed;
          inset: 0;
          z-index: 0;
        }

        .sign-container {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          position: relative;
          z-index: 1;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: var(--text-primary);
        }

        .logo-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .logo-text {
          font-family: var(--font-outfit);
          font-size: 1.5rem;
          font-weight: 700;
        }

        .auth-card {
          width: 100%;
          background: rgba(15, 15, 20, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 3px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            inset 0 1px 1px rgba(255, 255, 255, 0.05);
        }

        .auth-card-inner {
          background: rgba(10, 10, 15, 0.6);
          border-radius: 22px;
          padding: 2.5rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .auth-header h2 {
          font-family: var(--font-outfit);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .auth-header p {
          color: var(--text-dim);
          font-size: 0.95rem;
        }

        .error-message {
          background: var(--error-light);
          border: 1px solid var(--error);
          color: var(--error);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          margin-bottom: 1rem;
          text-align: center;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .auth-form .btn-primary {
          margin-top: 0.5rem;
          height: 48px;
          font-size: 1rem;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.5rem 0;
          color: var(--text-dim);
          font-size: 0.8rem;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--surface-border);
        }

        .btn-google {
          width: 100%;
          height: 48px;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          color: var(--text-primary);
          font-weight: 600;
        }

        .btn-google:hover {
          background: var(--surface-hover);
          border-color: var(--text-dim);
        }

        .auth-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.9rem;
          color: #6b7280;
        }

        .auth-footer button {
          background: none;
          border: none;
          color: #a5b4fc;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }

        .auth-footer button:hover {
          color: #818cf8;
        }

        .back-link {
          color: var(--text-dim);
          text-decoration: none;
          font-size: 0.9rem;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: var(--text-primary);
        }

        @media (max-width: 480px) {
          .sign-page {
            padding: 1rem;
          }
          .auth-card-inner {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}
