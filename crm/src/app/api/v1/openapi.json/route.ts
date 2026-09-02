import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminConfigured, adminDb } from "@/lib/firebase/admin";
import { publicOrigin } from "@/lib/ocpi/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hand-written OpenAPI 3.0 description of the read-only /api/v1 surface —
 * generated from a decorator/framework would drift less, but this is 5
 * simple GET endpoints sharing one auth scheme, and a generator is more
 * machinery than the surface currently justifies. Keep this in sync by
 * hand when a v1 route's shape changes; the CRM's /developer page renders
 * this directly rather than duplicating the description.
 */
function spec(origin: string, companyName: string) {
  const bearerAuth = { bearerAuth: [] as string[] };
  const errorSchema = {
    type: "object",
    properties: {
      error: { type: "string" },
      code: { type: "string" },
      requestId: { type: "string" },
    },
  };
  const listEndpoint = (summary: string, itemsKey: string, itemProps: Record<string, unknown>) => ({
    get: {
      summary,
      security: [bearerAuth],
      responses: {
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { [itemsKey]: { type: "array", items: { type: "object", properties: itemProps } } },
              },
            },
          },
        },
        "401": { description: "Missing, invalid, revoked, or expired API key", content: { "application/json": { schema: errorSchema } } },
        "429": { description: "Rate limit exceeded for this key", content: { "application/json": { schema: errorSchema } } },
      },
    },
  });

  return {
    openapi: "3.0.3",
    info: {
      title: `${companyName} API`,
      version: "1.0.0",
      description:
        "Read-only integration API for external systems (accounting, fleet dashboards, partner NOCs). " +
        "Every endpoint is authenticated with a Bearer API key issued from the CRM's Developer page. " +
        "Keys are rate-limited (default 60 req/min, configurable per key) and can carry an optional expiry. " +
        "Every error response shares one envelope: { error, code, requestId } — `code` is stable and safe to branch on.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "lg_...", description: "API key from Developer → API Keys" },
      },
    },
    paths: {
      "/chargers": listEndpoint("List registered chargers with live status", "chargers", {
        chargerId: { type: "string" }, label: { type: "string" }, location: { type: "string" },
        chargerPowerType: { type: "string" }, connectorType: { type: ["string", "null"] },
        powerKw: { type: ["number", "null"] }, lat: { type: ["number", "null"] }, lng: { type: ["number", "null"] },
        status: { type: "string", enum: ["ONLINE", "OFFLINE"] }, firmwareVersion: { type: ["string", "null"] },
      }),
      "/sessions": listEndpoint("List the 100 most recently updated charging sessions", "sessions", {
        id: { type: "string" }, chargePointId: { type: "string" }, transactionId: { type: "string" },
        status: { type: "string" }, startedAt: { type: ["string", "null"], format: "date-time" },
        endedAt: { type: ["string", "null"], format: "date-time" }, energyDeliveredWh: { type: ["number", "null"] },
        totalCostInr: { type: ["number", "null"] },
      }),
      "/tariffs": listEndpoint("List active tariffs", "tariffs", {
        id: { type: "string" }, name: { type: "string" }, scope: { type: "string" }, pricingType: { type: "string" },
        rate: { type: "number" }, gstPct: { type: "number" }, platformFeeInr: { type: "number" },
        idleFeeInrPerMin: { type: "number" }, idleGraceMinutes: { type: "number" }, parkingFeeInr: { type: "number" },
        priority: { type: "number" },
      }),
      "/tickets": listEndpoint("List the 100 most recent fault/offline tickets", "tickets", {
        id: { type: "string" }, chargePointId: { type: "string" }, type: { type: "string" },
        faultClass: { type: ["string", "null"] }, status: { type: "string" }, description: { type: "string" },
        openedAt: { type: ["string", "null"], format: "date-time" }, resolvedAt: { type: ["string", "null"], format: "date-time" },
        slaDueAt: { type: ["string", "null"], format: "date-time" },
      }),
      "/invoices": listEndpoint("List the 100 most recent invoices", "invoices", {
        id: { type: "string" }, invoiceNumber: { type: "string" }, status: { type: "string" },
        billToName: { type: "string" }, billToGstin: { type: ["string", "null"] },
        periodStart: { type: ["string", "null"], format: "date-time" }, periodEnd: { type: ["string", "null"], format: "date-time" },
        subtotalInr: { type: "number" }, gstInr: { type: "number" }, totalInr: { type: "number" },
        hsnSac: { type: ["string", "null"] }, tdsPct: { type: ["number", "null"] }, tdsInr: { type: ["number", "null"] },
      }),
    },
  };
}

export async function GET(req: Request) {
  const slug = cookies().get("tenant_slug")?.value;
  let companyName = "CRM";
  if (slug && adminConfigured()) {
    try {
      const snap = await adminDb().collection("organizations").where("slug", "==", slug).limit(1).get();
      companyName = (snap.docs[0]?.data() as { name?: string } | undefined)?.name || companyName;
    } catch {
      // Falls back to the generic title -- an OpenAPI doc is fine without a name.
    }
  }
  return NextResponse.json(spec(publicOrigin(req), companyName));
}
