/**
 * Parse and validate a date string
 * Returns null if invalid, Date object if valid
 */
function parseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date
}

/**
 * Format a date string into a human-readable format
 * - "Today" for dates within today
 * - "Yesterday" for dates within the previous day
 * - "X days ago" for dates within the last week
 * - Relative weeks/months for older dates
 * - Formatted date string for older dates
 */
export function formatDate(dateString: string | undefined | null): string {
  const date = parseDate(dateString)
  if (!date) return 'Never'
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7 && days >= 0) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const fullDateOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}

const shortDateOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}

/**
 * Format a date string into a full date format (e.g., "January 1, 2024")
 */
export function formatDateFull(dateString: string | undefined | null): string {
  const date = parseDate(dateString)
  if (!date) return 'Never'
  return date.toLocaleDateString('en-US', fullDateOptions)
}

/**
 * Format a date string into a short date format (e.g., "Jan 1, 2024")
 */
export function formatDateShort(dateString: string | undefined | null): string {
  const date = parseDate(dateString)
  if (!date) return 'Never'
  return date.toLocaleDateString('en-US', shortDateOptions)
}

/**
 * Check if a date is within today
 */
export function isToday(dateString: string | undefined | null): boolean {
  const date = parseDate(dateString)
  if (!date) return false
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

/**
 * Check if a date is within the last week
 */
export function isWithinLastWeek(dateString: string | undefined | null): boolean {
  const date = parseDate(dateString)
  if (!date) return false
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  return days >= 0 && days < 7
}
