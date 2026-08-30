import { NextResponse } from "next/server";
import { z } from "zod";

import { PROJECT_TYPES } from "@/lib/constants";
import { ApiError, errorResponse, requireCaller } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

const Extracted = z.object({
  clientName: z.string().nullable(),
  projectName: z.string().nullable(),
  poNumber: z.string().nullable(),
  contractValue: z.number().nullable(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  completionDate: z.string().nullable(),
  projectType: z.enum(PROJECT_TYPES).nullable(),
  scopeOfWork: z.string().nullable(),
});

/**
 * Reads a client PO / work order file and asks Claude to pull out the
 * fields the brief's "PO/WO -> auto-create project" automation needs.
 * This is a read-only extraction step — nothing is written anywhere; the
 * caller decides whether to use the result to prefill the New Project form.
 */
export async function POST(req: Request) {
  try {
    await requireCaller(req, "OPERATIONS");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ApiError(
        "PO auto-extraction is not configured on this server. An admin needs to add ANTHROPIC_API_KEY " +
          "(an Anthropic API key, from console.anthropic.com) to the environment and redeploy.",
        503,
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("No file uploaded.", 400);
    if (file.size === 0) throw new ApiError("The uploaded file is empty.", 400);
    if (file.size > MAX_BYTES) throw new ApiError("File is too large — 15MB max.", 400);
    if (!ACCEPTED_MIME.has(file.type)) {
      throw new ApiError("Unsupported file type — upload a PDF, PNG, JPEG or WebP.", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const contentBlock = file.type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: file.type, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } };

    const prompt = [
      "This is a client purchase order or work order for an EPC (engineering/procurement/construction) company.",
      "Extract the following fields and reply with ONLY a JSON object, no other text:",
      "{",
      '  "clientName": string or null — the client/company that issued this PO/WO,',
      '  "projectName": string or null — a short project name/title if stated, else null,',
      '  "poNumber": string or null — the PO or work order number,',
      '  "contractValue": number or null — the total order value in INR, digits only (no currency symbol or commas),',
      '  "location": string or null — the site/delivery location, city and state if given,',
      '  "startDate": string or null — ISO date YYYY-MM-DD if a start/commencement date is stated,',
      '  "completionDate": string or null — ISO date YYYY-MM-DD if a completion/delivery date is stated,',
      `  "projectType": one of [${PROJECT_TYPES.join(", ")}] or null — best guess from the scope of work,`,
      '  "scopeOfWork": string or null — a one to two sentence summary of what is being ordered',
      "}",
      "If a field cannot be determined from the document, use null. Do not guess dates or values that aren't stated.",
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ApiError(`Extraction failed upstream (${response.status}). ${body.slice(0, 300)}`, 502);
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new ApiError("Could not parse a result from the document. Try a clearer scan.", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new ApiError("Could not parse a result from the document. Try a clearer scan.", 502);
    }

    const result = Extracted.safeParse(parsed);
    if (!result.success) {
      throw new ApiError("The document didn't yield a usable result. Try a clearer scan or fill the form manually.", 502);
    }

    return NextResponse.json(result.data);
  } catch (err) {
    return errorResponse(err);
  }
}
