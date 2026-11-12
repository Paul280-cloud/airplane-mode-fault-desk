# Airplane Mode Fault Desk

Turn a messy community fault report into a clean, private, structured report, **with the Wi-Fi switched off**.

Everything runs on your own computer with local AI models from the [QVAC SDK](https://qvac.tether.io). After a one-time model download there is no cloud, no API key and no data leaving the machine.

Built for the GAIC x Tether bootcamp capstone. It is designed for apps like FixMyKasi, where residents report broken streetlights, water leaks and potholes, and where privacy and data costs matter.

## What it does

Give it one report in English or Spanish. It then:

1. **Hides personal details first** (phone numbers, emails, ID numbers, names after phrases like "my name is"). This uses plain rules, and it happens before any model sees the text.
2. **Guesses the language** (English, Spanish or French) with a small word-count check.
3. **Translates Spanish to English** with a local Bergamot model.
4. **Finds the closest fault type** (for example "Faulty streetlight") with a local embeddings model.
5. **Decides if it is urgent**, using the fault type's flag and a list of danger words (English and Spanish).
6. **Writes a one-line summary and picks out the location** with a small local language model that is forced to answer in strict JSON. If that model fails, a simple fallback summary is used.
7. **Flags low-confidence matches** so a person checks them.

## Requirements

- **Node.js 22.21.x** (check with `node --version`). On macOS: `brew install fnm`, then `fnm install 22.21.1 && fnm use 22.21.1`.
- About **3 GB of free disk space** for the models (an estimate, check your machine).
- Internet **once**, to install and download the models.
- Tested target: macOS on Apple Silicon. Other systems supported by `@qvac/sdk` should work but are not tested here.

## Setup

```bash
git clone https://github.com/Paul280-cloud/airplane-mode-fault-desk.git
cd airplane-mode-fault-desk
npm install --fetch-timeout=600000 --fetch-retries=8 --fetch-retry-mintimeout=20000
npm run prefetch
```

`npm run prefetch` downloads the three models (translation, embeddings, language model). It can take several minutes. When it finishes it prints: `All models are ready. You can now turn Wi-Fi off.`

The longer npm timeouts are for slow networks (`ETIMEDOUT`).

### Slow or blocked network (download keeps timing out)

The embeddings model is about 670 MB. If `npm run prefetch` keeps printing "Download timed out", download the same file with your browser (it can resume) and put it in a `models/` folder:

1. Download <https://huggingface.co/ChristianAzinn/gte-large-gguf/resolve/main/gte-large_fp16.gguf?download=true>
2. Save it as `models/gte-large_fp16.gguf` inside the project folder (or set `FAULT_DESK_EMBEDDINGS_FILE` to its path).
3. Run `npm run prefetch` again. The SDK checks the file against the model's checksum.

## Run

```bash
npm run desk -- "The street light on 5th Avenue keeps flickering since Monday. Call me on 082 555 0134."
npm run desk -- "Hay un bache enorme en la avenida Central, un coche ya se dañó una rueda."
npm run live                       # loads the models once, then answer reports in seconds (best for demos)
npm run demo                       # runs the six reports in examples/reports.txt
npm run desk -- --json "..."       # JSON output for other programs
npm run desk -- --no-llm "..."     # skip the small language model (faster, simpler summary)
npm run desk -- --file my-reports.txt   # one report per line
```

The tool prints `Network: ONLINE` or `Network: OFFLINE` on every run, so you can see what mode it was in.

### What the output contains

| Field | Meaning |
|---|---|
| `language`, `translated` | Detected language and whether it was translated |
| `privacy.maskedItems` | How many personal details were hidden |
| `reportMasked`, `reportEnglish` | The report after masking, and its English version |
| `faultType` | Name, category, match score, confidence (high, medium or low) and the next two best matches |
| `urgent`, `urgentReasons` | Whether it is urgent and why |
| `summary`, `locationHint` | One-line summary and the place named in the report |
| `needsHumanReview` | `true` when the match is low confidence |
| `warnings` | Anything the tool could not do well |

## Tests

```bash
npm test
```

18 tests cover the privacy masking, language guess, urgency rules and the whole pipeline. The tests use fake models, so they run in a second and need no download. A real run with the models is covered by the dry run in [DRY-RUN.md](DRY-RUN.md).

## Using your own fault types

The list in `data/fault-types.json` is a **sample**. To use FixMyKasi's real 34 types, replace the `faultTypes` array. Each entry needs `id`, `name`, `category`, `description` and `autoUrgent`, plus `keywords` (words residents use, in English or Spanish; a match adds a small score bonus). Good descriptions (what a resident would actually say) give better matches.

## Limits (please read)

- **Input languages:** English and Spanish. The SDK version used here has no French-to-English model, so French text is not translated (the tool warns you).
- **Name masking is simple.** It only catches names after trigger phrases ("my name is", "call", "soy", ...). It is not a complete privacy tool. Phone numbers, emails and 13-digit ID numbers are caught by pattern.
- **Street addresses are not masked**, because a fault report needs the location.
- **The language model is small** (Qwen3 0.6B). Rules and the embeddings match do the important work. The summary is a convenience, so always check it.
- **Match thresholds** (`THRESHOLDS` in `src/pipeline.mjs`) are starting values. Adjust them after you see real scores on your machine.
- The first run of each model needs internet. Models are then stored locally.

## Known issues

- **`npm audit` reports 3 high-severity findings.** They all come from one advisory in `zod` (GHSA-mrhx-c7xc-m3w5, memory use when validating oversized collections), which is a dependency of `@qvac/sdk@0.22.0` (through `@qvac/inference`). The only fix npm offers is downgrading the SDK to 0.21.1, which this project does not support, so the version is left as is. The tool only processes text you type on your own machine, but please do not expose it to untrusted input on a server. Reported upstream: _link to the issue here once filed_.

## Project layout

```
desk.mjs              command-line tool
src/pipeline.mjs      the steps, in order (testable without models)
src/qvac.mjs          the only file that uses the QVAC SDK
src/redact.mjs        personal-detail masking
src/language.mjs      language guess
src/urgency.mjs       urgency rules
src/rank.mjs          keyword bonus that steadies the fault-type match
data/fault-types.json sample fault types
examples/reports.txt  six sample reports
test/                 unit and pipeline tests
```

## Contributing and upstream issues

Found a problem with `@qvac/sdk` while using this? Please report it at <https://github.com/tetherto/qvac/issues> with the SDK version (0.22.0), your OS, and the smallest command that shows the problem.

## Licence

MIT. See [LICENSE](LICENSE). The QVAC SDK is Apache-2.0 and the models have their own licences; check them before commercial use.
