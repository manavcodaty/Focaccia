tell application "Microsoft PowerPoint"
 set p to presentation "Private Pass - Diagram Edition.pptx"
 set verifiedNotes to 0
 repeat with i from 1 to 19
  set t to content of text range of text frame of shape 2 of notes page of slide i of p
  if t does not contain "Spoken notes" then error "Missing script"
  if t does not contain "Key points" then error "Missing prompts"
  if t contains "PRESENTER REMINDER" then error "Unwanted reminder"
  if t contains "[Sources]" then error "Unwanted source block"
  if t contains "[Evidence]" then error "Unwanted metadata"
  if t contains "[Stage direction]" then error "Unwanted metadata"
  set verifiedNotes to verifiedNotes + 1
 end repeat
 return verifiedNotes
end tell
