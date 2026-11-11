import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { env } from "@/infrastructure/config/env";

/** One named app per Firebase project so env switches do not keep a stale default app. */
export function firebaseApp(): FirebaseApp {
  const name = `beroya-${env.firebase.projectId}`;
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;
  try {
    return getApp(name);
  } catch {
    return initializeApp(env.firebase, name);
  }
}

let analyticsStarted = false;

/** Analytics only runs in the browser, in production, and where cookies/IndexedDB are available. */
export async function startAnalytics() {
  if (analyticsStarted || !env.isProduction || !env.firebase.measurementId) return;
  analyticsStarted = true;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(firebaseApp());
}
