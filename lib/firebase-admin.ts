import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Server-side Firebase. The Admin SDK authenticates with a service account and
 * bypasses Firestore security rules, which lets those rules deny every client
 * request outright — the browser never touches Firestore directly.
 *
 * Credentials come from FIREBASE_SERVICE_ACCOUNT: the service account JSON,
 * base64-encoded so it survives being pasted into a single env var.
 */
type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

/** Returns how many times the value repeats itself, or null if it does not. */
function detectRepeat(value: string): number | null {
  for (let parts = 2; parts <= 10; parts++) {
    if (value.length % parts !== 0) continue;
    const unit = value.slice(0, value.length / parts);
    if (unit.repeat(parts) === value) return parts;
  }
  return null;
}

/**
 * Why the credential is unusable, so a misconfigured deploy says which of
 * "never arrived" and "arrived damaged" it is — the difference between an
 * environment-variable scope problem and a truncated paste.
 */
export type AdminConfigStatus =
  | { ok: true; projectId: string; clientEmail: string }
  | { ok: false; reason: 'missing' | 'not_base64_json' | 'incomplete'; detail: string };

function loadServiceAccount(): { account: ServiceAccount | null; status: AdminConfigStatus } {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!encoded) {
    return {
      account: null,
      status: {
        ok: false,
        reason: 'missing',
        detail:
          'FIREBASE_SERVICE_ACCOUNT never reached the server — check it is set for the environment this deploy runs in, then redeploy',
      },
    };
  }

  // Whitespace survives a copy-paste into a web form more often than not.
  const value = encoded.trim();

  // Accept either the base64 form or the service account JSON pasted directly —
  // both are things people reasonably reach for, and guessing wrong costs a
  // redeploy to find out.
  let json: any;
  try {
    json = JSON.parse(
      value.startsWith('{') ? value : Buffer.from(value.replace(/\s/g, ''), 'base64').toString('utf8')
    );
  } catch {
    // An exact multiple of a workable length means the same value got
    // concatenated with itself — a repeated paste into a field that hides what
    // it already holds, or a copy command that matched a duplicated env line.
    const repeated = detectRepeat(value);
    return {
      account: null,
      status: {
        ok: false,
        reason: 'not_base64_json',
        detail: repeated
          ? `FIREBASE_SERVICE_ACCOUNT is ${value.length} characters, which is the same value repeated ${repeated} times — check the source has no duplicate line, then clear the field completely before pasting once`
          : `FIREBASE_SERVICE_ACCOUNT is set (${value.length} characters) but does not read as JSON — the value looks truncated or damaged in transit (it is normally around 3,100 characters)`,
      },
    };
  }

  const missing = ['project_id', 'client_email', 'private_key'].filter((k) => !json[k]);
  if (missing.length > 0) {
    return {
      account: null,
      status: {
        ok: false,
        reason: 'incomplete',
        detail: `the service account JSON decoded but is missing: ${missing.join(', ')}`,
      },
    };
  }

  return {
    account: {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    },
    status: { ok: true, projectId: json.project_id, clientEmail: json.client_email },
  };
}

const { account: serviceAccount, status: adminStatus } = loadServiceAccount();

export const isAdminConfigured = serviceAccount !== null;

/** Safe to expose: reports shape and project, never the key itself. */
export function getAdminConfigStatus(): AdminConfigStatus {
  return adminStatus;
}

export const ADMIN_NOT_CONFIGURED =
  'Firebase is not configured on the server (set FIREBASE_SERVICE_ACCOUNT)';

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (!serviceAccount) throw new Error(ADMIN_NOT_CONFIGURED);
  if (cachedApp) return cachedApp;

  cachedApp = getApps().length > 0 ? getApp() : initializeApp({ credential: cert(serviceAccount) });
  return cachedApp;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
