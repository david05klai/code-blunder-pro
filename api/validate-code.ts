import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db } from "./firebaseAdmin.js";

const VALID_CODES = [
  "FOUNDER2026",
];

function getBearerToken(req: VercelRequest) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const decoded = await auth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = (req.body || {}) as { code: string };
    const code = (body.code || "").trim().toUpperCase();

    if (!VALID_CODES.includes(code)) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    // Verificar si el código ya fue usado
    const codeDoc = await db().collection("used_premium_codes").doc(code).get();
    if (codeDoc.exists) {
      return res.status(400).json({ error: "Code already used" });
    }

    // Activar premium
    const userRef = db().collection("users").doc(uid);
    await userRef.set(
      {
        isPremium: true,
        premiumActivatedAt: new Date().toISOString(),
        premiumCode: code,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Marcar código como usado
    await db().collection("used_premium_codes").doc(code).set({
      uid,
      usedAt: new Date().toISOString(),
    });

    console.log(`✅ Premium code ${code} activated for user ${uid}`);
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("validate-code error:", e);
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
