/**
 * Format arrival date and time to YYYY-MM-DD HH:MM format (24-hour)
 * @param dateTime - ISO string or formatted date time string
 * @returns Formatted string like "2026-05-04 14:30"
 */
export function formatArrivalDateTime(dateTime: string | Date | null | undefined): string {
  if (!dateTime) return '—'
  
  try {
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
    
    // Check if valid date
    if (isNaN(date.getTime())) {
      // Try parsing as already formatted string (YYYY-MM-DD HH:MM)
      if (typeof dateTime === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(dateTime)) {
        return dateTime.slice(0, 16) // Return first 16 chars (YYYY-MM-DD HH:MM)
      }
      return '—'
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return '—'
  }
}
