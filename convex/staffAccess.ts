export const STAFF_ROLES = ["ticket_staff", "manager", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

type StaffRecordLike = {
  email: string;
  role?: StaffRole;
};

type CurrentUserLike = {
  email?: string | null;
} | null;

export const normalizeStaffEmail = (email: string) => email.trim().toLowerCase();

export const getEffectiveStaffRole = (staffRecord?: { role?: StaffRole } | null): StaffRole => {
  return staffRecord?.role ?? "admin";
};

export const getRoleLabel = (role: StaffRole) => {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    default:
      return "Ticket Staff";
  }
};

export const buildStaffAccessSummary = (
  currentUser: CurrentUserLike,
  staffMembers: StaffRecordLike[]
) => {
  const normalizedEmail = currentUser?.email ? normalizeStaffEmail(currentUser.email) : null;
  const matchingStaffRecord = normalizedEmail
    ? staffMembers.find((member) => member.email === normalizedEmail) ?? null
    : null;
  const role = matchingStaffRecord ? getEffectiveStaffRole(matchingStaffRecord) : null;
  const isStaff = Boolean(matchingStaffRecord);
  const isConfigured = staffMembers.length > 0;
  const canBootstrap = !isConfigured;
  const canManageStaff = role === "manager" || role === "admin";
  const canViewAttendance = role === "manager" || role === "admin";
  const canManageTheatres = role === "admin";
  const canAssignManager = role === "admin";
  const canAssignAdmin = role === "admin";

  return {
    email: currentUser?.email ?? null,
    role,
    roleLabel: role ? getRoleLabel(role) : null,
    isStaff,
    isConfigured,
    canBootstrap,
    canScanTickets: isStaff,
    canLookupTickets: isStaff,
    canViewRecentCheckIns: isStaff,
    canViewAttendance,
    canManageStaff,
    canManageTheatres,
    canAssignManager,
    canAssignAdmin,
    totalStaffMembers: staffMembers.length,
  };
};