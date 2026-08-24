import { getAdminDb, isAdminConfigured } from './firebase-admin';

const SETTINGS_DOC = { collection: 'settings', doc: 'openai' } as const;

/**
 * Language-model configuration, mirroring lib/telegram.ts: stored in Firestore
 * so it can be changed without a redeploy, with environment variables as the
 * fallback for a deploy not yet configured through the UI.
 *
 * The key is only ever read on the server. It is never returned by an API
 * route, never sent to the browser, and only ever shown masked.
 *
 * What the model is FOR, stated once here because it governs every prompt in
 * lib/analysis.ts: it explains numbers that already exist. It never produces
 * them. A projection from a language model cannot be reproduced, validated, or
 * improved on evidence, which makes it worthless for the one thing this app is
 * trying to do — beat a benchmark measurably.
 */

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMSettings {
  apiKey: string;
  provider: LLMProvider;
  model: string;
  configured: boolean;
  source: 'firestore' | 'env' | 'none';
}

/**
 * Defaults per provider. Kept together so switching provider is a settings
 * change rather than a code change — the audit flagged that this project
 * already runs on Claude tooling and either provider serves this use identically.
 */
export const DEFAULT_MODEL: Record<LLMProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5',
};

export function maskKey(key: string): string | null {
  return key ? `…${key.slice(-4)}` : null;
}

export async function getLLMConfig(): Promise<LLMSettings> {
  if (isAdminConfigured) {
    try {
      const snap = await getAdminDb()
        .collection(SETTINGS_DOC.collection)
        .doc(SETTINGS_DOC.doc)
        .get();
      const d = snap.data();
      if (d?.apiKey) {
        const provider: LLMProvider = d.provider === 'anthropic' ? 'anthropic' : 'openai';
        return {
          apiKey: String(d.apiKey),
          provider,
          model: String(d.model || DEFAULT_MODEL[provider]),
          configured: true,
          source: 'firestore',
        };
      }
    } catch (err) {
      console.warn('Could not read LLM settings from Firestore:', err);
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  // OpenAI first: it is what the plan specified. Anthropic is picked up
  // automatically if only that key is present, so neither needs a code change.
  const provider: LLMProvider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : 'openai';
  const apiKey = provider === 'openai' ? openaiKey : anthropicKey;

  return {
    apiKey,
    provider,
    model: process.env.LLM_MODEL || DEFAULT_MODEL[provider],
    configured: Boolean(apiKey),
    source: apiKey ? 'env' : 'none',
  };
}

export async function saveLLMConfig(settings: {
  apiKey: string;
  provider: LLMProvider;
  model: string;
}) {
  await getAdminDb()
    .collection(SETTINGS_DOC.collection)
    .doc(SETTINGS_DOC.doc)
    .set({ ...settings, updatedAt: new Date().toISOString() });
}

export async function clearLLMConfig() {
  await getAdminDb().collection(SETTINGS_DOC.collection).doc(SETTINGS_DOC.doc).delete();
}

export interface CompletionResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

/**
 * One chat completion. Reports the provider's own verdict rather than assuming
 * success, the same way sendTelegramMessage does.
 *
 * Deliberately minimal: no SDK dependency, no streaming, no tool use. This
 * makes one call per user action and the response is prose.
 */
export async function complete(
  cfg: LLMSettings,
  system: string,
  user: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {}
): Promise<CompletionResult> {
  if (!cfg.configured) return { ok: false, error: 'No API key configured' };

  const maxTokens = opts.maxTokens ?? 700;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);

  try {
    const req: { url: string; headers: Record<string, string>; body: unknown } =
      cfg.provider === 'anthropic'
        ? {
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': cfg.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: {
              model: cfg.model,
              max_tokens: maxTokens,
              system,
              messages: [{ role: 'user', content: user }],
            },
          }
        : {
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.apiKey}`,
            },
            body: {
              model: cfg.model,
              max_completion_tokens: maxTokens,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
            },
          };

    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
      cache: 'no-store',
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      // The provider's message is far more useful than the status code —
      // an expired key and an unknown model both return 4xx.
      return { ok: false, error: data?.error?.message || `Provider returned ${res.status}` };
    }

    const text =
      cfg.provider === 'anthropic'
        ? (data.content ?? []).map((b: any) => b.text ?? '').join('').trim()
        : String(data.choices?.[0]?.message?.content ?? '').trim();

    if (!text) return { ok: false, error: 'The model returned an empty response' };
    return { ok: true, text, model: cfg.model };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, error: 'The model took too long to respond' };
    return { ok: false, error: err?.message || 'Could not reach the model provider' };
  } finally {
    clearTimeout(timer);
  }
}
