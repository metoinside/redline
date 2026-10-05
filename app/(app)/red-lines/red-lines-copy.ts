import type { ClauseType, NumericLimitKind } from "@/lib/engine/types";

// What the buyer reads on the red lines page. Every line here went through
// the humanizer skill. Each red line itself is put in words by
// describeRedLine (lib/engine/red-lines.ts), so the page, the analysis view
// and the model all name it the same way.

export const RED_LINES_PAGE = {
  title: "Red lines",
  lede: "The terms you won’t accept. Redline checks every contract you analyse against them, and any clause that crosses one goes under Negotiate before signing.",
  howChecked:
    "Redline checks a limit against the figure the sentence itself states. A clause that states no figure can’t cross a limit, but “not allowed” still catches it.",
  rerun: "Changing a red line doesn’t change past analyses. To use the new ones on a contract, open it and analyse it again.",
  listLabel: "Your red lines",
  emptyTitle: "No red lines yet",
  emptyBody: "Add your first one below, such as no notice window longer than 60 days.",
  addHeading: "Add a red line",
  loadFailed: { title: "We couldn’t load your red lines.", body: "Reload the page to try again." },
  accountsOffBody: "This copy of Redline has no account service connected, so you can’t sign in or keep red lines here.",
} as const;

export const RED_LINE_FORM = {
  clauseType: "Clause type",
  limit: "Limit",
  notAllowed: "Not allowed at all",
  upTo: "Allowed up to a limit",
  add: "Add red line",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  saving: "Saving…",
  deleting: "Deleting…",
} as const;

/** The figure field's label, per clause type. */
export const LIMIT_FIELD: Record<ClauseType, string> = {
  auto_renewal: "Longest renewal term, in months",
  notice_window: "Longest notice window, in days",
  early_termination_fee: "Highest fee, in dollars",
  rollover: "Longest rollover term, in months",
  multi_year_term: "Longest lock-in, in months",
};

export const VALUE_ERROR: Record<NumericLimitKind, string> = {
  max_days: "Enter a whole number of days, from 1 to 3,650.",
  max_months: "Enter a whole number of months, from 1 to 240.",
  max_dollars: "Enter a whole-dollar amount, from $1 to $100,000,000.",
};

export const RED_LINE_ERRORS = {
  clauseType: "Choose one of the five clause types.",
  limitKind: "Choose whether this clause type is not allowed at all, or allowed up to a limit.",
  accountsOff: "Accounts aren’t set up on this server, so red lines can’t be saved here.",
  signedOut: "You’re signed out. Sign in again to change your red lines.",
  gone: "That red line isn’t there anymore. Reload the page to see your current list.",
  saveFailed: "We couldn’t save the red line. Try again.",
  deleteFailed: "We couldn’t delete the red line. Try again.",
} as const;
