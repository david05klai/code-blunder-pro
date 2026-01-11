import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db } from "./_lib/firebaseAdmin.js";
import { appBaseUrl, mpAccessToken, planIdFor, webhookSecret, type PlanKey } from "./_lib/mp";

type Body = {
  plan: PlanKey;
};

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

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const decoded = await auth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email;
    if (!email) return res.status(400).json({ error: "User has no email in Firebase token" });

    const body = (req.body || {}) as Body;
    const plan = body.plan;
    if (!plan) return res.status(400).json({ error: "Missing plan" });

    const preapproval_plan_id = planIdFor(plan);

    const backUrl = `${appBaseUrl()}/billing/return?plan=${encodeURIComponent(plan)}`;
    const notification_url = `${appBaseUrl()}/api/webhooks?secret=${encodeURIComponent(webhookSecret())}`;

    const payload = {
      preapproval_plan_id,
      payer_email: email,
      reason: plan.startsWith("PREMIUM") ? "Premium subscription" : "API subscription",
      back_url: backUrl,
      external_reference: `${uid}|${plan}`,
      notification_url,
    };

    const r = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("MercadoPago API error:", data);
      return res.status(400).json({ error: "MercadoPago error", details: data });
    }

    const preapprovalId: string | undefined = data?.id;
    if (preapprovalId) {
      await db()
        .collection("mp_preapprovals")
        .doc(preapprovalId)
        .set(
          {
            uid,
            plan,
            email,
            status: data?.status ?? "unknown",
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
    }

    console.log(`✅ Created subscription for user ${uid}, plan ${plan}`);
    return res.status(200).json({
      preapprovalId,
      init_point: data?.init_point,
      sandbox_init_point: data?.sandbox_init_point,
      status: data?.status,
    });
  } catch (e: any) {
    console.error("create-subscription error:", e);
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
