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
      "No. Raw images and embeddings are never uploaded. Enrollment creates an event-scoped template locally, encrypts it to the assigned gate, and sends only the encrypted result for pass issuance.",
  },
  {
    question: "Can a gate admit people without internet?",
    answer:
      "Yes. A prepared gate verifies the signed pass, liveness, replay state, revocation cache, and local face match without a live connection. Check-ins queue locally and synchronize when connectivity returns.",
  },
  {
    question: "What happens when a ticket is revoked?",
    answer:
      "Connected gates receive the updated revocation state on refresh. A gate that is already disconnected cannot learn about a new remote revocation until its next successful refresh.",
  },
  {
    question: "How do attendees get a ticket?",
    answer:
      "Attendees browse listed events, sign in, and claim one real free ticket per event. The same account is then used for private enrollment on iOS.",
  },
  {
    question: "Who can run events?",
    answer:
      "Organizer access is granted through a server-side allowlist. Authentication alone does not provide organizer privileges or access to another organizer's events.",
  },
] as const;
