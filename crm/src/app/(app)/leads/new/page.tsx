"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { LeadForm, type LeadFormValues } from "@/components/lead-form";
import { PageHeader, useToast } from "@/components/ui";
import { createLead } from "@/lib/db/leads";

export default function NewLeadPage() {
  const router = useRouter();
  const { actor } = useAuth();
  const { push } = useToast();

  async function onSubmit(values: LeadFormValues) {
    if (!actor) throw new Error("Your session is not ready yet. Try again in a moment.");
    const lead = await createLead(
      {
        type: values.type,
        client: values.client,
        source: values.source,
        sourceDetail: values.sourceDetail,
        config: values.config,
        extras: values.extras,
        discount: values.discount,
        gstMode: values.gstMode,
        oem: values.oem,
        financing: values.financing,
        site: values.site,
        tags: values.tags,
        nextFollowUpAt: values.nextFollowUpAt,
        expectedCloseAt: values.expectedCloseAt,
        partnerId: values.partnerId,
        partnerName: values.partnerName,
        commercialModel: values.commercialModel,
        ownerId: values.ownerId,
        ownerName: values.ownerName,
      },
      actor,
    );
    push(`Lead ${lead.code} created.`, "success");
    router.replace(`/leads/${lead.id}`);
  }

  return (
    <>
      <PageHeader
        title="New lead"
        description="Capture the client, the source, and what they are interested in."
      />
      <LeadForm submitLabel="Create lead" onSubmit={onSubmit} onCancel={() => router.back()} />
    </>
  );
}
