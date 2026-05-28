import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/AuthPage.css'
import ErrorText from '@/components/ui/ErrorText'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerStore } from '@/store/usePlayerStore'

type Mode = 'login' | 'signup'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/

type FieldErrorKey = 'identifier' | 'email' | 'username' | 'password' | 'confirmPassword' | 'consent' | 'displayName' | 'dateOfBirth' | 'form'
type FieldErrors = Partial<Record<FieldErrorKey, string>>

function validateLogin(identifier: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  const trimmedIdentifier = identifier.trim()

  if (!trimmedIdentifier) {
    errors.identifier = 'Email or username is required.'
  } else if (trimmedIdentifier.includes('@') && !EMAIL_PATTERN.test(trimmedIdentifier)) {
    errors.identifier = 'Enter a valid email address or username.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  }

  return errors
}

function validateSignup(
  email: string,
  username: string,
  password: string,
  confirmPassword: string,
  acceptedTerms: boolean,
  displayName: string,
  dateOfBirth: string,
): FieldErrors {
  const errors: FieldErrors = {}
  const trimmedEmail = email.trim()
  const trimmedUsername = username.trim()

  if (!trimmedEmail) {
    errors.email = 'Email is required.'
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!trimmedUsername) {
    errors.username = 'Username is required.'
  } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
    errors.username = 'Username must be 3-20 characters and use letters, numbers, underscore, or dash.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  } else if (/^[A-Za-z]+$/.test(password)) {
    errors.password = 'Password must include at least one number or symbol.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Password confirmation does not match.'
  }

  if (!acceptedTerms) {
    errors.consent = 'Please accept the terms of service and privacy policy.'
  }

  // display_name: optional, but if provided cap at 100 chars
  if (displayName.trim().length > 100) {
    errors.displayName = 'Display name must be 100 characters or less.'
  }

  // date_of_birth: optional, but if provided must be in the past
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth)
    if (isNaN(dob.getTime()) || dob >= new Date()) {
      errors.dateOfBirth = 'Please enter a valid date of birth in the past.'
    }
  }

  return errors
}

const AuthPage = () => {
  const navigate = useNavigate()
  const { login, register, isLoading, error } = useAuth()
  const { user, isInitialized } = usePlayerStore()
  const [mode, setMode] = useState<Mode>('login')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setLocalUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (isInitialized && user) {
      navigate('/', { replace: true })
    }
  }, [isInitialized, navigate, user])

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode)
    setFieldErrors({})
  }

  const handleGoogleOAuth = () => {
    // Redirect browser to backend initiate route.
    // Backend constructs the Google consent URL and redirects the browser there.
    // On return, backend sets cookies and redirects to FRONTEND_URL/.
    // The frontend's AuthInitializer then calls /auth/me, sees the cookies,
    // and logs the user in — no frontend callback route needed.
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/oauth/google/initiate`
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors =
      mode === 'login'
        ? validateLogin(identifier, password)
        : validateSignup(email, username, password, confirmPassword, acceptedTerms, displayName, dateOfBirth)

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})

    try {
      if (mode === 'login') {
        await login(identifier.trim().toLowerCase(), password)
      } else {
        await register(
          email.trim().toLowerCase(),
          password,
          username.trim(),
          displayName.trim() || undefined,
          dateOfBirth || undefined,
        )
      }
    } catch {
      // Hook already sets user-facing error state.
    }
  }

  return (
    <div className="authx-container">
      <div className="authx-bg-wrapper">
        <div className="authx-bg-orb authx-bg-orb-1" />
        <div className="authx-bg-orb authx-bg-orb-2" />
      </div>

      <div className="authx-root">
        <div className="authx-header">
          <div className="authx-title-wrap">
            <h2 className="authx-title">{mode === 'login' ? 'Welcome Back' : 'Join Jikkei'}</h2>
          </div>
          <p className="authx-subtitle">
            {mode === 'login' ? 'Sign in to continue your story.' : 'Create an account to start your story.'}
          </p>
        </div>

        <div className="authx-card">
          <div className="authx-mode-box">
            <div className="authx-mode">
              <button
                type="button"
                className={`authx-mode-btn ${mode === 'login' ? 'authx-mode-btn-active' : ''}`}
                onClick={() => handleModeChange('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`authx-mode-btn ${mode === 'signup' ? 'authx-mode-btn-active' : ''}`}
                onClick={() => handleModeChange('signup')}
              >
                Signup
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="authx-form" noValidate>
            {mode === 'login' ? (
              <label className="authx-field">
                <span className="authx-label">EMAIL / USERNAME</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your Email or Username..."
                  className="authx-input"
                />
                <ErrorText message={fieldErrors.identifier ?? ''} className="authx-error" />
              </label>
            ) : (
              <>
                <label className="authx-field">
                  <span className="authx-label">EMAIL</span>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your Email..."
                    className="authx-input"
                  />
                  <ErrorText message={fieldErrors.email ?? ''} className="authx-error" />
                </label>

                <label className="authx-field">
                  <span className="authx-label">USERNAME</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setLocalUsername(e.target.value)}
                    placeholder="Enter your Username..."
                    className="authx-input"
                  />
                  <ErrorText message={fieldErrors.username ?? ''} className="authx-error" />
                </label>

                {/* DISPLAY NAME — optional, shown in profile */}
                <label className="authx-field">
                  <span className="authx-label">DISPLAY NAME <span className="authx-label-opt">(optional)</span></span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we call you?"
                    className="authx-input"
                    maxLength={100}
                  />
                  <ErrorText message={fieldErrors.displayName ?? ''} className="authx-error" />
                </label>

                {/* DATE OF BIRTH — optional, used for age display on profile */}
                <label className="authx-field">
                  <span className="authx-label">DATE OF BIRTH <span className="authx-label-opt">(optional)</span></span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="authx-input authx-input-date"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <ErrorText message={fieldErrors.dateOfBirth ?? ''} className="authx-error" />
                </label>
              </>
            )}

            <label className="authx-field">
              <span className="authx-label">PASSWORD</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your Password..."
                className="authx-input"
              />
              <ErrorText message={fieldErrors.password ?? ''} className="authx-error" />
            </label>

            {mode === 'signup' ? (
              <label className="authx-field">
                <span className="authx-label">CONFIRM PASSWORD</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your Password..."
                  className="authx-input"
                />
                <ErrorText message={fieldErrors.confirmPassword ?? ''} className="authx-error" />
              </label>
            ) : null}

            {mode === 'signup' ? (
              <label className="authx-consent">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="authx-consent-input"
                />
                <span className="authx-consent-text">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="authx-inline-link">
                    terms of service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="authx-inline-link">
                    privacy policy
                  </a>
                </span>
              </label>
            ) : null}

            <ErrorText message={fieldErrors.consent ?? ''} className="authx-error" />
            <ErrorText message={fieldErrors.form ?? ''} className="authx-error" />
            {error ? <div className="authx-form-error">⚠ {error}</div> : null}

            <div className="authx-row">
              <button className="btn-primary authx-submit" type="submit" disabled={isLoading}>
                {isLoading ? 'AUTHENTICATING...' : mode === 'login' ? 'Login' : 'Signup'}
              </button>
              <button className="authx-forgot" type="button" disabled={isLoading}>
                FORGOT PASSWORD?
              </button>
            </div>

            {/* OAuth divider */}
            <div className="authx-divider">
              <span className="authx-divider-line" />
              <span className="authx-divider-text">or</span>
              <span className="authx-divider-line" />
            </div>

            {/* Google OAuth button */}
            <button
              type="button"
              className="authx-oauth-btn authx-oauth-google"
              onClick={handleGoogleOAuth}
              disabled={isLoading}
            >
              <svg className="authx-oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
