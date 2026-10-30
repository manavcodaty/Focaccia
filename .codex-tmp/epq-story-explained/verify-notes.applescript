tell application "Microsoft PowerPoint"
 set p to presentation "Focaccia - Explained Story.pptx"
 set verifiedNotes to 0
 repeat with i from 1 to 17
  set t to content of text range of text frame of shape 2 of notes page of slide i of p
  if t does not contain "[Sources]" then error "Missing source block"
  if t does not contain "[Spoken]" then error "Missing narration"
  if t does not contain "[Evidence]" then error "Missing evidence status"
  if t does not contain "[Stage direction]" then error "Missing stage direction"
  set verifiedNotes to verifiedNotes + 1
 end repeat
 return verifiedNotes
end tell
