"use client"

import { useAuth } from "@/components/Providers"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Feather, ArrowRight, Mail, Lock, User, Sparkles, BookOpen, Brain, LockKeyhole } from "lucide-react"

export default function LandingPage() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (isSignUp) {
        await signUp(email, password, displayName)
      } else {
        await signIn(email, password)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed"
      if (message.includes("email-already-in-use")) setError("This email is already registered. Try signing in.")
      else if (message.includes("wrong-password") || message.includes("invalid-credential")) setError("Invalid email or password.")
      else if (message.includes("user-not-found")) setError("No account found. Try signing up.")
      else if (message.includes("weak-password")) setError("Password must be at least 6 characters.")
      else if (message.includes("invalid-email")) setError("Please enter a valid email address.")
      else setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed"
      if (message.includes("popup-closed-by-user")) setError("Sign-in popup was closed. Try again.")
      else setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <Feather size={28} />
          </div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-root">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-grid"></div>
      
      <nav className="landing-nav">
        <div className="container nav-container">
          <div className="logo-area">
            <div className="logo-icon">
              <Feather size={20} />
            </div>
            <span className="logo-text">PenPad</span>
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={() => setIsSignUp(false)}>Sign In</button>
            <button className="nav-link-primary" onClick={() => setIsSignUp(true)}>Get Started</button>
          </div>
        </div>
      </nav>

      <main className="landing-main container">
        <div className="content-side">
          <div className="content-inner">
            <div className="badge">
              <Sparkles size={14} />
              <span>Where Ideas Find Their Voice</span>
            </div>
            
            <h1 className="hero-title">
              Your Private
              <br />
              <span className="gradient-text">Writing Sanctuary</span>
            </h1>
            
            <p className="hero-description">
              A distraction-free environment where AI enhances your prose, 
              never replaces it. Write with clarity, publish with confidence.
            </p>

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon">
                  <BookOpen size={18} />
                </div>
                <div className="feature-text">
                  <span className="feature-title">Distraction-Free</span>
                  <span className="feature-desc">Clean, minimal interface that fades away</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <Brain size={18} />
                </div>
                <div className="feature-text">
                  <span className="feature-title">AI-Powered</span>
                  <span className="feature-desc">Intelligent suggestions that respect your voice</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <LockKeyhole size={18} />
                </div>
                <div className="feature-text">
                  <span className="feature-title">Privacy First</span>
                  <span className="feature-desc">Your words, encrypted and secure</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-side">
          <div className="auth-card">
            <div className="auth-card-inner">
              <div className="auth-header">
                <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                <p>{isSignUp ? "Start your writing journey today" : "Continue where you left off"}</p>
              </div>
              
              <form onSubmit={handleSubmit} className="auth-form">
                {isSignUp && (
                  <div className="form-field">
                    <label>Full Name</label>
                    <div className="input-wrapper">
                      <User size={18} className="input-icon" />
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Jane Austen"
                        required
                      />
                    </div>
                  </div>
                )}
                
                <div className="form-field">
                  <label>Email</label>
                  <div className="input-wrapper">
                    <Mail size={18} className="input-icon" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="writer@example.com"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-field">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {error && (
                  <div className="error-message">
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" className="submit-btn" disabled={submitting}>
                  <span className="btn-text">
                    {submitting ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
                  </span>
                  {!submitting && <ArrowRight size={18} />}
                </button>
              </form>

              <div className="divider">
                <span>or continue with</span>
              </div>

              <button 
                type="button" 
                className="google-btn" 
                onClick={handleGoogleSignIn} 
                disabled={submitting}
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="auth-footer">
                {isSignUp ? (
                  <>Already writing? <button onClick={() => { setIsSignUp(false); setError("") }}>Sign in</button></>
                ) : (
                  <>New to PenPad? <button onClick={() => { setIsSignUp(true); setError("") }}>Create account</button></>
                )}
              </p>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .landing-root {
          min-height: 100vh;
          background: var(--background);
          color: #ffffff;
          font-family: var(--font-inter);
          position: relative;
          overflow: hidden;
        }

        .loading-screen {
          height: 100vh;
          background: var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .loading-logo {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }
        .bg-orb-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          top: -200px;
          left: -100px;
          animation: float1 20s ease-in-out infinite;
        }
        .bg-orb-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%);
          bottom: -150px;
          right: -100px;
          animation: float2 25s ease-in-out infinite;
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 20px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, -30px); }
        }

        .bg-grid {
          position: fixed;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
        }

        .container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .landing-nav {
          height: 80px;
          display: flex;
          align-items: center;
          position: relative;
          z-index: 10;
        }
        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo-area {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .logo-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .logo-text {
          font-family: var(--font-outfit);
          font-weight: 700;
          font-size: 1.5rem;
          letter-spacing: -0.03em;
          background: linear-gradient(to bottom, #ffffff 0%, #a0a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .nav-link {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          padding: 0.625rem 1rem;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .nav-link:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
        }
        .nav-link-primary {
          background: #ffffff;
          color: #000000;
          font-weight: 600;
          font-size: 0.875rem;
          padding: 0.625rem 1.25rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-link-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
        }

        .landing-main {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 480px;
          gap: 4rem;
          align-items: center;
          min-height: calc(100vh - 80px);
          padding: 2rem 2rem 4rem;
        }
        @media (max-width: 1024px) {
          .landing-main {
            grid-template-columns: 1fr;
            gap: 3rem;
            text-align: center;
          }
        }

        .content-side {
          display: flex;
          align-items: center;
        }
        @media (max-width: 1024px) {
          .content-side { justify-content: center; }
        }
        .content-inner {
          max-width: 520px;
        }
        @media (max-width: 1024px) {
          .content-inner { max-width: 480px; }
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          padding: 0.5rem 1rem;
          border-radius: 100px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1.75rem;
        }

        .hero-title {
          font-family: var(--font-outfit);
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin-bottom: 1.5rem;
          color: #ffffff;
        }
        @media (min-width: 768px) {
          .hero-title { font-size: 4rem; }
        }
        .gradient-text {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-description {
          font-size: 1.125rem;
          line-height: 1.7;
          color: #9ca3af;
          margin-bottom: 2.5rem;
          max-width: 440px;
        }
        @media (max-width: 1024px) {
          .hero-description { margin-left: auto; margin-right: auto; }
        }

        .features-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (max-width: 1024px) {
          .features-list {
            align-items: center;
            text-align: left;
          }
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }
        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
          flex-shrink: 0;
        }
        .feature-text {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .feature-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: #ffffff;
        }
        .feature-desc {
          font-size: 0.85rem;
          color: #6b7280;
        }

        .form-side {
          display: flex;
          justify-content: flex-end;
        }
        @media (max-width: 1024px) {
          .form-side { justify-content: center; }
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
          margin-bottom: 2rem;
        }
        .auth-header h2 {
          font-family: var(--font-outfit);
          font-size: 1.75rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }
        .auth-header p {
          color: #6b7280;
          font-size: 0.9rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .form-field label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #9ca3af;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          transition: all 0.25s ease;
        }
        .input-wrapper:focus-within {
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(99, 102, 241, 0.05);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .input-icon {
          position: absolute;
          left: 1rem;
          color: #4b5563;
          transition: color 0.25s;
        }
        .input-wrapper:focus-within .input-icon {
          color: #6366f1;
        }
        .input-wrapper input {
          width: 100%;
          height: 50px;
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 0.95rem;
          padding: 0 1rem 0 3rem;
          outline: none;
        }
        .input-wrapper input::placeholder {
          color: #4b5563;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          padding: 0.875rem 1rem;
          text-align: center;
        }
        .error-message span {
          font-size: 0.85rem;
          color: #fca5a5;
        }

        .submit-btn {
          width: 100%;
          height: 52px;
          background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
          border: none;
          border-radius: 12px;
          color: #ffffff;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.25s ease;
          margin-top: 0.5rem;
          position: relative;
          overflow: hidden;
        }
        .submit-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s ease;
        }
        .submit-btn:hover:not(:disabled)::before {
          left: 100%;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px -5px rgba(99, 102, 241, 0.5);
        }
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.5rem 0;
          color: #4b5563;
          font-size: 0.8rem;
        }
        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
        }

        .google-btn {
          width: 100%;
          height: 50px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: #ffffff;
          font-weight: 500;
          font-size: 0.95rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }
        .google-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .google-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
        @media (max-width: 768px) {
          .container {
            height: 100dvh;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  )
}
