import { lookup } from 'node:dns/promises'

/**
 * SSRF protection helpers.
 *
 * Server-side fetches of user-supplied URLs must be validated to prevent
 * attackers from reaching internal/metadata endpoints (localhost,
 * 169.254.169.254, private LAN ranges, etc.).
 */

/**
 * Check whether an IPv4 address string falls in a blocked range:
 * loopback (127/8), private (10/8, 172.16/12, 192.168/16),
 * link-local (169.254/16), CGNAT (100.64/10), or 0.0.0.0.
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(p => Number(p))
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    // Not a well-formed IPv4 string; treat as unsafe.
    return true
  }
  const [a, b] = parts as [number, number, number, number]

  if (a === 0) return true // 0.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT

  return false
}

/**
 * Check whether an IPv6 address string falls in a blocked range:
 * loopback (::1), unspecified (::), unique-local (fc00::/7),
 * link-local (fe80::/10). IPv4-mapped addresses (::ffff:x.x.x.x) are
 * unwrapped and checked against the IPv4 rules.
 */
function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0] ?? '' // strip zone id

  if (addr === '::1' || addr === '::') return true

  // IPv4-mapped / IPv4-compatible addresses, e.g. ::ffff:127.0.0.1
  const mapped = addr.match(/(?:::ffff:|::)((?:\d{1,3}\.){3}\d{1,3})$/)
  if (mapped) {
    return isBlockedIPv4(mapped[1]!)
  }

  // IPv4-mapped expressed in hex, e.g. ::ffff:7f00:0001
  const hexMapped = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1]!, 16)
    const lo = parseInt(hexMapped[2]!, 16)
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isBlockedIPv4(v4)
  }

  // fc00::/7 unique-local: first byte 0xfc or 0xfd
  const firstHextet = parseInt(addr.split(':')[0] || '0', 16)
  if ((firstHextet & 0xfe00) === 0xfc00) return true

  // fe80::/10 link-local
  if ((firstHextet & 0xffc0) === 0xfe80) return true

  return false
}

function isBlockedAddress(ip: string, family: number): boolean {
  if (family === 4) return isBlockedIPv4(ip)
  if (family === 6) return isBlockedIPv6(ip)
  // Unknown family — fail closed.
  return true
}

/**
 * Validate that a URL is safe to fetch server-side.
 *
 * Rejects:
 *  - non-http(s) schemes
 *  - URLs with embedded credentials (user:pass@host)
 *  - hostnames that resolve to any loopback/private/link-local/
 *    unique-local/CGNAT address
 *
 * Throws an Error with a clear message if the URL is unsafe.
 *
 * NOTE: this validates the *initial* URL only. Redirect targets followed
 * by axios/fetch are NOT re-validated here — callers that follow redirects
 * accept that residual risk.
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Unsafe URL: could not parse "${url}"`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsafe URL: scheme "${parsed.protocol}" is not allowed`)
  }

  if (parsed.username || parsed.password) {
    throw new Error('Unsafe URL: embedded credentials are not allowed')
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets

  if (!hostname) {
    throw new Error('Unsafe URL: missing hostname')
  }

  // Resolve every address the hostname maps to and reject if ANY is internal.
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new Error(`Unsafe URL: could not resolve hostname "${hostname}"`)
  }

  if (addresses.length === 0) {
    throw new Error(`Unsafe URL: hostname "${hostname}" resolved to no addresses`)
  }

  for (const { address, family } of addresses) {
    if (isBlockedAddress(address, family)) {
      throw new Error(
        `Unsafe URL: hostname "${hostname}" resolves to a blocked address (${address})`
      )
    }
  }
}
