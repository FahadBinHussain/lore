export const USER_ROLES = ['admin', 'user'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function normalizeUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : 'user';
}

export function isAdminRole(value: unknown): boolean {
  return normalizeUserRole(value) === 'admin';
}
