"use strict";

/**
 * Enquiry handler.
 *
 * Accepts the multipart form posted by the website, stores the lead in
 * Firestore so nothing is ever lost to a mail outage, then emails it on.
 * Reached through the /api/enquiry rewrite declared in firebase.json.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Busboy = require("busboy");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_TO = defineSecret("MAIL_TO");

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const REQUIRED = ["company", "name", "email", "phone", "projectType", "budget", "message"];

/** Parses a multipart request into { fields, files } without touching disk. */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
    });

    const fields = {};
    const files = [];
    let truncated = false;

    busboy.on("field", (name, value) => {
      fields[name] = String(value).slice(0, 5000);
    });

    busboy.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("limit", () => {
        truncated = true;
        stream.resume();
      });
      stream.on("end", () => {
        if (!truncated && chunks.length) {
          files.push({
            filename: info.filename,
            contentType: info.mimeType,
            content: Buffer.concat(chunks),
          });
        }
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ fields, files, truncated }));

    // Cloud Functions buffers the body onto rawBody.
    if (req.rawBody) busboy.end(req.rawBody);
    else req.pipe(busboy);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

exports.enquiry = onRequest(
  {
    region: "asia-south1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    let fields = {};
    let files = [];
    let truncated = false;

    try {
      const parsed = await parseForm(req);
      fields = parsed.fields;
      files = parsed.files;
      truncated = parsed.truncated;
    } catch (err) {
      console.error("Failed to parse enquiry form", err);
      res.status(400).json({ ok: false, error: "Malformed submission" });
      return;
    }

    // Honeypot — silently accept so the bot does not retry.
    if (fields.website) {
      res.status(200).json({ ok: true });
      return;
    }

    if (truncated) {
      res.status(413).json({ ok: false, error: "Attachment exceeds the 10 MB limit" });
      return;
    }

    const missing = REQUIRED.filter((key) => !fields[key] || !String(fields[key]).trim());
    if (missing.length) {
      res.status(422).json({ ok: false, error: `Missing required fields: ${missing.join(", ")}` });
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
      res.status(422).json({ ok: false, error: "Invalid email address" });
      return;
    }

    // 1. Persist first — a mail failure must never lose the lead.
    let leadId = null;
    try {
      const doc = await db.collection("enquiries").add({
        ...fields,
        attachmentNames: files.map((f) => f.filename),
        userAgent: req.get("user-agent") || null,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      leadId = doc.id;
    } catch (err) {
      console.error("Failed to store enquiry", err);
    }

    // 2. Then notify.
    const host = SMTP_HOST.value();
    const to = MAIL_TO.value() || "connect@nakjiminfra.com";

    if (host) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port: Number(SMTP_PORT.value() || 587),
          secure: Number(SMTP_PORT.value() || 587) === 465,
          auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
        });

        const rows = [
          ["Company", fields.company],
          ["Name", fields.name],
          ["Email", fields.email],
          ["Phone", fields.phone],
          ["Project type", fields.projectType],
          ["Budget", fields.budget],
          ["Site location", fields.location || "—"],
        ]
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 16px 6px 0;color:#6B7688">${k}</td><td style="padding:6px 0;color:#111"><strong>${escapeHtml(v)}</strong></td></tr>`,
          )
          .join("");

        await transporter.sendMail({
          from: `"NAKJM Website" <${SMTP_USER.value() || to}>`,
          to,
          replyTo: `${fields.name} <${fields.email}>`,
          subject: `Project enquiry — ${fields.company}`,
          text: `${REQUIRED.map((k) => `${k}: ${fields[k]}`).join("\n")}\n\nLead ID: ${leadId}`,
          html: `
            <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:640px">
              <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C1121F;margin:0 0 8px">New project enquiry</p>
              <h1 style="font-size:22px;color:#001E4B;margin:0 0 24px">${escapeHtml(fields.company)}</h1>
              <table style="border-collapse:collapse;font-size:14px">${rows}</table>
              <p style="margin:24px 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6B7688">Project details</p>
              <p style="white-space:pre-wrap;font-size:14px;color:#111;line-height:1.7;margin:0">${escapeHtml(fields.message)}</p>
              <p style="margin-top:28px;font-size:12px;color:#6B7688">
                ${files.length ? `${files.length} attachment(s). ` : ""}Lead ID: ${leadId || "not stored"}
              </p>
            </div>`,
          attachments: files,
        });
      } catch (err) {
        // The lead is already in Firestore, so report success to the visitor
        // and surface the mail failure in logs for follow-up.
        console.error("Failed to send enquiry email", err);
        res.status(leadId ? 200 : 502).json({
          ok: Boolean(leadId),
          stored: Boolean(leadId),
          error: leadId ? null : "Could not deliver enquiry",
        });
        return;
      }
    } else {
      console.warn("SMTP_HOST is not configured — enquiry stored but not emailed");
    }

    res.status(200).json({ ok: true, stored: Boolean(leadId), id: leadId });
  },
);
