export const ISSUE_TYPES = ["deposit", "damp", "repairs"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
export const ISSUE_LABELS: Record<IssueType, string> = {
  deposit: "Deposit disputes", damp: "Damp and mould", repairs: "Unresolved repairs",
};
export interface RepairAnswers {
  problem: string;
  appeared: string;
  notified: "yes" | "no" | "unsure";
  notifiedDate: string;
  response: string;
  attempted: "yes" | "no" | "unsure";
  repairDetails: string;
  worsening: "yes" | "no" | "unsure";
  safety: string;
}
export const EMPTY_REPAIR: RepairAnswers = {
  problem: "", appeared: "", notified: "unsure", notifiedDate: "", response: "",
  attempted: "unsure", repairDetails: "", worsening: "unsure", safety: "",
};
export const issueOf = (c: { issueType?: IssueType }) => c.issueType ?? "deposit";