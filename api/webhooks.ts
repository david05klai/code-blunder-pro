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

function computeUntil(now: Date, plan: PlanKey) {
  if (plan === "PREMIUM_MONTHLY") return addMonths(now, 1);
  if (plan === "PREMIUM_ANNUAL") return addYears(now, 1);
  if (plan === "API_MONTHLY") return addMonths(now, 1);
  if (plan === "API_ANNUAL") return addYears(now, 1);
  return addMonths(now, 1);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1) Filtro básico por secret
    const secret = (req.query.secret as string) || "";
    if (!secret || secret !== webhookSecret()) {
      return res.status(401).json({ error: "Unauthorized webhook" });
    }

    // MP manda varios formatos. Nosotros buscamos data.id
    const body = (req.body || {}) as any;
    const idFromBody = body?.data?.id || body?.id;

    if (!idFromBody) {
      // Respondemos 200 para que MP no reintente infinito por payload raro
      return res.status(200).json({ ok: true, ignored: true });
    }

    const preapprovalId = String(idFromBody);

    // 2) Consultar a MP para confirmar estado real
    const r = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
      headers: { Authorization: `Bearer ${mpAccessToken()}` },
    });

    const pre = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: true, mpFetchFailed: true, details: pre });
    }

    const status = pre?.status; // authorized | pending | cancelled | paused ...
    const externalRef: string | undefined = pre?.external_reference;

    // 3) Sacar uid/plan (prioridad: Firestore mapping, fallback: external_reference)
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
      // Guardamos para debug, pero no activamos nada
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

    // 4) Si está autorizado => activar
    if (status === "authorized") {
      const now = new Date();
      const until = computeUntil(now, plan);

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

      // guarda referencia del último estado MP
      await userRef.set(updates, { merge: true });

      await db().collection("mp_preapprovals").doc(preapprovalId).set(
        {
          status,
          lastWebhookAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true, activated: true });
    }

    // 5) Si canceló/paused puedes decidir revocar. Por ahora solo registramos.
    await db().collection("mp_preapprovals").doc(preapprovalId).set(
      {
        status,
        lastWebhookAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, activated: false, status });
  } catch (e: any) {
    // Igual devuelve 200 para no reintentar infinito si hay error temporal,
    // pero deja rastro en logs de Vercel.
    return res.status(200).json({ ok: false, error: e?.message || "error" });
  }
}
