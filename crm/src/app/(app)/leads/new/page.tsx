"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { LeadForm, leadToFormValues, type LeadFormValues } from "@/components/lead-form";
import { PageHeader, Spinner, useToast } from "@/components/ui";
import { createLead, getLead, linkLeads, setDuplicateOverride } from "@/lib/db/leads";
import type { Lead } from "@/lib/types";

function NewLeadInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor } = useAuth();
  const { push } = useToast();

  // ?fromLead=<id> — "Add another installation" on a Franchise lead's own
  // page: the same investor buying a second/third charger elsewhere. Reuses
  // this same New Lead form (site + config are always re-entered fresh) but
  // pre-fills the client/source/financing/partner from that lead instead of
  // starting from a blank sheet, and auto-links the two once saved.
  const fromLeadId = params.get("fromLead");
  const [sourceLead, setSourceLead] = useState<Lead | null>(null);
  const [loadingSource, setLoadingSource] = useState(Boolean(fromLeadId));

  useEffect(() => {
    if (!fromLeadId) return;
    let cancelled = false;
    getLead(fromLeadId)
      .then((l) => { if (!cancelled) setSourceLead(l); })
      .finally(() => { if (!cancelled) setLoadingSource(false); });
    return () => { cancelled = true; };
  }, [fromLeadId]);

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

    if (sourceLead) {
      // Same investor, a different installation — link them and pre-clear
      // the duplicate check the shared phone/email/GSTIN would otherwise
      // trip on both leads.
      await linkLeads(lead, sourceLead, actor);
      await setDuplicateOverride(lead, actor, `Another installation for the same investor as ${sourceLead.code}`);
    }

    push(`Lead ${lead.code} created.`, "success");
    router.replace(`/leads/${lead.id}`);
    return lead;
  }

  const initial: LeadFormValues | undefined = (() => {
    if (!sourceLead) return undefined;
    const base = leadToFormValues(sourceLead);
    return {
      ...base,
      config: [],
      extras: [],
      discount: 0,
      oem: null,
      site: { ...base.site, locationName: "", mapsLink: "", address: "", remarks: "" },
      tags: [],
      nextFollowUpAt: null,
      expectedCloseAt: null,
    };
  })();

  if (loadingSource) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  return (
    <>
      <PageHeader
        title={sourceLead ? "New installation" : "New lead"}
        description={
          sourceLead
            ? `Another charger for ${sourceLead.client?.name} — a new site and configuration, linked back to ${sourceLead.code}.`
            : "Capture the client, the source, and what they are interested in."
        }
      />
      <LeadForm submitLabel={sourceLead ? "Create installation" : "Create lead"} initial={initial} onSubmit={onSubmit} onCancel={() => router.back()} />
    </>
  );
}

export default function NewLeadPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewLeadInner />
    </Suspense>
  );
}
