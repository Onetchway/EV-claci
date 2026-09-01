"use client";

import { LegalDocumentListPage } from "@/components/legal-document-ui";

export default function EoiPage() {
  return <LegalDocumentListPage docType="EOI" basePath="/eoi" />;
}
