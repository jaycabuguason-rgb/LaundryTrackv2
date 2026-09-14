import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts initials for a user based on their first and second name.
 * e.g. "Jay Cabuguason" -> "JC"
 * If name is single word, attempts to use username or email parts, or first 2 chars.
 */
export function getUserInitials(
  name?: string | null,
  username?: string | null,
  email?: string | null
): string {
  const cleanName = (name || "").trim();
  if (cleanName) {
    const spaceParts = cleanName.split(/\s+/).filter(Boolean);
    if (spaceParts.length >= 2) {
      return (spaceParts[0][0] + spaceParts[1][0]).toUpperCase();
    }
    const camelParts = cleanName.match(/[A-Z][a-z0-9]*/g);
    if (camelParts && camelParts.length >= 2) {
      return (camelParts[0][0] + camelParts[1][0]).toUpperCase();
    }
    const delimParts = cleanName.split(/[-._]+/).filter(Boolean);
    if (delimParts.length >= 2) {
      return (delimParts[0][0] + delimParts[1][0]).toUpperCase();
    }
    const cleanUsername = (username || "").trim();
    if (cleanUsername) {
      const uSpaceParts = cleanUsername.split(/\s+/).filter(Boolean);
      if (uSpaceParts.length >= 2) {
        return (uSpaceParts[0][0] + uSpaceParts[1][0]).toUpperCase();
      }
      const uDelimParts = cleanUsername.split(/[-._]+/).filter(Boolean);
      if (uDelimParts.length >= 2) {
        return (uDelimParts[0][0] + uDelimParts[1][0]).toUpperCase();
      }
    }
    if (spaceParts.length === 1 && spaceParts[0].length >= 2) {
      return spaceParts[0].slice(0, 2).toUpperCase();
    }
    if (spaceParts.length === 1) {
      return spaceParts[0].toUpperCase();
    }
  }

  const cleanUsername = (username || "").trim();
  if (cleanUsername) {
    const spaceParts = cleanUsername.split(/\s+/).filter(Boolean);
    if (spaceParts.length >= 2) {
      return (spaceParts[0][0] + spaceParts[1][0]).toUpperCase();
    }
    const camelParts = cleanUsername.match(/[A-Z][a-z0-9]*/g);
    if (camelParts && camelParts.length >= 2) {
      return (camelParts[0][0] + camelParts[1][0]).toUpperCase();
    }
    const delimParts = cleanUsername.split(/[-._]+/).filter(Boolean);
    if (delimParts.length >= 2) {
      return (delimParts[0][0] + delimParts[1][0]).toUpperCase();
    }
    if (cleanUsername.length >= 2) {
      return cleanUsername.slice(0, 2).toUpperCase();
    }
    return cleanUsername.toUpperCase();
  }

  const cleanEmail = (email || "").split("@")[0].trim();
  if (cleanEmail) {
    const delimParts = cleanEmail.split(/[-._]+/).filter(Boolean);
    if (delimParts.length >= 2) {
      return (delimParts[0][0] + delimParts[1][0]).toUpperCase();
    }
    return cleanEmail.slice(0, 2).toUpperCase();
  }

  return "LT";
}
