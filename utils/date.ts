export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Never'
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7 && days >= 0) return `${days} days ago`
  return date.toLocaleDateString()
}