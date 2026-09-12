import type { Role } from "@prisma/client";

// Coarse-grained permissions. Route guards and server actions both consult these
// so authorization is enforced server-side, never just in the UI.

export const PERMISSIONS = {
  dashboard: "dashboard",
  manageStructure: "manageStructure", // floors, rooms, seats
  manageResidents: "manageResidents", // residents, check-in/out, transfers
  manageFinance: "manageFinance", // payments, rent, mess, expenses, security
  manageStaff: "manageStaff",
  manageUsers: "manageUsers",
  manageSettings: "manageSettings",
  viewAudit: "viewAudit",
  viewReports: "viewReports",
  viewDues: "viewDues",
  viewReceipts: "viewReceipts",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  ADMIN: new Set(Object.values(PERMISSIONS)),
  ACCOUNTANT: new Set([
    PERMISSIONS.dashboard,
    PERMISSIONS.manageFinance,
    PERMISSIONS.viewReports,
    PERMISSIONS.viewDues,
    PERMISSIONS.viewReceipts,
  ]),
  MANAGER: new Set([
    PERMISSIONS.dashboard,
    PERMISSIONS.manageStructure,
    PERMISSIONS.manageResidents,
    PERMISSIONS.viewDues,
    PERMISSIONS.viewReports,
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  MANAGER: "Manager",
};
