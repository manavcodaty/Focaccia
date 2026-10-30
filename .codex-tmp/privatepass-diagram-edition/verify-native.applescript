tell application "Microsoft PowerPoint"
 activate
 open POSIX file "/Users/manavcodaty/repos/Focaccia/output/privatepass-diagram-edition/Private Pass - Diagram Edition.pptx"
 set p to active presentation
 if name of p is not "Private Pass - Diagram Edition.pptx" then error "Wrong presentation"
 if (count of slides of p) is not 19 then error "Wrong slide count"
 save p in (POSIX file "/Users/manavcodaty/repos/Focaccia/.codex-tmp/privatepass-diagram-edition/powerpoint.pdf") as save as PDF
 return {name of p, count of slides of p}
end tell
