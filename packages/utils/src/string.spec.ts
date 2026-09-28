import { capitalize, toCamelCase, toKebabCase, truncate, isBlank, toSlug } from './string';

describe('String Utils', () => {
  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
    it('handles empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('converts kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
    });
    it('converts snake_case to camelCase', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld');
    });
  });

  describe('toKebabCase', () => {
    it('converts camelCase to kebab-case', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });
    it('does not truncate short strings', () => {
      expect(truncate('Hi', 10)).toBe('Hi');
    });
  });

  describe('isBlank', () => {
    it('returns true for empty string', () => {
      expect(isBlank('')).toBe(true);
    });
    it('returns true for whitespace only', () => {
      expect(isBlank('   ')).toBe(true);
    });
    it('returns false for non-empty string', () => {
      expect(isBlank('hello')).toBe(false);
    });
    it('returns true for null', () => {
      expect(isBlank(null)).toBe(true);
    });
  });

  describe('toSlug', () => {
    it('converts string to slug', () => {
      expect(toSlug('Hello World!')).toBe('hello-world');
    });
  });
});
