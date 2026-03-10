"use client";

export type ComplianceRecord = {
  id: string;
  asset_manager?: string | null;
  investor_lead?: string | null;
  status?: "pending" | "in_progress" | "completed" | "failed" | null;
  notes?: string | null;
  cycle?: number | null;
  created_at?: number | null;
  _investor_lead?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

export type ComplianceLeg = {
  id: string;
  compliance_record?: string | null;
  type?:
    | "kyc"
    | "aml"
    | "onboarding"
    | "document_request"
    | "periodic_review"
    | null;
  status?:
    | "pending"
    | "in_progress"
    | "completed"
    | "failed"
    | "expired"
    | null;
  title?: string | null;
  notes?: string | null;
  due_date?: number | null;
  completed_at?: number | null;
  created_at?: number | null;
};

export const TYPE_LABELS: Record<string, string> = {
  kyc: "KYC",
  aml: "AML",
  onboarding: "Onboarding",
  document_request: "Document Request",
  periodic_review: "Periodic Review",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  expired: "Expired",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  expired:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};
