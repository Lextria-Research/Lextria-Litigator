// src/lib/auth.ts
// Handles authentication, active user profile state, and role authorization helpers.

export type Role =
  | 'SUPER_ADMIN'
  | 'DEPT_ADMIN'
  | 'FINANCE'
  | 'PARALEGAL'
  | 'DRAFTER'
  | 'ASSOCIATE'
  | 'INTERN'
  | 'OFFICE_EXEC'
  | 'STAFF';

export type Department =
  | 'MANAGEMENT'
  | 'IP_PATENT'
  | 'IP_SOFT'
  | 'PARALEGAL'
  | 'LITIGATION'
  | 'AGREEMENT'
  | 'FINANCE'
  | 'OFFICE';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  department: Department;
  reports_to?: string | null;
  is_finance_lead: boolean;
  active: boolean;
}

export const AUTH_MODE: 'password' | 'otp' = 
  (import.meta.env.VITE_AUTH_MODE as 'password' | 'otp') || 'password';

export const INITIAL_SUPER_ADMIN: UserProfile = {
  id: '5b488b59-915c-4f02-b973-748cf9a46902',
  email: 'pranavbhat@lextria.in',
  display_name: 'Pranav Bhat (Super Admin)',
  role: 'SUPER_ADMIN',
  department: 'MANAGEMENT',
  is_finance_lead: false,
  active: true,
};

export const SEEDED_TEST_USERS: UserProfile[] = [INITIAL_SUPER_ADMIN];

export const INITIAL_CREDENTIALS: Record<string, string> = {
  'pranavbhat@lextria.in': 'LextriaLT@334',
};

const LOCAL_STORAGE_USER_KEY = 'lextria_litigator_active_profile';
const LOCAL_STORAGE_VIEW_AS_KEY = 'lextria_litigator_view_as_role';

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return null;
}

export function setStoredUser(user: UserProfile | null) {
  if (user) {
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    localStorage.removeItem(LOCAL_STORAGE_VIEW_AS_KEY);
  }
}

export function signOutUser() {
  setStoredUser(null);
}

export function getViewAsRole(): Role | null {
  return (localStorage.getItem(LOCAL_STORAGE_VIEW_AS_KEY) as Role) || null;
}

export function setViewAsRole(role: Role | null) {
  if (role) {
    localStorage.setItem(LOCAL_STORAGE_VIEW_AS_KEY, role);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_VIEW_AS_KEY);
  }
}

/**
 * Returns effective role accounting for SUPER_ADMIN "View As Role" simulation
 */
export function getEffectiveRole(user: UserProfile | null): Role {
  if (!user) return 'STAFF';
  if (user.role === 'SUPER_ADMIN') {
    const viewAs = getViewAsRole();
    if (viewAs) return viewAs;
  }
  return user.role;
}

export function hasRole(user: UserProfile | null, allowedRoles: Role[]): boolean {
  const role = getEffectiveRole(user);
  return allowedRoles.includes(role);
}

export function isSuperAdmin(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'SUPER_ADMIN';
}

export function isFinance(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'FINANCE';
}

export function isAssociate(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'ASSOCIATE';
}

export function isLitigationHead(user: UserProfile | null): boolean {
  return hasRole(user, ['DEPT_ADMIN', 'SUPER_ADMIN']);
}

export function isIntern(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'INTERN';
}

export function isSuperAdminOrFinance(user: UserProfile | null): boolean {
  return hasRole(user, ['SUPER_ADMIN', 'FINANCE']);
}

/**
 * Super Admin & Finance Head have access to quotations.
 * Litigation Associates CANNOT view or edit quotations.
 */
export function canViewQuotation(user: UserProfile | null): boolean {
  const role = getEffectiveRole(user);
  return role === 'SUPER_ADMIN' || role === 'FINANCE';
}

export function canManageQuotation(user: UserProfile | null): boolean {
  const role = getEffectiveRole(user);
  return role === 'SUPER_ADMIN' || role === 'FINANCE';
}

/**
 * Super Admin & Litigation Associate have full access to case data entry,
 * editing hearings, outcomes, orders, deadlines, parties, notes.
 * Finance Head has read-only visibility over case data.
 */
export function canEditCaseData(user: UserProfile | null): boolean {
  const role = getEffectiveRole(user);
  return role === 'SUPER_ADMIN' || role === 'ASSOCIATE' || role === 'DEPT_ADMIN';
}

/**
 * Only Super Admin can manage team members, invite users, or delete users.
 */
export function canManageTeam(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'SUPER_ADMIN';
}

export function canDeleteCases(user: UserProfile | null): boolean {
  return isSuperAdmin(user);
}

