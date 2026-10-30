## 1. A copied ticket

Imagine sending a screenshot of your ticket to someone else. They now have exactly the same code. The code can show that the ticket is valid, but it cannot show who is holding it. That was my starting problem. I wondered whether checking the person as well as the ticket could help. But using a face creates another question: what happens to that very personal information afterwards? That question became the reason for my project.

[Stage direction]
Ask the audience to imagine a shared ticket. Do not invite them to share real passes.

[Evidence]
Problem framing, not a measured fraud rate.

[Sources]
https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93 — original problem
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 1

## 2. Why I chose Focaccia

I chose this because I enjoy coding and wanted to build something useful, rather than only write about an idea. A password can be changed after a leak. Your face is much harder to replace. My question became how effectively Focaccia could provide offline event entry while minimising central storage of reusable face data. In everyday language: could the gate check the person while the organiser kept less facial information? I needed a manageable way to investigate that.

[Stage direction]
The wording on the slide is a plain-English explanation. The full working title is in the sources.

[Evidence]
Candidate motivation and latest working question; final title approval still needs recording.

[Sources]
https://app.notion.com/p/2b0d326c13fb809fa29fed44ca56eff0 — personal interests
https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93 — final title refinement, 21 August 2026

## 3. A manageable scope

My first plan combined privacy, face matching, offline entry, speed and user testing. Each part brought more work. A whole commercial event platform was too big, but an isolated face scan would not answer the question either. I settled on one controlled event and one prepared gate phone. That gave me a realistic boundary. It also meant leaving payments and multiple gates outside the main investigation. My supervisor helped me see why that boundary mattered.

[Stage direction]
The levels represent scope, not measured performance or project size.

[Evidence]
Recorded scope decision. No public rollout or multi-gate claim.

[Sources]
https://app.notion.com/p/335d326c13fb800ea6bfc9216ed9487f — modifications
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 2

## 4. Three questions from my supervisor

My supervisor pushed me on three questions. Could I actually build it? What made it different from systems that already existed? And how would I prove that it worked? Those questions belong together. Something original is not useful if I cannot finish it. A finished app is not enough if I cannot evaluate it. This helped me make privacy the centre of the investigation and connect my technical choices to evidence. Research then challenged one of my own assumptions.

[Stage direction]
Move around the triangle once, then explain the connection between its corners.

[Evidence]
Supervisor feedback, paraphrased from the logbook.

[Sources]
https://app.notion.com/p/289d326c13fb80c69689d1cedce8fc19 — supervisor comments
https://app.notion.com/p/335d326c13fb800ea6bfc9216ed9487f — supervisor advice

## 5. Research changed the design

I initially thought turning a face into numbers might solve the privacy problem. Research showed why that was too simple. Mai and colleagues showed that face images could be reconstructed from some numerical face records. Other research discussed making protected records replaceable and less reusable between systems. So I kept face processing on the phones and used event-specific protection. I could explain why those decisions reduced exposure, but I could not honestly call the result anonymous or impossible to reverse.

[Stage direction]
Say “face numbers” before introducing “record”. Avoid explaining embeddings or cryptography.

[Evidence]
Research influence. Protection is a design choice, not proof of impossible reconstruction.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 3
https://arxiv.org/abs/1703.00832 — Mai et al., reconstruction research
https://biometrics.cse.msu.edu/Publications/SecureBiometrics/JainNandakumarNagar_TemplateSecuritySurvey_EURASIP08.pdf

## 6. Research is not my test result

I also learned to ask what each source could actually tell me. Research papers helped explain possibilities and risks. Official documentation helped me connect existing tools. But a published result came from someone else's model, people and conditions. It was not a result for my phone. I used sources to choose an approach, then needed my own tests to judge the artefact. That distinction stopped me borrowing impressive accuracy or speed claims that I had not measured.

[Stage direction]
Explain the gap between the two sides. It is an evidence gap, not a claim that the papers are unreliable.

[Evidence]
Critical source evaluation, no imported accuracy or speed percentages.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — sections 3, 6 and bibliography
https://app.notion.com/p/2b0d326c13fb809fa29fed44ca56eff0 — intended resources

## 7. A plan with dependencies

I divided the work into research, event setup, the face step, gate checking and evaluation. The order mattered because a gate cannot check a pass that the earlier stages cannot create. The logbook was where I recorded decisions and changes to the plan. When a connection failed, I had to go back, fix it and check again. Looking back, I was better at keeping the build moving than protecting the time for evaluation. A later change made that harder.

[Stage direction]
The return arrow represents iteration. This is not a dated Gantt chart.

[Evidence]
Planned sequence and reflection; no invented completed milestone dates.

[Sources]
https://app.notion.com/p/335d326c13fb800ea6bfc9216ed9487f — next steps and deadlines
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 2

## 8. Feedback revealed the missing beginning

My supervisor asked a very practical question: how does someone get their ticket before registering their face? I had focused on the face and gate steps and missed the beginning. I added a website where an attendee could claim a free ticket. Payment processing would have added work without helping the main question, so I left that out. The change made the journey more believable, but also added more connections to build and test. Here is the basic idea behind the finished system.

[Stage direction]
Trace the short original row, then the longer revised row.

[Evidence]
Scope addition recorded in the Mid Project Review; implementation documented later.

[Sources]
https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93 — supervisor advice and modifications
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — revised plan
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 2
docs/EPQ_ARTIFACT_REPORT.md — User Journey

## 9. The one architecture explanation

Think of the face record as being inside a locked envelope. The attendee's phone locks it. The event service checks the ticket and seals the pass, without needing to read that protected record. The prepared gate phone can open it and compare it with a fresh face scan. This is only an analogy: the phones still handle sensitive information, and ordinary accounts and tickets remain on the server. Keeping the jobs separate helped me decide where information belonged. Connecting those jobs exposed practical failures.

[Stage direction]
Encryption is the lock; signing is the seal. The gate decrypts locally. Do not say encrypted matching or that nothing is stored.

[Evidence]
Implemented design. Analogy does not mean zero personal data or zero device risk.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — sections 4 and 5
docs/PRIVACY_BY_DESIGN.md
docs/EPQ_ARTIFACT_REPORT.md — Privacy-Preserving Biometric Flow

## 10. One failure, one decision

One problem was what happened when a reply disappeared. The service could create a ticket, but the phone might never receive the confirmation. If the person tapped again, the system needed to recognise a retry instead of creating another ticket. I used a remembered request identifier so the same request returned the same result. That taught me to think beyond the happy path. I needed to ask what remained after an interruption, not only what happened when everything worked.

[Stage direction]
The upper row is a failure risk. The lower row shows the implemented retry behaviour.

[Evidence]
Implementation problem and response recorded in the report; no new live test claimed.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 4
docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md — integration results

## 11. Offline is a trade-off

Offline entry was another trade-off. If the gate is prepared first, it can make an entry decision without Wi-Fi. But it cannot receive a new cancellation from somewhere else while disconnected. That update has to wait until reconnection. I could not have both complete independence from the network and instant new information. This is why I limited the project to one gate and explained what offline actually means. It applies to entry, while ticket claiming and preparation still need a connection.

[Stage direction]
Point to both consequences. Do not imply instant cancellation or synchronised use across disconnected gates.

[Evidence]
Implemented design with an explicit limitation; offline covers the gate decision only.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — sections 5 and 7
docs/EPQ_ARTIFACT_REPORT.md — Offline Security

## 12. A short demonstration

For the demonstration, watch three things. First, the prepared gate loses its connection. Then the pass is scanned once and should be accepted. Finally, the same pass is scanned again and should be rejected because this gate remembers using it. Afterwards, I can reconnect and show the organiser's record updating. This demonstrates a specific journey. It does not measure how accurately the face check works for lots of different people. That difference matters when I judge my result.

[Stage direction]
Reserve 2 minutes. Prepare a consenting attendee, an unused pass and a refreshed gate beforehand. Disable network only after preparation. Accept once, retry the identical pass at the same gate, then reconnect and synchronise. If unavailable, use only a recording you actually made; label it recorded. Otherwise describe expected states without pretending a demonstration happened.

[Evidence]
Demonstration instructions and expected outcomes. No live demo testing during this redesign.

[Sources]
https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93 — presentation plan
docs/EPQ_OPERATIONS_MANUAL.md
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — candidate-attested run

## 13. How strong is the evidence?

My evaluation has an important weakness. I report completing the whole journey successfully, but I did not retain a detailed receipt of every device, build and step. Earlier checks have stronger records, including software and browser results, but their physical acceptance stage remained incomplete. I should not merge those into one stronger claim. A successful journey is useful evidence of connection between parts. It is not a repeated accuracy study, and the missing record limits how confidently someone else can verify my observation.

[Stage direction]
Candidate-attested means reported by you, not independently evidenced. The June acceptance record is dated and does not validate every later change.

[Evidence]
Retained dated records versus candidate-attested experience; no accuracy dataset.

[Sources]
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — evidence classification
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 6
docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md — ESCALATED - NOT ACCEPTED

## 14. The result against my aims

Against my aims, the connected event journey was reported working. The design also supports keeping reusable face information away from central storage. But I did not retain enough repeated attempts to judge accuracy or dependable speed. The camera step does not establish protection against photos or videos, and I cannot claim the system is trusted without user feedback. So the answer is mixed: there is a useful prototype and a reasoned privacy design, but several performance claims remain open. There is also a human question.

[Stage direction]
Separate the achieved build from claims still needing measurement. Do not call a face-detection step proven liveness.

[Evidence]
Balanced evaluation. Claimed operation is candidate-attested; numerical performance is unestablished.

[Sources]
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — final evaluation
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — sections 6 and 7
docs/EVALUATION_PLAN.md

## 15. Choice and trust

Even if a system works, people may not want to use their face to enter an event. They should understand what happens to their information and have a genuine alternative. My supervisor asked for feedback from potential users, but I did not complete that wider study. I cannot assume that my privacy priorities match theirs. Ordinary tickets may be simpler for some events. Before real use, I would need to ask people, test the alternative route and justify the extra face step.

[Stage direction]
Both routes are requirements for a responsible deployment, not a claim that the final prototype includes a complete staffed alternative.

[Evidence]
Ethical requirement and future work. No completed preference study or delivered fallback workflow claimed.

[Sources]
https://app.notion.com/p/2b0d326c13fb809fa29fed44ca56eff0 — consent and opt-out
https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93 — user feedback request
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 7

## 16. My management lesson

My biggest management mistake was letting development take time away from evaluation. Adding ticket claiming improved the product, but every new connection created more debugging and recovery work. Next time I would stop adding features earlier and protect a separate testing period. I would record each attempt as it happened, including failures, and compare the system with ordinary tickets. That would give me a stronger answer than simply adding more features. It also changes how I understand successful project work.

[Stage direction]
The plan is a proposed improvement. No actual time proportions or completed dates are shown.

[Evidence]
Candidate reflection grounded in the report, not a fabricated schedule.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 8
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — revised plan and evidence gaps
https://app.notion.com/p/335d326c13fb800ea6bfc9216ed9487f — planned evaluation period

## 17. My conclusion and learning

Focaccia gives a promising, limited answer. It shows a way to connect event entry with local face checking and less central face storage, within a prepared prototype. It does not establish readiness for public use. I learned how to connect different parts, trace failures and explain why I made decisions. More importantly, I learned that building something and proving its claims are separate jobs. My next step would be stronger trials and user feedback. That is the conclusion I can defend, and I am happy to take questions.

[Stage direction]
Keep the conclusion visible during questions. Ask the supervisor to record the real questions and your actual answers in the Presentation Record.

[Evidence]
Conditional conclusion; personal learning and future trials.

[Sources]
https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea — section 8
https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7 — retained evidence limits
https://filestore.aqa.org.uk/subjects/AQA-W-7993-SP-19.PDF — sections 2.3 and 2.5

[Q&A preparation — not part of the spoken script]
Why use a face at all? A face check aims to bind entry to the ticket holder, but I have not proved it is necessary or preferred. A named or ordinary ticket may be simpler.
Is it completely private? No. Phones still handle face information; the server keeps account and ticket data. The design limits central reusable face records, not every privacy risk.
Would a photo fool it? I have no retained attack study proving resistance. The present camera check is not validated anti-spoofing.
Why only one gate? Disconnected gates cannot instantly share use or cancellation information. One prepared gate kept the project manageable.
What exactly worked? I report the complete journey worked under controlled conditions. Retained dated records support narrower software/browser checks; the full final run lacks a detailed receipt.
What would you change? Freeze features earlier, recruit consenting participants, separate genuine and wrong-person attempts, test photos/videos, record whole-entry time and compare ordinary tickets.
Was the research original? I did not invent face verification or encryption. I investigated an existing set of ideas in a specific event-entry prototype and evaluated the limits.
What help did you use? Explain the tools, libraries, source material and AI assistance you actually used. This presentation is an AI-assisted draft based on your records; review the language and acknowledge assistance under your centre's rules. Do not claim unaided authorship of these diagrams or this script.
