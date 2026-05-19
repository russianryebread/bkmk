// Global 401 handler.
//
// When the user's session genuinely expires we want to clear the cached
// auth and bounce them to /login. But we MUST avoid acting on:
//   - 401s from /api/auth/*  (e.g. a bad login is not a session expiry)
//   - requests that explicitly opted out of credentials (`credentials: 'omit'`)
//   - requests using an alternate auth scheme (`Authorization` header)
//   - non-/api paths (assets, third-party hosts)
// Otherwise a single deliberate 401 anywhere — even from a background
// hydration race — yanks the user out of their current view.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const originalFetch = window.fetch.bind(window)
  let redirected = false

  window.fetch = async (input, init) => {
    const response = await originalFetch(input as RequestInfo, init)

    if (response.status !== 401) return response

    // Resolve URL and method headers from either input or init.
    const reqUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url
    let path: string
    try {
      path = new URL(reqUrl, window.location.origin).pathname
    } catch {
      return response
    }

    if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) {
      return response
    }

    const initHeaders =
      init?.headers ??
      (input instanceof Request ? input.headers : undefined)
    const headers = new Headers(initHeaders ?? {})
    const credentials =
      init?.credentials ??
      (input instanceof Request ? input.credentials : 'same-origin')

    if (headers.has('authorization') || credentials === 'omit') {
      return response
    }

    // It's a session-authed API call that came back unauthorized — the
    // session has expired (or the cookie was cleared server-side).
    if (redirected) return response
    redirected = true

    console.warn('[Auth] Session expired (401), redirecting to login')
    try {
      localStorage.removeItem('bkmk_auth')
    } catch {
      // ignore (private mode / quota)
    }

    if (!window.location.pathname.startsWith('/login')) {
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      )
      window.location.href = `/login?redirect=${redirect}`
    }

    return response
  }
})
