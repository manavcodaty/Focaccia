tell application "Microsoft PowerPoint"
 activate
 open POSIX file "/Users/manavcodaty/repos/Focaccia/output/epq-story-redesign/Focaccia - EPQ Story.pptx"
 set p to active presentation
 if name of p is not "Focaccia - EPQ Story.pptx" then error "Wrong presentation"
 if (count of slides of p) is not 17 then error "Wrong slide count"
 save p in (POSIX file "/Users/manavcodaty/repos/Focaccia/.codex-tmp/epq-story-redesign/powerpoint.pdf") as save as PDF
 return {name of p, count of slides of p}
end tell
