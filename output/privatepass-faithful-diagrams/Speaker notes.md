## 1. Introducing Private Pass

Spoken notes

Hi, my project is called Private Pass. I wanted to find out whether an event could check that a ticket belongs to the right person, without storing everybody's face in one central database. I also wanted the entrance check to work without internet. I built a working prototype, and I'll show you how it works, how I made my decisions, and what my testing did and didn't prove.

Key points

1. Ticket must belong to the right person.
2. No central face database; gate works offline.
3. Show the build, the tests and the limits.

## 2. The problem

Spoken notes

Imagine buying a concert ticket as a QR code. You could send a screenshot to a friend, and the code might still scan. So the code alone doesn't prove who the person is. One solution is to keep a database of people's faces, but that creates another problem: face information is much harder to replace if it is stolen. I wanted the benefits of a face check without putting everyone's reusable face information in one place.

Key points

1. A QR code can be shared.
2. A central face database creates a different risk.
3. My idea tries to avoid both problems.

## 3. My goals

Spoken notes

I decided on four main goals. First, check the person's face against the face linked to their ticket, rather than searching through a list of people. Second, let a prepared gate make that decision offline. Third, avoid keeping reusable face information on the main server. And fourth, keep evidence of what actually worked. That last point became really important, because making something work once isn't the same as proving it will work reliably.

Key points

1. Match one person to one ticket.
2. Work offline and limit central face storage.
3. Keep evidence, not just a working screen.

## 4. How the project changed

Spoken notes

My original plan focused mainly on the face-checking part. My supervisor asked an important question: how does someone get a ticket in the first place? So I added the public ticket website. I then had to connect that with the organiser system, the phone app and the gate app. I worked on the basic design first, joined the parts together in June, and improved the apps in July. The finished project was more complete, but it also left me less time for proper testing.

Key points

1. Supervisor asked how tickets are obtained.
2. I added ticketing and connected four parts.
3. More features meant less time for testing.

## 5. What research taught me

Spoken notes

I used research to help make three choices. First, the FaceNet paper showed how a computer can turn a face into numbers that can be compared. That supported my idea of checking one person against one ticket. Second, I found research showing that those numbers can still reveal private information. So I changed them for each event, rather than using one reusable version everywhere. But I cannot claim this makes them impossible to recover. Third, I learned about digital signatures, which are like a stamp that helps the gate check that a ticket is genuine. These papers helped with the design; they are not test results for my app.

Key points

1. Research explained how to compare faces.
2. Face data still has privacy risks.
3. Signatures help check a ticket is genuine; papers are not my results.

## 6. Four parts of Private Pass

Spoken notes

Private Pass has four connected parts. The organiser creates an event. The attendee then uses a website to claim a ticket. Next, the enrolment app uses the phone camera to register the attendee's face and prepare their pass. Finally, at the event, the gate app checks the pass and the person's face. The important detail is that the final check can work offline, but the earlier steps still need the main system to be online.

Key points

1. Organiser creates the event.
2. Attendee claims a ticket and registers their face.
3. Prepared gate checks locally without internet.

## 7. Where face data goes

Spoken notes

This is the main privacy choice in my project. The attendee's phone handles the face image and turns it into a set of numbers. Those numbers are changed for that event and protected inside the pass. The main server still keeps things like accounts, events and ticket records, because the system needs them. But it isn't meant to keep a central collection of reusable faces. The gate checks the protected face information on its own device. This reduces one privacy risk; it doesn't remove every risk.

Key points

1. Face is processed on the attendee phone.
2. Server stores ticket records, not reusable faces.
3. Gate checks locally; some risk remains.

## 8. How the face check works

Spoken notes

When someone reaches the gate, the system isn't trying to find them in a crowd. It already has their ticket, so it only needs to ask: does this person match the face linked to this pass? The phone compares two sets of numbers made from the face. There is a limit for deciding how close they need to be. If that limit is too strict, the right person might be rejected. If it's too loose, the wrong person might get in. I didn't run enough tests to give a reliable accuracy figure.

Key points

1. Check one person against one ticket.
2. The matching limit affects false rejections and acceptance.
3. No reliable measured accuracy figure.

## 9. Why the pass has two protections

Spoken notes

I used two different ways to protect a pass. A digital signature works a bit like a stamp. It lets the gate check that the pass came from the right system and hasn't been changed. Encryption is more like putting the face information in a locked box, so only the prepared gate can read it. Those checks help protect the ticket, but they don't prove who is holding it. That's why the gate still needs to check the person's face.

Key points

1. Signature: genuine ticket, not changed.
2. Encryption: keep face information private.
3. Still need to match the person.

## 10. The offline gate decision

Spoken notes

Before the event, the gate downloads the information it needs. After that, it can work without internet. It checks that the ticket is for the right event, that it hasn't been changed, that it hasn't already been used, and that the face matches. If everything passes, entry is allowed and the ticket is marked as used. There's one important limit: if a ticket is cancelled while the gate is offline, the gate won't know until it reconnects.

Key points

1. Prepare the gate before going offline.
2. Check ticket, use status and face.
3. New cancellations cannot arrive while offline.

## 11. Problems I fixed while building

Spoken notes

Some of the hardest problems had nothing to do with artificial intelligence. One was the camera. If the two apps cropped someone's face differently, the comparison became less reliable. I changed them to use the same cropping rules. Another problem was ticket claims. If the server received a request but the phone missed the reply, pressing again could create a second request. I made retries use the same request number. Finally, I made the gate save that a ticket had been used before showing the success screen. Otherwise, an app crash could leave a ticket able to be reused. These changes taught me to think about what happens when things go wrong halfway through.

Key points

1. Use matching camera-crop rules.
2. Make a retry safe if a reply gets lost.
3. Save ticket use before showing success.

## 12. Detailed test evidence

Spoken notes

This slide is the most important evidence from my testing. The saved records from 15 June show checks of ticket claims, who is allowed to claim them, ticket limits, safe retries, signed passes, stopping a reused ticket, and sending entry records back later. I also checked local networking and launched both phone apps on a real iPhone. During development, I found and fixed problems with face cropping, repeat ticket requests and saving used tickets. But these records are mainly software tests. They do not show a complete physical test of every step on the final version. I later saw the whole journey work, but I did not keep a detailed record from that run. I also didn't collect enough attempts to measure face accuracy or test whether photos or screens could fool it. So I can show which parts worked, but I can't claim the system is ready for a real event.

Key points

1. 15 June records: ticket, retry, replay, sync and networking checks.
2. Bugs found and fixed during development.
3. Full later run observed, not fully documented.
4. No measured face accuracy, fake-face or real-event results.

## 13. The short evidence summary

Spoken notes

So the short version is this: I have saved results for important software checks. I also saw the full system work later, but didn't keep enough detail to prove that whole run in the same way. And I didn't properly measure face accuracy, fake-face attacks or how fast it would be with lots of people. That difference between what I saw and what I can prove matters to my final answer.

Key points

1. Some software tests are recorded.
2. Whole journey was later observed, but not fully documented.
3. Face performance and real-world use are still unknown.

## 14. Live demonstration

Spoken notes

I'll now show the four steps. First, the gate has already downloaded the event details, and I'll disconnect it. Next, I'll scan a valid ticket and see whether the gate accepts it. Then I'll scan the same ticket again. This time, it should be rejected because it was already used. Finally, I'll reconnect the gate so its saved entry record can be sent back. I'll explain what actually happens, rather than just what I expected to happen.

Key points

1. Prepare and disconnect.
2. First scan: check actual result.
3. Second scan: check reuse is blocked.
4. Reconnect and check saved record.

## 15. Did I meet my goals?

Spoken notes

I went back to my four goals to judge the project fairly. The software checks support the offline gate idea, although the full phone journey wasn't saved as a detailed final test. The saved tests also support stopping a ticket from being used twice. The system was designed so the server doesn't keep reusable face information, but I didn't carry out an independent security review. The biggest gap is face performance. I can't give reliable figures for accuracy or protection against fake faces. So I built a useful prototype, but not something I'd call ready for public use.

Key points

1. Offline checks partly evidenced.
2. Replay protection supported by tests.
3. Privacy supported by design; face performance not proved.

## 16. What could go wrong?

Spoken notes

Before using this at a real event, I would need to deal with three things. First, an offline gate may still accept a ticket that was cancelled after it lost internet. Second, simply seeing a face in the camera doesn't mean it's a real person. A photo or screen might be a problem, and I didn't complete proper tests for that. Third, I would need to know whether people can use it easily, including anyone who doesn't want a face check. I'd test all three before calling it safe for a real crowd.

Key points

1. Offline cancellations can be out of date.
2. Face presence is not proof against photos.
3. Need usability and non-face alternatives.

## 17. What I learned

Spoken notes

The biggest lesson for me was that building something and proving it works are two different jobs. I got carried away adding features because I wanted the whole process to feel real. But that gave me less time for testing. If I did this again, I would stop adding features sooner and save a clear test record each time I finished something. I'd also test face matching on new examples, instead of just checking it on the examples I used while building it.

Key points

1. Building is different from proving.
2. Stop adding features earlier.
3. Save records and test on new examples.

## 18. Final answer

Spoken notes

So, did Private Pass answer my question? My answer is yes, but only for a small, prepared prototype. I built the four parts of the ticket journey, and I have evidence for important checks like ticket rules and stopping reuse. I also saw the whole process work together. But I didn't keep a complete record of that later run, and I haven't proved how well the face check would work at a crowded event. For me, the project showed that the idea is possible, and also how much testing is needed before it can be trusted.

Key points

1. Yes, for a prepared prototype.
2. Key software checks worked; whole journey later observed.
3. More testing needed before a real event.

## 19. Questions

Spoken notes

That's the end of my presentation. I'm happy to answer questions about the design, the testing, or what I'd change if I built it again. The main thing I want to be clear about is that I have a working prototype, but I won't claim that I've tested things I haven't.

Key points

1. Invite questions about design and decisions.
2. Be clear about saved evidence versus observation.
3. Be honest about what was not tested.
