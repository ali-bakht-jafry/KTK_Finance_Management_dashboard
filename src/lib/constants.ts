import type {
  ExpenseCategory,
  PaymentMethod,
  PaymentType,
  Role,
  SecurityTransactionType,
  StaffPaymentType,
} from "@prisma/client";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  OTHER: "Other",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  RENT: "Rent",
  MESS: "Mess",
  OTHER: "Other",
  REFUND: "Refund",
};

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "GAS", label: "Gas" },
  { value: "WATER", label: "Water" },
  { value: "INTERNET", label: "Internet" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "STAFF_SALARY", label: "Staff Salary" },
  { value: "MESS", label: "Mess" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "OTHER", label: "Other" },
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ExpenseCategory, string>;

export const SECURITY_TYPE_LABELS: Record<SecurityTransactionType, string> = {
  DEPOSIT: "Deposit",
  REFUND: "Refund",
  DEDUCTION: "Deduction",
};

export const STAFF_PAYMENT_TYPE_LABELS: Record<StaffPaymentType, string> = {
  SALARY: "Salary",
  ADVANCE: "Advance",
  DEDUCTION: "Deduction",
};

export const STAFF_ROLES = [
  "Mess Worker",
  "Cleaner",
  "Security Guard",
  "Manager",
  "Cook",
  "Other",
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  MANAGER: "Manager",
};

export const HOSTEL_SETTING_KEYS = {
  hostelName: "hostel.name",
  hostelAddress: "hostel.address",
  hostelPhone: "hostel.phone",
  defaultRent: "hostel.defaultRent",
  defaultMess: "hostel.defaultMess",
  receiptFooter: "receipt.footer",
} as const;

export type SettingKey = (typeof HOSTEL_SETTING_KEYS)[keyof typeof HOSTEL_SETTING_KEYS];
