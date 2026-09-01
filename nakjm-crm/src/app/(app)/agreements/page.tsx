"use client";

import { LegalDocumentListPage } from "@/components/legal-document-ui";

export default function AgreementsPage() {
  return <LegalDocumentListPage docType="AGREEMENT" basePath="/agreements" />;
}
