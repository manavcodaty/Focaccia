export const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Privacy", href: "#privacy" },
  { label: "For organizers", href: "#organizers" },
  { label: "FAQ", href: "#faq" },
] as const;

export const faqs = [
  {
    question: "Is biometric data stored centrally?",
    answer:
      "No. Only the encrypted event template is uploaded.",
  },
  {
    question: "Can a gate admit people without internet?",
    answer:
      "Yes. Prepared gates verify offline and sync check-ins when reconnected.",
  },
  {
    question: "What happens when a ticket is revoked?",
    answer:
      "Revocations take effect after the gate refreshes, including after offline use.",
  },
  {
    question: "How do attendees get a ticket?",
    answer:
      "Claim a free ticket, then use the same account in the iPhone enrollment app.",
  },
  {
    question: "Who can run events?",
    answer:
      "Approved organizers only.",
  },
] as const;
