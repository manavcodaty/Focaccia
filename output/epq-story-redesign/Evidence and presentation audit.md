# Focaccia EPQ presentation: evidence and assessment audit

Prepared 28 October 2026. This is a review of the presentation, not an examiner's mark or a claim that missing project evidence has been supplied.

## Assessment basis

[AQA 7993 specification](https://filestore.aqa.org.uk/subjects/AQA-W-7993-SP-19.PDF), sections 2.3 and 2.5, assessed against the current logbook and repository records. The whole project is assessed holistically. AO1 carries 10 marks, AO2 10, AO3 20 and AO4 10. AO4 includes evaluation and communication; its 10 marks are not a separate slide-design allowance. AQA expects a non-specialist presentation covering the product and process, with questions and answers.

| Objective | Where the new presentation provides evidence |
| --- | --- |
| AO1 Manage | Slides 1–4 establish purpose and scope. Slide 7 explains dependencies and review. Slides 8 and 16 evaluate scope change and time management. |
| AO2 Use resources | Slides 5–6 connect research to decisions and evaluate what published results can establish. Slide 15 addresses consent, alternatives and absent user evidence. |
| AO3 Develop and realise | Slides 8–12 explain a scope addition, the design, a concrete failure and recovery decision, an offline compromise and a demonstration plan. |
| AO4 Review | Slides 13–17 distinguish evidence quality, compare outcomes with aims, explain weaknesses, evaluate personal performance and reach a conditional conclusion. Q&A prompts support preparation. |

The slides support communication of the candidate's work. They cannot substitute for the Production Log, retained test results, candidate understanding, actual presentation or actual answers to questions.

## Sources and changes since the previous deck

- [Initial ideas](https://app.notion.com/p/289d326c13fb80c69689d1cedce8fc19), [Candidate Proposal](https://app.notion.com/p/2b0d326c13fb809fa29fed44ca56eff0), [Planning Review](https://app.notion.com/p/335d326c13fb800ea6bfc9216ed9487f), [Mid Project Review](https://app.notion.com/p/34ad326c13fb80538192eafaa151ad93) and [Product Review](https://app.notion.com/p/34ad326c13fb80df8615eae09d66a7f7) were fetched for this redesign.
- The Product Review is **no longer blank**. It records a candidate-attested successful complete journey, and explicitly says a detailed final receipt was not retained. Its final supervisor comments and modifications sections remain empty. No Notion page was edited.
- The Mid Project Review contains a final working-title refinement dated 21 August 2026. It removes the broad word “secure” and qualifies the central-storage aim. Its wording still says centre/supervisor approval should be recorded; this presentation does not assert that approval occurred.
- [Report v8](https://app.notion.com/p/3d1d326c13fb800d9fc8e21671d9d3ea) supplies the explanation of integration failures, source evaluation, management weaknesses and candidate reflection. The script adapts these existing reflections rather than inventing personal experiences.
- `docs/PHASE_9_FINAL_DUAL_MODE_ACCEPTANCE.md` remains dated 15 June 2026 and explicitly **ESCALATED - NOT ACCEPTED**. Earlier software/browser evidence cannot be relabelled as final physical acceptance or fresh verification of later changes.

Full working title recorded in the logbook:

> How effectively can Focaccia provide offline event entry through on-device facial verification while minimising central storage of reusable biometric data?

## Claim-to-source check

Each PowerPoint slide has its own `[Sources]`, `[Evidence]` and `[Stage direction]` block. Sources below refer to the named pages above and repository paths in the project root.

| Slide | Visible message | Evidence anchor and boundary |
| --- | --- | --- |
| 1 | The same ticket code can be held by different people. | Mid Review, original problem; v8 §1. No ticket-fraud frequency or claim that QR tickets have no other controls. |
| 2 | Coding interest led to a question about checking people while keeping less face data. | Proposal, personal interests; Mid Review, 21 August title. “Less” does not mean zero data or anonymity. |
| 3 | One controlled event and one prepared gate are a manageable scope. | Planning Review, modifications; v8 §2. Payments, multiple gates and public rollout are outside this investigation. |
| 4 | Feasibility, differentiation and evidence must support each other. | Initial Ideas and Planning Review, supervisor comments. Questions paraphrase recorded advice, not invented quotations. |
| 5 | Face numbers can remain sensitive, influencing local and event-specific protection. | v8 §3; [Mai et al.](https://arxiv.org/abs/1703.00832); [Jain et al.](https://biometrics.cse.msu.edu/Publications/SecureBiometrics/JainNandakumarNagar_TemplateSecuritySurvey_EURASIP08.pdf). No mathematical proof of non-reconstruction or unlinkability is claimed. |
| 6 | A study's results are not measurements of this prototype. | v8 §§3 and 6; Proposal, resources. Papers inform decisions; their accuracy and speed figures are not transferred to Focaccia. |
| 7 | Planning followed dependencies and required iteration. | Planning Review, next steps; v8 §2. Schematic order, not invented actual completion dates or a fabricated Gantt chart. |
| 8 | Feedback added ticket claiming to the face-entry journey. | Mid Review, modifications; Product Review, revised plan; v8 §2; `docs/EPQ_ARTIFACT_REPORT.md`, User Journey. Free ticket claiming, not completed paid checkout. |
| 9 | A protected record travels through distinct phone/service/gate jobs. | v8 §§4–5; `docs/PRIVACY_BY_DESIGN.md`; artefact report. The gate decrypts and compares locally. The seal is a signature, the lock is encryption. Ordinary personal information is still stored centrally. |
| 10 | A repeated request after a lost reply should return the same ticket. | v8 §4, interrupted requests; Phase 9 integration results. The upper row illustrates a failure risk, not a fabricated observed duplicate-ticket count. |
| 11 | Offline entry works with prepared information, but new cancellations wait. | v8 §§5 and 7; artefact report, Offline Security. “Offline” only describes the gate decision. |
| 12 | A prepared single-gate demo should accept once and reject reuse. | Mid Review, demo plan; operations manual; Product Review. Labelled **expected demonstration**. This redesign does not claim a newly executed physical demo. |
| 13 | Dated retained checks differ from a self-reported complete run. | Product Review, evidence classification; v8 §6; Phase 9 status. A run is not a participant dataset, and the final receipt is missing. |
| 14 | Build and privacy-design evidence is stronger than performance/adoption evidence. | Product Review; v8 §§6–7; `docs/EVALUATION_PLAN.md`. Accuracy, reliable timing, photo/video resistance and user trust remain unestablished. |
| 15 | Meaningful choice is needed before real use. | Proposal, opt-out; Mid Review, user feedback; v8 §7. No completed school user study, validated alternative workflow or legal-compliance claim. |
| 16 | Feature expansion displaced evaluation time. | v8 §8; Product Review; Planning Review. Reflection and proposed improvement, not measured time allocation. |
| 17 | A promising prototype needs stronger trials before public deployment. | v8 §8; Product Review. Conditional conclusion and learning grounded in the candidate's records. |

## Readability and design checks

- One principal point per frame, with familiar labels rather than protocol or component names.
- Only slide 9 explains architecture. Slides 10–12 concern a development problem, a trade-off and the demo.
- Sparse off-white canvas, handwriting, charcoal strokes, red text for selected warnings. No coloured shape fills, footer, visible slide numbers or decorative title system.
- Scope ladder, triangle, comparison, research consequences, timeline, before/after journey, envelope, choice fork and evidence mapping provide varied structures.
- Minimum measured text/shape padding is 24 px. Outer content margins are checked at approximately 80 px or greater. Arrow/text contact is checked with a 5 px guard. The deliberate numbered-step containment, envelope flap and not-equal symbol are intentional relationships.
- Text metrics were rebuilt with the handwriting font loaded. The saved master was reopened in the browser editor; all 17 frames were inspected individually. This corrects the original draft's editable-canvas truncation.
- The “can a reader get the point without notes?” check was an editorial review with narration hidden. It is **not** a completed audience-comprehension study.

## Delivery and rehearsal

The spoken script is 1,366 words, excluding sources, stage directions and Q&A preparation. At 125–140 words per minute, that is approximately 9.8–10.9 minutes of speech. Adding the planned two-minute demo and roughly 30–60 seconds for slide changes and pauses gives an estimated 12.3–13.9 minutes before Q&A. This is an estimate, not a timed human rehearsal. Practise aloud and adjust to the centre's slot.

The candidate should check the script against what they personally did, keep wording they understand, acknowledge AI assistance and obtain any required final-title approval. Record the actual presentation questions and answers afterwards. Do not pre-fill a Presentation Record with questions that have not been asked.

No new physical device sequence, participant testing, spoof trial or biometric benchmark was run for this presentation redesign.

Verification completed: 17 editable 1600 × 900 Excalidraw frames, 17 valid SVGs without `foreignObject`, 17 embedded PowerPoint SVGs and 17 native notes sections with spoken text, stage directions, evidence labels and sources. Every frame was inspected in the browser editor and every PowerPoint page was rendered and inspected at 1600 × 900. PowerPoint read back all 17 notes sections and advanced through positions 1–17 in slideshow mode. The saved source passed the padding/intersection preflight. This establishes the document workflow, not audience comprehension or live-demo readiness.
