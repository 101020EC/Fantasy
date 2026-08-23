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
function loadServiceAccount(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) return null;

  try {
    const json = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!json.project_id || !json.client_email || !json.private_key) return null;

    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    };
  } catch {
    return null;
  }
}

const serviceAccount = loadServiceAccount();

export const isAdminConfigured = serviceAccount !== null;

export const ADMIN_NOT_CONFIGURED =
  'ยังไม่ได้ตั้งค่า Firebase ฝั่งเซิร์ฟเวอร์ (ต้องกำหนด FIREBASE_SERVICE_ACCOUNT)';

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
