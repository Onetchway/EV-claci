"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";

import {
  enquirySchema,
  projectTypes,
  budgetBands,
  validateDrawing,
  type EnquiryValues,
} from "@/lib/validation";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "sent" | "error";

const fieldBase =
  "w-full border-b border-navy/20 bg-transparent px-0 py-4 text-navy outline-none transition-colors duration-300 placeholder:text-ink/25 focus:border-crimson";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EnquiryValues>({
    resolver: zodResolver(enquirySchema),
    mode: "onBlur",
  });

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [];
    for (const file of Array.from(list)) {
      const err = validateDrawing(file);
      if (err) {
        setFileError(err);
        return;
      }
      next.push(file);
    }
    setFileError(null);
    setFiles((prev) => [...prev, ...next].slice(0, 5));
  };

  const onSubmit = async (values: EnquiryValues) => {
    // Honeypot tripped — pretend success so the bot moves on.
    if (values.website) {
      setStatus("sent");
      return;
    }

    setStatus("sending");

    const body = new FormData();
    Object.entries(values).forEach(([k, v]) => {
      if (k !== "website" && v) body.append(k, String(v));
    });
    files.forEach((f) => body.append("drawings", f, f.name));

    try {
      const res = await fetch(site.contactEndpoint, { method: "POST", body });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setStatus("sent");
      reset();
      setFiles([]);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {status === "sent" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-[28rem] flex-col items-start justify-center"
          >
            <motion.svg
              viewBox="0 0 64 64"
              className="h-16 w-16 text-crimson"
              initial="hidden"
              animate="visible"
              aria-hidden
            >
              <motion.circle
                cx="32"
                cy="32"
                r="29"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.path
                d="M20 33.5 28.5 42 45 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              />
            </motion.svg>

            <h2 className="mt-9 text-title text-navy">Enquiry received.</h2>
            <p className="mt-5 max-w-measure text-ink/55">
              Thank you — your enquiry is with our team and we will reply within
              one working day. For anything urgent, call{" "}
              <a href={`tel:${site.phoneHref}`} className="text-crimson underline underline-offset-4">
                {site.phone}
              </a>
              .
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="link-sweep mt-10 text-crimson"
            >
              Send another enquiry
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="space-y-10"
          >
            {/* honeypot */}
            <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              <Field label="Company" error={errors.company?.message} htmlFor="company">
                <input id="company" className={fieldBase} placeholder="Your organisation" autoComplete="organization" {...register("company")} />
              </Field>
              <Field label="Full name" error={errors.name?.message} htmlFor="name">
                <input id="name" className={fieldBase} placeholder="Who we should reply to" autoComplete="name" {...register("name")} />
              </Field>
              <Field label="Work email" error={errors.email?.message} htmlFor="email">
                <input id="email" type="email" className={fieldBase} placeholder="you@company.com" autoComplete="email" {...register("email")} />
              </Field>
              <Field label="Phone" error={errors.phone?.message} htmlFor="phone">
                <input id="phone" type="tel" className={fieldBase} placeholder="+91 00000 00000" autoComplete="tel" {...register("phone")} />
              </Field>
              <Field label="Project type" error={errors.projectType?.message} htmlFor="projectType">
                <select id="projectType" className={cn(fieldBase, "appearance-none")} defaultValue="" {...register("projectType")}>
                  <option value="" disabled>Select scope…</option>
                  {projectTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Project budget" error={errors.budget?.message} htmlFor="budget">
                <select id="budget" className={cn(fieldBase, "appearance-none")} defaultValue="" {...register("budget")}>
                  <option value="" disabled>Select band…</option>
                  {budgetBands.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Site location" error={errors.location?.message} htmlFor="location" optional>
              <input id="location" className={fieldBase} placeholder="City / state" {...register("location")} />
            </Field>

            <Field label="Project details" error={errors.message?.message} htmlFor="message">
              <textarea
                id="message"
                rows={5}
                className={cn(fieldBase, "resize-y")}
                placeholder="Number of sites, charger ratings or sanctioned load, target timeline…"
                {...register("message")}
              />
            </Field>

            {/* drawings */}
            <div>
              <span className="text-eyebrow uppercase text-ink/40">
                Upload drawings <span className="normal-case tracking-normal text-ink/25">— optional</span>
              </span>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFiles(e.dataTransfer.files);
                }}
                className="mt-5 border border-dashed border-navy/25 p-8 text-center transition-colors duration-300 hover:border-crimson"
              >
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg,.zip"
                  className="sr-only"
                  id="drawings"
                  onChange={(e) => onFiles(e.target.files)}
                />
                <label htmlFor="drawings" className="cursor-pointer">
                  <span className="block text-navy">Drop files here or <span className="text-crimson underline underline-offset-4">browse</span></span>
                  <span className="mt-2 block text-sm text-ink/40">PDF, JPG, PNG, WEBP, DWG or ZIP · up to 10 MB each · 5 files max</span>
                </label>
              </div>

              {fileError ? <p className="mt-3 text-sm text-crimson">{fileError}</p> : null}

              {files.length ? (
                <ul className="mt-5 space-y-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between border-b border-navy/10 py-3 text-sm">
                      <span className="truncate text-navy">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, n) => n !== i))}
                        className="ml-4 shrink-0 text-eyebrow uppercase text-crimson"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {status === "error" ? (
              <p className="border-l-2 border-crimson bg-crimson/5 px-6 py-4 text-sm text-crimson-700">
                That did not send. Please email{" "}
                <a href={`mailto:${site.email}`} className="underline underline-offset-4">{site.email}</a>{" "}
                or call {site.phone} and we will pick it up straight away.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "sending"}
              className="group relative inline-flex items-center gap-3 overflow-hidden bg-crimson px-10 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:bg-crimson-700 disabled:opacity-60"
            >
              <span className="relative z-10">{status === "sending" ? "Sending…" : "Send enquiry"}</span>
              <span aria-hidden className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>

            <p className="text-sm text-ink/40">
              We reply within one working day. Your details are used only to
              respond to this enquiry — see our{" "}
              <a href="/privacy/" className="text-crimson underline underline-offset-4">privacy policy</a>.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-eyebrow uppercase text-ink/40">
        {label}
        {optional ? <span className="normal-case tracking-normal text-ink/25"> — optional</span> : null}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
