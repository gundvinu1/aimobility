// =============================================================================
// Common Types
// =============================================================================

/** ISO 8601 date string */
export type ISODateString = string;

/** UUID v4 string */
export type UUID = string;

/** Generic ID type */
export type ID = string;

/** Generic record with string keys */
export type Dict<T = unknown> = Record<string, T>;

/** Make specific keys required */
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Make specific keys optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep partial type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Nullable type helper */
export type Nullable<T> = T | null;

/** Optional nullable type helper */
export type Maybe<T> = T | null | undefined;

/** Environment types */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/** Base entity with timestamps */
export interface BaseEntity {
  id: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Soft-deletable entity */
export interface SoftDeletableEntity extends BaseEntity {
  deletedAt: ISODateString | null;
}
