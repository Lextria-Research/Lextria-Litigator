// src/lib/auth.ts
// Handles authentication in dual modes: 'test' (preset role accounts) and 'otp' (6-digit email OTP).
// Also manages SUPER_ADMIN "View As Role" simulation and role authorization helpers.

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

export const AUTH_MODE: 'test' | 'otp' = 
  (import.meta.env.VITE_AUTH_MODE as 'test' | 'otp') || 'test';

export const SEEDED_TEST_USERS: UserProfile[] = [
  {
    id: '186b16de-e8ff-48a1-a9a9-6b02e61d448d',
    email: 'lithead@lextria-demo.test',
    display_name: 'Sanjay Deshmukh (Litigation Head)',
    role: 'DEPT_ADMIN',
    department: 'LITIGATION',
    is_finance_lead: false,
    active: true,
  },
  {
    id: '8aba10cd-fdaf-4a61-96f8-1b1b2e5dfb93',
    email: 'associate@lextria-demo.test',
    display_name: 'Priyanka Sen (Associate)',
    role: 'ASSOCIATE',
    department: 'LITIGATION',
    is_finance_lead: false,
    active: true,
  },
  {
    id: '21460e96-0e22-409b-aa04-6363ecd9474a',
    email: 'associate2@lextria-demo.test',
    display_name: 'Aditya Verma (Associate 2)',
    role: 'ASSOCIATE',
    department: 'LITIGATION',
    is_finance_lead: false,
    active: true,
  },
  {
    id: 'd62d8493-fedc-45d7-b0d2-eab02d508ecb',
    email: 'intern@lextria-demo.test',
    display_name: 'Rohan Joshi (Intern)',
    role: 'INTERN',
    department: 'LITIGATION',
    is_finance_lead: false,
    active: true,
  },
  {
    id: 'fl-uuid-finance-lead',
    email: 'fl@lextria-demo.test',
    display_name: 'Ramesh Patel (Finance)',
    role: 'FINANCE',
    department: 'FINANCE',
    is_finance_lead: true,
    active: true,
  },
  {
    id: 'sa1-uuid-super-admin',
    email: 'sa1@lextria-demo.test',
    display_name: 'Ananya Sharma (Partner / Admin)',
    role: 'SUPER_ADMIN',
    department: 'MANAGEMENT',
    is_finance_lead: false,
    active: true,
  },
];

export const TEST_PASSWORDS: Record<string, string> = {
  'lithead@lextria-demo.test': 'Lx!+KFU7*m#ggKKpf!9',
  'associate@lextria-demo.test': 'Lx!QtmA!ApTrbBw62ZL',
  'associate2@lextria-demo.test': 'Lx!sPfEnEwrCVGbuC!U',
  'intern@lextria-demo.test': 'Lx!LmYcfzCDZehCuEe4',
  'fl@lextria-demo.test': 'Lx!+r9Lw#cJrM2#Jtqj',
  'sa1@lextria-demo.test': 'Lx!2A22dDQrY7KWjamc',
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

export function isLitigationHead(user: UserProfile | null): boolean {
  return hasRole(user, ['DEPT_ADMIN', 'SUPER_ADMIN']);
}

export function isIntern(user: UserProfile | null): boolean {
  return getEffectiveRole(user) === 'INTERN';
}

export function isFinance(user: UserProfile | null): boolean {
  return hasRole(user, ['FINANCE', 'SUPER_ADMIN']);
}

export function isSuperAdmin(user: UserProfile | null): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function canDeleteCases(user: UserProfile | null): boolean {
  const role = getEffectiveRole(user);
  return role !== 'INTERN' && role !== 'FINANCE';
}
