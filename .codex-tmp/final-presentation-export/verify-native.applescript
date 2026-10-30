tell application "Microsoft PowerPoint"
  activate
  open POSIX file "/Users/manavcodaty/repos/Focaccia/output/final-presentation/FINAL PRESENTATION.pptx"
  set p to active presentation
  set slideCount to count of slides of p
  if slideCount is not 17 then error "Unexpected native PowerPoint slide count"
  save p in (POSIX file "/Users/manavcodaty/repos/Focaccia/.codex-tmp/final-presentation-export/powerpoint-final.pdf") as save as PDF
  return {name of p, slideCount}
end tell
