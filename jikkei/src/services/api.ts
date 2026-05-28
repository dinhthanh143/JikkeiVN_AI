import axios, { AxiosError } from 'axios'

interface RetryableRequestConfig {
  url?: string
  _retry?: boolean
}

export interface ApiError {
  error: string
  detail: string | Record<string, unknown>
  status: number
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Prevent concurrent refresh attempts from multiple failed requests
let isRefreshing = false
let refreshPromise: Promise<void> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const data = error.response?.data as Record<string, unknown> | undefined
    const configWithRetry = (error.config ?? {}) as RetryableRequestConfig

    // Don't retry auth endpoints that are expected to return 401 directly.
    // /auth/oauth/pending and /auth/oauth/complete are included here too —
    // a 401 from those means "no/expired pending-signup cookie", a normal
    // state for the complete-registration page to handle itself, not a
    // real session expiry that should trigger silent refresh + redirect.
    const isAuthRoute = configWithRetry.url?.includes('/auth/login')
      || configWithRetry.url?.includes('/auth/register')
      || configWithRetry.url?.includes('/auth/logout')
      || configWithRetry.url?.includes('/auth/logout-all')
      || configWithRetry.url?.includes('/auth/refresh')
      || configWithRetry.url?.includes('/auth/legal')
      || configWithRetry.url?.includes('/auth/oauth')

    const shouldRetry = status === 401 && !isAuthRoute && !configWithRetry._retry

    if (shouldRetry) {
      configWithRetry._retry = true

      try {
        // If already refreshing, wait for it; otherwise start a new refresh
        if (isRefreshing && refreshPromise) {
          await refreshPromise
        } else {
          isRefreshing = true
          refreshPromise = api.post('/auth/refresh')
          await refreshPromise
          isRefreshing = false
          refreshPromise = null
        }

        // Retry the original request
        return api(error.config!)
      } catch (refreshError) {
        isRefreshing = false
        refreshPromise = null

        // Only redirect if this is a 401 or 403 (not 429 rate limit)
        const refreshStatus = (refreshError as AxiosError).response?.status
        if (refreshStatus === 401 || refreshStatus === 403) {
          // Dispatch event and only redirect if not already on auth page
          window.dispatchEvent(new CustomEvent('jikkei:session-expired'))
          const isAuthPage = window.location.pathname === '/auth'
          if (!isAuthPage) {
            window.location.href = '/auth'
          }
        }
        // On 429 or other errors, just reject without redirecting
        throw refreshError
      }
    }

    const normalized: ApiError = {
      error: (data?.error as string) ?? 'UNKNOWN_ERROR',
      detail:
        status === 429
          ? ((data?.detail as string | Record<string, unknown>) ?? 'Too many requests. Please wait and try again.')
          : ((data?.detail as string | Record<string, unknown>) ?? error.message),
      status: status ?? 0,
    }

    return Promise.reject(normalized)
  },
)

export default api
