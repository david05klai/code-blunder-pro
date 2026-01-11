import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_lib/firebaseAdmin";
import { mpAccessToken, webhookSecret, type PlanKey } from "./_lib/mp";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

// ✅ CORREGIDO: Ahora extiende desde la fecha de vencimiento existente
async function computeUntil(uid: string, plan: PlanKey): Promise<Date> {
  const userDoc = await db().collection("users").doc(uid).get();
  const userData = userDoc.data();

  let baseDate = new Date();

  // Si ya tiene premium/api activo, extender desde esa fecha
  if (plan.startsWith("PREMIUM") && userData?.premiumUntil) {
    const existingDate = new Date(userData.premiumUntil);
    if (existingDate > baseDate) {
      baseDate = existingDate;
    }
  } else if (!plan.startsWith("PREMIUM") && userData?.apiUntil) {
    const existingDate = new Date(userData.apiUntil);
    if (existingDate > baseDate) {
      baseDate = existingDate;
    }
  }

  if (plan === "PREMIUM_MONTHLY" || plan === "API_MONTHLY") {
    return addMonths(baseDate, 1);
  }
  if (plan === "PREMIUM_ANNUAL" || plan === "API_ANNUAL") {
    return addYears(baseDate, 1);
  }

  return addMonths(baseDate, 1);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = (req.query.secret as string) || "";
    if (!secret || secret !== webhookSecret()) {
      console.warn("Unauthorized webhook attempt");
      return res.status(401).json({ error: "Unauthorized webhook" });
    }

    const body = (req.body || {}) as any;
    const idFromBody = body?.data?.id || body?.id;

    if (!idFromBody) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const preapprovalId = String(idFromBody);

    // ✅ Log del webhook recibido
    await db().collection("mp_webhook_logs").add({
      preapprovalId,
      body,
      receivedAt: new Date().toISOString(),
    });

    const r = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
      headers: { Authorization: `Bearer ${mpAccessToken()}` },
    });

    const pre = await r.json();
    if (!r.ok) {
      console.error("Failed to fetch preapproval from MP:", pre);
      return res.status(200).json({ ok: true, mpFetchFailed: true, details: pre });
    }

    const status = pre?.status;
    const externalRef: string | undefined = pre?.external_reference;

    const mapDoc = await db().collection("mp_preapprovals").doc(preapprovalId).get();
    const map = mapDoc.exists ? (mapDoc.data() as any) : null;

    let uid: string | undefined = map?.uid;
    let plan: PlanKey | undefined = map?.plan;

    if ((!uid || !plan) && externalRef && externalRef.includes("|")) {
      const [u, p] = externalRef.split("|");
      uid = uid || u;
      plan = plan || (p as PlanKey);
    }

    if (!uid || !plan) {
      await db().collection("mp_webhook_orphans").doc(preapprovalId).set(
        {
          status,
          pre,
          receivedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, orphan: true });
    }

    // ✅ ACTIVAR O REVOCAR SEGÚN STATUS
    if (status === "authorized") {
      const until = await computeUntil(uid, plan);
      const userRef = db().collection("users").doc(uid);

      const updates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (plan.startsWith("PREMIUM")) {
        updates.isPremium = true;
        updates.premiumUntil = until.toISOString();
      } else {
        updates.hasApiPlan = true;
        updates.apiUntil = until.toISOString();
      }

      await userRef.set(updates, { merge: true });

      await db().collection("mp_preapprovals").doc(preapprovalId).set(
        {
          status,
          lastWebhookAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`✅ Activated ${plan} for user ${uid} until ${until.toISOString()}`);
      return res.status(200).json({ ok: true, activated: true });
    }

    // ✅ REVOCAR SI CANCELADO/PAUSADO
    if (status === "cancelled" || status === "paused") {
      const userRef = db().collection("users").doc(uid);
      const updates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (plan.startsWith("PREMIUM")) {
        updates.isPremium = false;
        updates.premiumUntil = null;
      } else {
        updates.hasApiPlan = false;
        updates.apiUntil = null;
      }

      await userRef.set(updates, { merge: true });

      console.log(`❌ Revoked ${plan} for user ${uid} due to status: ${status}`);
      return res.status(200).json({ ok: true, revoked: true, status });
    }

    await db().collection("mp_preapprovals").doc(preapprovalId).set(
      {
        status,
        lastWebhookAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, activated: false, status });
  } catch (e: any) {
    console.error("webhook error:", e);
    return res.status(200).json({ ok: false, error: e?.message || "error" });
  }
}