tell application "Microsoft PowerPoint"
  activate
  set p to active presentation
  set showWindow to run slide show slide show settings of p
  set showView to slideshow view of showWindow
  set positions to {}
  repeat with i from 1 to 17
    set currentPosition to current show position of showView
    if currentPosition is not i then error "Unexpected slideshow position"
    set end of positions to currentPosition
    if i < 17 then go to next slide showView
  end repeat
  exit slide show showView
  return positions
end tell
