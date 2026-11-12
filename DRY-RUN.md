# Dry run checklist (internet ON, then OFF)

Goal: prove a stranger can run this from a fresh clone. Do it in a **new empty folder**, not your working copy. Write what you see in the "Result" column.

Machine: ____________  OS: ____________  Node (`node --version`): ____________  Date: ____________

## A. Fresh clone, internet ON

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | `cd ~/Desktop && git clone https://github.com/Paul280-cloud/airplane-mode-fault-desk.git dryrun && cd dryrun` | Folder is created | |
| 2 | `node --version` | `v22.21.x` | |
| 3 | `npm install --fetch-timeout=600000 --fetch-retries=8 --fetch-retry-mintimeout=20000` | Finishes with no errors | |
| 4 | `npm test` | 18 tests pass, 0 fail | |
| 5 | `npm run prefetch` | Ends with "All models are ready." | |
| 6 | `npm run desk -- "The street light on 5th Avenue keeps flickering since Monday. Call me on 082 555 0134."` | Fault type "Faulty streetlight"; phone shown as `[PHONE]`; `Network: ONLINE` | |
| 7 | `npm run desk -- "Hay un bache enorme en la avenida Central, un coche ya se dañó una rueda."` | Language `es` translated; fault type "Pothole" | |
| 8 | `npm run desk -- "There is a live wire hanging low and it is sparking."` | Urgent: YES | |
| 9 | `npm run demo` | All six reports print without errors | |

## B. Airplane mode, internet OFF

Turn Wi-Fi off (and unplug any network cable). Confirm the Wi-Fi icon shows off.

| # | Step | Expected | Result |
|---|---|---|---|
| 10 | Repeat step 6 | Same answer as before; `Network: OFFLINE` | |
| 11 | Repeat step 7 | Same answer as before | |
| 12 | `npm run demo` | All six reports print | |

Turn Wi-Fi back on.

## C. Record the numbers

Fill these in. They are needed to set the match thresholds and for the README.

| Report | Fault type found | Score | Confidence | Right? (yes/no) |
|---|---|---|---|---|
| Streetlight (step 6) | | | | |
| Pothole, Spanish (step 7) | | | | |
| Live wire (step 8) | | | | |
| Each of the other 3 demo reports | | | | |

If a clearly right answer shows `low` confidence, or a wrong answer shows `high`, adjust `THRESHOLDS` in `src/pipeline.mjs` and run `npm test` again.

## D. Problems found

Anything that confused you, failed, or needed a workaround (these must go into the README):

-

## E. Before publishing

- [ ] `git status` is clean and `node_modules/` is not committed
- [ ] No personal phone numbers, emails or keys in any file (`git grep -nE "[0-9]{10}|@"`)
- [ ] LICENSE file is present (MIT)
- [ ] README "Limits" section is still true
- [ ] Repo is **Public**, with a description and topics (`local-ai`, `offline`, `qvac`, `privacy`)
- [ ] Demo video link is added to the README
- [ ] If you hit an SDK problem, open an upstream issue at https://github.com/tetherto/qvac/issues and link it in the README
