// =============================================================================
// Date Utilities
// =============================================================================

import { format, parseISO, isValid, differenceInDays, addDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Format a date to ISO 8601 string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an ISO 8601 string to a Date
 */
export function fromISOString(isoString: string): Date {
  return parseISO(isoString);
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: unknown): boolean {
  if (date instanceof Date) return isValid(date);
  if (typeof date === 'string') return isValid(parseISO(date));
  return false;
}

/**
 * Format a date with a given format string
 */
export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Get the difference in days between two dates
 */
export function daysBetween(start: Date, end: Date): number {
  return differenceInDays(end, start);
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Get start of day (midnight)
 */
export function getStartOfDay(date: Date): Date {
  return startOfDay(date);
}

/**
 * Get end of day (23:59:59.999)
 */
export function getEndOfDay(date: Date): Date {
  return endOfDay(date);
}

/**
 * Get current UTC timestamp as ISO string
 */
export function nowUTC(): string {
  return new Date().toISOString();
}
