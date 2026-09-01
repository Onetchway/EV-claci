"use client";

import { NewLegalDocumentPage } from "@/components/legal-document-ui";

export default function NewAgreementPage() {
  return <NewLegalDocumentPage docType="AGREEMENT" basePath="/agreements" />;
}
