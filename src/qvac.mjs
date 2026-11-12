// The only file that talks to the QVAC SDK. Three local models:
//   BERGAMOT_ES_EN     Spanish -> English translation
//   GTE_LARGE_FP16     embeddings (finds the closest fault type)
//   QWEN3_600M_INST_Q4 small language model (summary + location, strict JSON)
// Models are loaded the first time they are needed and kept for the whole run.
// After the first download everything works with the internet off.

import { existsSync } from 'node:fs';
import { rerank } from './rank.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BERGAMOT_ES_EN,
  GTE_LARGE_FP16,
  QWEN3_600M_INST_Q4,
  close,
  completion,
  loadModel,
  ragCloseWorkspace,
  ragIngest,
  ragSearch,
  translate,
  unloadModel,
} from '@qvac/sdk';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Optional manual copy of the embeddings model (see README, "Slow or blocked network").
const EMBEDDINGS_FILE = process.env.FAULT_DESK_EMBEDDINGS_FILE ?? join(projectRoot, 'models', 'gte-large_fp16.gguf');
const EMBEDDINGS_URL = 'https://huggingface.co/ChristianAzinn/gte-large-gguf/resolve/main/gte-large_fp16.gguf';

function progress(label) {
  return (p) => {
    if (!process.stderr.isTTY) return;
    process.stderr.write(`\r${label}: downloading ${Math.round(p.percentage ?? 0)}%   `);
    if ((p.percentage ?? 0) >= 100) process.stderr.write('\n');
  };
}

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    locationHint: { type: 'string' },
  },
  required: ['summary', 'locationHint'],
  additionalProperties: false,
};

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// Big downloads can time out on slow networks. Try a few times before giving up;
// files already downloaded are kept, so each retry continues from where it stopped.
async function loadWithRetry(options, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await loadModel(options);
    } catch (error) {
      lastError = error;
      const text = String(error?.message ?? error);
      const retryable = /timed out|timeout|REQUEST_TIMEOUT|ETIMEDOUT|ECONNRESET/i.test(text);
      if (!retryable || attempt === attempts) break;
      console.error(`\nDownload timed out (try ${attempt} of ${attempts}). Trying again...`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
  throw lastError;
}

export function createQvacAdapters({ useLanguageModel = true } = {}) {
  const loaded = { translator: null, embedder: null, writer: null };
  const workspace = `fault-desk-${process.pid}-${Date.now()}`;
  let workspaceReady = false;
  let documentToType = new Map();

  async function getTranslator() {
    loaded.translator ??= await loadWithRetry({
      modelSrc: BERGAMOT_ES_EN,
      modelConfig: { engine: 'Bergamot', from: 'es', to: 'en' },
      onProgress: progress('Spanish to English model'),
    });
    return loaded.translator;
  }

  async function getEmbedder() {
    loaded.embedder ??= await loadWithRetry({
      modelSrc: GTE_LARGE_FP16,
      // Used when the QVAC registry cannot be reached from this network.
      // A file you downloaded yourself is used first; otherwise Hugging Face
      // (same file, checked against its checksum by the SDK).
      fallbackSrc: existsSync(EMBEDDINGS_FILE) ? EMBEDDINGS_FILE : EMBEDDINGS_URL,
      onProgress: progress('Embeddings model'),
    });
    return loaded.embedder;
  }

  async function getWriter() {
    loaded.writer ??= await loadWithRetry({
      modelSrc: QWEN3_600M_INST_Q4,
      onProgress: progress('Language model'),
    });
    return loaded.writer;
  }

  async function prepareFaultTypes(faultTypes) {
    if (workspaceReady) return;
    const modelId = await getEmbedder();
    const documents = faultTypes.map((t) => `${t.name}. ${t.description}`);
    documentToType = new Map(documents.map((doc, i) => [doc, faultTypes[i]]));
    await ragIngest({ modelId, workspace, documents, chunk: false });
    workspaceReady = true;
  }

  function typeForContent(content, faultTypes) {
    return (
      documentToType.get(content) ??
      faultTypes.find((t) => content.startsWith(t.name)) ??
      null
    );
  }

  return {
    async translateToEnglish(text) {
      const modelId = await getTranslator();
      const result = translate({ modelId, text, modelType: 'nmtcpp-translation', stream: false });
      return (await result.text).trim();
    },

    async matchFaultType(englishText, faultTypes) {
      await prepareFaultTypes(faultTypes);
      const modelId = await getEmbedder();
      // Ask for every fault type (the list is small), then re-rank with keyword bonuses.
      const results = await ragSearch({ modelId, workspace, query: englishText, topK: faultTypes.length });
      const candidates = results
        .map((item) => ({ type: typeForContent(item.content, faultTypes), score: item.score }))
        .filter((item) => item.type);
      if (candidates.length === 0) throw new Error('No fault type matched.');
      const ranked = rerank(candidates, englishText);
      return { type: ranked[0].type, score: ranked[0].score, alternatives: ranked.slice(1, 3) };
    },

    summarise: useLanguageModel
      ? async (englishText) => {
          const modelId = await getWriter();
          const run = completion({
            modelId,
            stream: true,
            history: [
              {
                role: 'system',
                content:
                  'You help a municipality read community fault reports. Reply ONLY with JSON. ' +
                  '"summary" is one short sentence (under 20 words) describing the fault. ' +
                  '"locationHint" is the street, place or landmark named in the report, or an empty string. ' +
                  'Do not invent details. /no_think',
              },
              { role: 'user', content: englishText },
            ],
            responseFormat: {
              type: 'json_schema',
              json_schema: { name: 'fault_report', schema: SUMMARY_SCHEMA },
            },
          });
          for await (const _event of run.events) {
            // drain the stream; the final text is read below
          }
          const final = await run.final;
          const parsed = JSON.parse(stripThinking(final.contentText));
          return {
            summary: String(parsed.summary ?? '').trim(),
            locationHint: String(parsed.locationHint ?? '').trim(),
          };
        }
      : null,

    // Loads every model once, so the first download happens while you are online.
    async prefetch(faultTypes) {
      await getTranslator();
      await prepareFaultTypes(faultTypes);
      if (useLanguageModel) await getWriter();
    },

    async close() {
      try {
        if (workspaceReady) await ragCloseWorkspace({ workspace, deleteOnClose: true });
      } catch {
        // nothing to clean up
      }
      for (const modelId of Object.values(loaded)) {
        if (modelId) {
          try {
            await unloadModel({ modelId, clearStorage: false });
          } catch {
            // already unloaded
          }
        }
      }
      await close();
    },
  };
}
