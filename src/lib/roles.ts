export type AppRole = "admin" | "management" | "hr" | "payroll" | "employee";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "System Administrator",
  management: "Management",
  hr: "HR",
  payroll: "Payroll Officer",
  employee: "Employee",
};

export const ALL_ROLES: AppRole[] = ["admin", "management", "hr", "payroll", "employee"];

const hasAny = (roles: AppRole[], allowed: AppRole[]) => roles.some((r) => allowed.includes(r));

/** UI hints only — the database enforces the same rules with row-level security. */
export const can = {
  approve: (r: AppRole[]) => hasAny(r, ["admin", "management", "hr"]),
  manageStaff: (r: AppRole[]) => hasAny(r, ["admin", "hr"]),
  manageRoster: (r: AppRole[]) => hasAny(r, ["admin", "management", "hr"]),
  manageProjects: (r: AppRole[]) => hasAny(r, ["admin", "management"]),
  payroll: (r: AppRole[]) => hasAny(r, ["admin", "payroll"]),
  reports: (r: AppRole[]) => hasAny(r, ["admin", "management", "hr", "payroll"]),
  postAnnouncements: (r: AppRole[]) => hasAny(r, ["admin", "management", "hr"]),
  adminPortal: (r: AppRole[]) => hasAny(r, ["admin", "management", "hr", "payroll"]),
  systemAdmin: (r: AppRole[]) => r.includes("admin"),
};

/** Where a user lands after signing in. */
export function homeFor(roles: AppRole[]): "/admin" | "/dashboard" {
  return roles.includes("admin") ? "/admin" : "/dashboard";
}
