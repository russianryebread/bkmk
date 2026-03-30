/**
 * URL Cleaner - Removes tracking parameters, identifiers, and UTMs from URLs
 * while preserving important URL parameters that are needed for functionality.
 */

export class UrlCleaner {
  // Parameters to always remove (tracking, analytics, referrer)
  private static readonly TRACKING_PARAMS = new Set([
    // UTM parameters
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'utm_source_platform',
    'utm_creative_format',
    'utm_marketing_tactic',
    // Common tracking parameters
    'fbclid',
    'gclid',
    'dclid',
    'msclkid',
    'mc_eid',
    'mc_cid',
    'ref',
    'referrer',
    'source',
    'affiliate',
    'aff_id',
    'affiliate_id',
    'affiliate_track',
    'partner_id',
    'click_id',
    'tid',
    'transaction_id',
    'variant',
    'oly_enc_id',
    'oly_anon_id',
    '_ga',
    '_gl',
    'gclsrc',
    'dclid',
    // Adobe Analytics
    'cid',
    'icid',
    // HubSpot
    '_hsenc',
    '_hsmi',
    'hsCtaTracking',
    // Mailchimp
    'mc_cid',
    'mc_eid',
    // Marketo
    'mkt_tok',
    // Salesforce
    'sfdc',
    ' Chatter',
    //通用追踪
    'trk',
    'trkContact',
    'trkMsg',
    'trkModule',
    'trkSid',
    'trkUser',
    // Bitly and shorteners
    '_c',
    '_r',
    // Others
    's_kwcid',
    'sc_cid',
    'smc',
    'sm_id',
    'yclid',
    'wickedid',
    'wbraid',
    'gbraid',
    'msclkid',
    'srsltid',
  ])

  // Parameters that might be important to keep
  private static readonly PRESERVE_PARAMS = new Set([
    // YouTube
    'v',
    'list',
    'index',
    't',
    'start',
    'end',
    'ab_channel',
    // Vimeo
    'h',
    'q',
    't',
    // GitHub
    'ref',
    'branch',
    // Stack Overflow
    'noredirect',
    // Google search
    'q',
    // Pagination and filtering
    'page',
    'per_page',
    'limit',
    'offset',
    'sort',
    'order',
    // Search/filter params that might matter
    'search',
    'query',
    'q',
    'filter',
    'category',
    'tag',
    's',
    // Authentication (sometimes needed)
    'token',
    'key',
    'api_key',
    // Navigation
    'redirect',
    'return',
    'return_to',
    'continue',
    // Content identification
    'id',
    'slug',
    'post_id',
    'article_id',
    // Language/region
    'lang',
    'locale',
    'hl',
  ])

  /**
   * Clean a URL by removing tracking parameters while preserving important ones
   */
  static clean(url: string): string {
    try {
      const urlObj = new URL(url)

      // Get all parameters to remove
      const paramsToRemove: string[] = []
      urlObj.searchParams.forEach((value, key) => {
        const lowerKey = key.toLowerCase()

        // Remove if in tracking list
        if (this.isTrackingParam(key)) {
          paramsToRemove.push(key)
          return
        }

        // Remove if it looks like a tracker (contains common tracker patterns)
        if (this.looksLikeTracker(key, value)) {
          paramsToRemove.push(key)
          return
        }

        // Remove empty or single-character params that look like IDs
        if (this.looksLikeTrackerId(key, value)) {
          paramsToRemove.push(key)
        }
      })

      // Remove the identified params
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param))

      return urlObj.toString()
    } catch {
      // If URL parsing fails, return original
      return url
    }
  }

  /**
   * Check if a parameter is a known tracking parameter
   */
  private static isTrackingParam(param: string): boolean {
    const lowerParam = param.toLowerCase()
    return this.TRACKING_PARAMS.has(lowerParam)
  }

  /**
   * Check if a parameter/value looks like a tracking ID
   */
  private static looksLikeTrackerId(param: string, value: string): boolean {
    // Common tracking ID patterns
    const trackerPatterns = [
      /^(_|g_|ga_|utm_|fb_|gcl_|mc_|hs_)/i, // Common prefixes
      /^[a-f0-9]{20,}$/i, // Long hex IDs (like GA/FB IDs)
      /^UA-\d+-\d+$/i, // Google Analytics IDs
      /^G-[A-Z0-9]+$/i, // Google Analytics 4 IDs
      /^AW-\d+$/i, // Google Ads IDs
    ]

    // Check param name patterns
    const paramPatterns = [
      /^(trk|track|click|ref|aff|partner|source|uid|uuid|sid|session)/i,
      /_id$/i,
      /_track$/i,
      /_click$/i,
    ]

    // If param name looks like a tracker ID
    for (const pattern of paramPatterns) {
      if (pattern.test(param)) {
        return true
      }
    }

    // If value looks like a tracking ID and param doesn't seem important
    for (const pattern of trackerPatterns) {
      if (pattern.test(value) && !this.PRESERVE_PARAMS.has(param.toLowerCase())) {
        return true
      }
    }

    return false
  }

  /**
   * Check if param/value combination looks like a tracker
   */
  private static looksLikeTracker(param: string, value: string): boolean {
    // Skip if param should be preserved
    if (this.PRESERVE_PARAMS.has(param.toLowerCase())) {
      return false
    }

    // Skip if param is a common important param
    const importantParams = ['v', 'list', 'id', 'slug', 'post_id', 'article_id', 'q', 'search', 'query']
    if (importantParams.includes(param.toLowerCase())) {
      return false
    }

    // Check for common tracker domain patterns in values
    const trackerDomains = [
      'utm_',
      'facebook.com',
      'google.com',
      'track',
      'click',
      'analytics',
    ]

    // Check if value contains tracker info
    if (value.length > 50 && !value.includes('/') && !value.includes('.')) {
      // Long alphanumeric string that's not a path - likely a tracker ID
      return true
    }

    return false
  }

  /**
   * Get a clean version of just the origin + path (without query params that should be removed)
   */
  static cleanBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const cleanUrl = new URL(urlObj.origin + urlObj.pathname)
      return cleanUrl.toString()
    } catch {
      return url
    }
  }

  /**
   * Check if a URL likely has tracking parameters
   */
  static hasTrackingParams(url: string): boolean {
    try {
      const urlObj = new URL(url)
      let hasTracking = false
      urlObj.searchParams.forEach((_, key) => {
        if (this.isTrackingParam(key) || this.looksLikeTrackerId(key, '')) {
          hasTracking = true
        }
      })
      return hasTracking
    } catch {
      return false
    }
  }
}

export default UrlCleaner