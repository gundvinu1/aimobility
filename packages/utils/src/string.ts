// =============================================================================
// String Utilities
// =============================================================================

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, char: string) => (char ? char.toUpperCase() : ''));
}

/**
 * Convert a string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Remove leading and trailing whitespace and normalize internal whitespace
 */
export function normalizeWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Generate a simple slug from a string
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if a string is empty or only whitespace
 */
export function isBlank(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}
