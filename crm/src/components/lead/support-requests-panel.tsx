"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button, Card, Textarea, useAsyncAction } from "@/components/ui";
import { resolveSupportRequest, subscribeLeadSupportRequests } from "@/lib/db/support-requests";
import type { Actor, Lead, PortalSupportRequest } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function ReplyRow({ lead, request, actor }: { lead: Lead; request: PortalSupportRequest; actor: Actor }) {
  const [reply, setReply] = useState("");
  const { busy, run } = useAsyncAction();

  return (
    <div className="rounded-lg border border-ink-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{request.subject}</p>
        <Badge className={request.status === "OPEN" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-emerald-100 text-emerald-800 ring-emerald-200"}>
          {request.status === "OPEN" ? "Open" : "Resolved"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-ink-500">{request.investorName} · {formatDateTime(request.createdAt)}</p>
      <p className="mt-2 text-sm text-ink-700">{request.message}</p>

      {request.status === "RESOLVED" ? (
        request.reply && (
          <div className="mt-2 rounded-lg bg-ink-50 px-3 py-2">
            <p className="text-xs font-semibold text-ink-700">Your reply</p>
            <p className="mt-0.5 text-sm text-ink-800">{request.reply}</p>
          </div>
        )
      ) : (
        <div className="mt-2 space-y-2">
          <Textarea rows={2} placeholder="Reply — this is visible to the investor in their portal." value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={() => void run(() => resolveSupportRequest(lead.id, request.id, actor, reply.trim() || undefined), "Marked resolved.")}
          >
            Reply & resolve
          </Button>
        </div>
      )}
    </div>
  );
}

export function SupportRequestsPanel({ lead, actor, className }: { lead: Lead; actor: Actor; className?: string }) {
  const [requests, setRequests] = useState<PortalSupportRequest[]>([]);

  useEffect(() => subscribeLeadSupportRequests(lead.id, setRequests), [lead.id]);

  if (requests.length === 0) return null;

  const openCount = requests.filter((r) => r.status === "OPEN").length;

  return (
    <Card
      title={<span className="flex items-center gap-1.5"><MessageCircleQuestion className="h-4 w-4 text-brand-600" /> Portal requests</span>}
      subtitle={openCount > 0 ? `${openCount} awaiting a reply` : "All caught up."}
      className={className}
    >
      <div className="space-y-3">
        {requests.map((r) => <ReplyRow key={r.id} lead={lead} request={r} actor={actor} />)}
      </div>
    </Card>
  );
}
