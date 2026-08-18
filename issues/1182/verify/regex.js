const r = /^~[^/]*(?:\/|$)/u;
for (const p of ["~", "~/x", "~user/x.md", "~notes.md", "~$report.docx", "~foo/bar.md", "~notes.md:3"]) {
  console.log(p, r.test(p));
}
