#!/usr/bin/env node
// Airplane Mode Fault Desk: turns a messy community fault report into a clean,
// private, structured report. Everything runs on this computer.
//
//   npm run desk -- "Streetlight on 5th Ave flickering. Call me on 082 555 0134"
//   npm run desk -- --file examples/reports.txt      (one report per line)
//   npm run desk -- --json "..."                      (machine-readable output)
//   npm run desk -- --no-llm "..."                    (skip the small language model)
//   npm run prefetch                                  (download all models once, online)

import { readFile } from 'node:fs/promises';
import dns from 'node:dns/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { runDesk } from './src/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const flags = { json: false, noLlm: false, prefetch: false, live: false, file: null };
  const words = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--no-llm') flags.noLlm = true;
    else if (arg === '--prefetch') flags.prefetch = true;
    else if (arg === '--live') flags.live = true;
    else if (arg === '--file') flags.file = argv[(i += 1)];
    else words.push(arg);
  }
  return { flags, text: words.join(' ').trim() };
}

async function networkStatus() {
  try {
    await Promise.race([
      dns.lookup('example.com'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
    return 'ONLINE';
  } catch {
    return 'OFFLINE';
  }
}

function show(result, index, total, network) {
  const line = '-'.repeat(60);
  const head = total > 1 ? ` (report ${index + 1} of ${total})` : '';
  console.log(`\n${line}\nFAULT DESK RESULT${head}\n${line}`);
  console.log(`Network:      ${network}${network === 'OFFLINE' ? ' (no internet, all on this laptop)' : ''}`);
  console.log(`Language:     ${result.language}${result.translated ? ' (translated to English)' : ''}`);
  console.log(`Masked:       ${result.privacy.maskedItems} personal detail(s) hidden`);
  console.log(`Report:       ${result.reportMasked}`);
  if (result.translated) console.log(`In English:   ${result.reportEnglish}`);
  console.log(`Fault type:   ${result.faultType.name} (${result.faultType.category})`);
  console.log(`Confidence:   ${result.faultType.confidence} (score ${result.faultType.score})`);
  console.log(`Urgent:       ${result.urgent ? 'YES' : 'no'}${result.urgentReasons.length ? ` - ${result.urgentReasons.join('; ')}` : ''}`);
  console.log(`Summary:      ${result.summary} [${result.summarySource}]`);
  console.log(`Location:     ${result.locationHint || '(not stated)'}`);
  if (result.needsHumanReview) console.log('Review:       A person should check this one.');
  for (const warning of result.warnings) console.log(`Note:         ${warning}`);
  console.log(`Time:         ${result.elapsedMs} ms`);
}

async function main() {
  const { flags, text } = parseArgs(process.argv.slice(2));
  const data = JSON.parse(await readFile(join(here, 'data', 'fault-types.json'), 'utf8'));
  const faultTypes = data.faultTypes;

  const { createQvacAdapters } = await import('./src/qvac.mjs');
  const adapters = createQvacAdapters({ useLanguageModel: !flags.noLlm });

  try {
    const network = await networkStatus();
    if (!flags.json) console.error(`Network: ${network}. All processing happens on this computer.`);

    if (flags.prefetch) {
      console.error('Downloading models (needs internet, one time only)...');
      await adapters.prefetch(faultTypes);
      console.error('All models are ready. You can now turn Wi-Fi off.');
      return;
    }

    if (flags.live) {
      // Models load once, then every report is answered in seconds (best for demos).
      console.error('Loading models (about a minute, one time)...');
      await adapters.prefetch(faultTypes);
      console.error(`Ready. Network: ${await networkStatus()}. Type or paste a report and press Enter. Type "exit" to stop.\n`);
      const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'Report> ' });
      rl.prompt();
      for await (const line of rl) {
        const report = line.trim();
        if (report === 'exit' || report === 'quit') break;
        if (report) {
          try {
            const result = await runDesk(report, adapters, faultTypes);
            show(result, 0, 1, await networkStatus());
          } catch (error) {
            console.error(error.message ?? error);
          }
        }
        console.log('');
        rl.prompt();
      }
      rl.close();
      return;
    }

    let reports;
    if (flags.file) {
      const content = await readFile(flags.file, 'utf8');
      reports = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    } else {
      reports = [text || 'The street light on 5th Avenue keeps flickering and has been dark since Monday. Call me on 082 555 0134.'];
    }

    const results = [];
    for (const [index, report] of reports.entries()) {
      const result = await runDesk(report, adapters, faultTypes);
      results.push(result);
      if (!flags.json) show(result, index, reports.length, network);
    }
    if (flags.json) console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  } finally {
    await adapters.close();
  }
}

await main();
