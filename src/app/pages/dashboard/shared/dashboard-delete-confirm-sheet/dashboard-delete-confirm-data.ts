export type DashboardDeleteConfirmData = {
  /** Small label above the title (defaults to "Confirm deletion"). */
  eyebrow?: string;
  title: string;
  description: string;
  keepLabel?: string;
  deleteLabel?: string;
  deletingLabel?: string;
};
