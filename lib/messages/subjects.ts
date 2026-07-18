export const MESSAGE_SUBJECTS = [
  "general_question",
  "coi_replacement",
  "booking_change",
  "profile_correction",
  "eligibility_inquiry",
] as const;

export type MessageSubject = (typeof MESSAGE_SUBJECTS)[number];

export const MESSAGE_SUBJECT_LABELS: Record<MessageSubject, string> = {
  general_question: "General question",
  coi_replacement: "COI replacement",
  booking_change: "Booking change",
  profile_correction: "Profile correction",
  eligibility_inquiry: "Eligibility inquiry",
};

export function isMessageSubject(value: string): value is MessageSubject {
  return (MESSAGE_SUBJECTS as readonly string[]).includes(value);
}
