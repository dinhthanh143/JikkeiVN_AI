import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/AuthPage.css'
import ErrorText from '@/components/ui/ErrorText'
import { useAuth } from '@/hooks/useAuth'
import { authService, type OAuthPendingInfo } from '@/services/authService'
import type { ApiError } from '@/services/api'

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/

type FieldErrors = Partial<Record<'username' | 'displayName', string>>

function validate(username: string, displayName: string): FieldErrors {
  const errors: FieldErrors = {}
  const trimmedUsername = username.trim()

  if (!trimmedUsername) {
    errors.username = 'Username is required.'
  } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
    errors.username = 'Username must be 3-20 characters and use letters, numbers, underscore, or dash.'
  }

  if (displayName.trim().length > 100) {
    errors.displayName = 'Display name must be 100 characters or less.'
  }

  return errors
}

/**
 * Landed here from GET /auth/oauth/google/callback for a brand-new Google
 * identity. No users row exists yet — the backend is only holding this
 * person's Google identity in a short-lived signed cookie. Submitting this
 * form (POST /auth/oauth/complete) is what actually creates the row.
 */
const CompleteRegistrationPage = () => {
  const navigate = useNavigate()
  const { completeOAuthRegistration, isLoading, error } = useAuth()

  const [pending, setPending] = useState<OAuthPendingInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    let cancelled = false
    authService.getOAuthPendingInfo()
      .then((info) => {
        if (cancelled) return
        setPending(info)
        setUsername(info.suggested_username)
        setDisplayName(info.display_name ?? '')
      })
      .catch((err: ApiError) => {
        if (cancelled) return
        setLoadError(
          err.status === 401
            ? 'Your Google signup session expired. Please try signing in again.'
            : 'Something went wrong loading your signup. Please try again.',
        )
      })
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate(username, displayName)
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }
    setFieldErrors({})
    try {
      await completeOAuthRegistration(username.trim(), displayName.trim() || undefined)
    } catch {
      // Hook already sets user-facing error state.
    }
  }

  if (loadError) {
    return (
      <div className="authx-container">
        <div className="authx-bg-wrapper">
          <div className="authx-bg-orb authx-bg-orb-1" />
          <div className="authx-bg-orb authx-bg-orb-2" />
        </div>
        <div className="authx-root">
          <div className="authx-header">
            <h2 className="authx-title">Signup Session Expired</h2>
            <p className="authx-subtitle">{loadError}</p>
          </div>
          <div className="authx-card">
            <button type="button" className="btn-primary authx-submit" onClick={() => navigate('/auth')}>
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!pending) {
    // Brief loading state while GET /auth/oauth/pending resolves.
    return (
      <div className="authx-container">
        <div className="authx-bg-wrapper">
          <div className="authx-bg-orb authx-bg-orb-1" />
          <div className="authx-bg-orb authx-bg-orb-2" />
        </div>
        <div className="authx-root">
          <div className="authx-header">
            <h2 className="authx-title">Loading...</h2>
          </div>
        </div>
      </div>
    )
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
            <h2 className="authx-title">Almost There</h2>
          </div>
          <p className="authx-subtitle">
            Signed in as <strong>{pending.email}</strong> via {pending.provider}. Pick a username to finish creating your account.
          </p>
        </div>

        <div className="authx-card">
          <form onSubmit={handleSubmit} className="authx-form" noValidate>
            <label className="authx-field">
              <span className="authx-label">USERNAME</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username..."
                className="authx-input"
                autoFocus
              />
              <ErrorText message={fieldErrors.username ?? ''} className="authx-error" />
            </label>

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

            {error ? <div className="authx-form-error">⚠ {error}</div> : null}

            <div className="authx-row">
              <button className="btn-primary authx-submit" type="submit" disabled={isLoading}>
                {isLoading ? 'CREATING ACCOUNT...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CompleteRegistrationPage
