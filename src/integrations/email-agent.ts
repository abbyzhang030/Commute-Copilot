import { getEmailById, getImportantEmails, getRecentEmails, getUrgentEmails, type DemoEmail } from "../content-repository.js";

export interface EmailBriefing { emails: DemoEmail[]; spokenSummary: string; scope: "urgent" | "important" | "full" }

function deadlinePhrase(email: DemoEmail): string {
  if (!email.responseDeadline) return "";
  const deadline = new Date(email.responseDeadline);
  const today = deadline.toDateString() === new Date().toDateString();
  return today ? ` The deadline is ${deadline.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.` : "";
}

function spokenItem(email: DemoEmail): string {
  const response = email.requiresResponse ? ` This needs a response. ${email.suggestedAction}` : ` ${email.suggestedAction}`;
  return `${email.senderName}: ${email.shortSummary}${response}${deadlinePhrase(email)}`;
}

export async function getInboxBriefing(userId: string, availableMinutes = 5): Promise<EmailBriefing> {
  if (availableMinutes <= 3) {
    const emails = (await getUrgentEmails(userId)).slice(0, 3);
    return { emails, scope: "urgent", spokenSummary: emails.length ? `You have ${emails.length} urgent ${emails.length === 1 ? "email" : "emails"}. ${emails.map(spokenItem).join(" ")}` : "You have no urgent emails right now." };
  }
  if (availableMinutes <= 7) {
    const emails = (await getImportantEmails(userId)).slice(0, 5);
    return { emails, scope: "important", spokenSummary: emails.length ? `Here are the messages that matter most. ${emails.map(spokenItem).join(" ")}` : "You have no important messages that need attention." };
  }
  const emails = await getRecentEmails(userId, 10);
  const priority = emails.filter((email) => (email.rankScore ?? 0) >= 35);
  const lowerCount = emails.length - priority.length;
  const tail = lowerCount > 0 ? ` You also have ${lowerCount} lower-priority ${lowerCount === 1 ? "message" : "messages"}, including newsletters, receipts, or personal mail.` : "";
  return { emails, scope: "full", spokenSummary: `Here is your inbox recap. ${priority.map(spokenItem).join(" ")}${tail}` };
}

export async function readEmail(userId: string, emailId: string) {
  const email = await getEmailById(userId, emailId);
  return email ? { email, spokenContent: `${email.senderName} wrote: ${email.body} Suggested action: ${email.suggestedAction}` } : null;
}
