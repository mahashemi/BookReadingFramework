Chapter 2 jihad-truce decision tree: install pack
=================================================
Run all of this from the root of your BookReadingFramework checkout.

1.  git checkout main && git pull
2.  git checkout -b add-jihad-truce-decision-tree
3.  unzip -o /path/to/jihad-truce-tree-pack.zip          (Windows: extract here, replace if asked)
4.  python apply_jihad_truce_tree.py --dry-run            (shows what will change; writes nothing)
5.  python apply_jihad_truce_tree.py                      (applies; safe to re-run, it stops without writing if an anchor moved)
6.  npm test                                              (expect all to pass)
7.  rm apply_jihad_truce_tree.py integrity-test.js.txt jihad-truce-tree-site.svg      (helpers: do not commit them)
8.  git add assets/app.js scripts/build_jihad_truce_tree.py tests \
            "Library/Book 02 - Survey of the Lives of the Infallible Imams/teaching_materials"
9.  git commit -m "Replace Chapter 2 gate ladder with a branching jihad-truce decision tree"
10. git push -u origin HEAD        then open the PR; CI compiles the deck and runs Playwright.

If step 5 says STOPPED: someone changed text the script anchors on. Nothing was written. Tell me which anchor
it names and I will update the script.
Do not commit main.pdf (your README says CI builds it).
Later changes: edit figures/jihad_truce_tree.json, run  python scripts/build_jihad_truce_tree.py
(needs Pillow, cairosvg, Liberation fonts), commit the regenerated files.
