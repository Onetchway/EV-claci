'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '../../../components/Nav';
import StatusBadge from '../../../components/StatusBadge';
import SubmissionData from '../../../components/SubmissionData';
import { apiFetch } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function StageDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const router = useRouter();
  const [stage, setStage] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [alreadyDecided, setAlreadyDecided] = useState(false);
  const [requiredApprovals, setRequiredApprovals] = useState(1);
  const [approvals, setApprovals] = useState([]);
  const [canManageSubmission, setCanManageSubmission] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  async function load() {
    try {
      const data = await apiFetch(`/project-stages/${id}`);
      setStage(data.stage);
      setSubmission(data.latestSubmission);
      setCanApprove(!!data.canApprove);
      setAlreadyDecided(!!data.alreadyDecided);
      setRequiredApprovals(data.requiredApprovals || 1);
      setApprovals(data.approvals || []);
      setCanManageSubmission(!!data.canManageSubmission);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, id]);

  async function approve() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/project-stages/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/project-stages/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason }) });
      setShowReject(false);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function regeneratePdf() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/submissions/${submission.id}/generate-pdf`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (error) return (<><Nav /><div className="page"><div className="error-box">{error}</div></div></>);
  if (!stage) return (<><Nav /><div className="page">Loading…</div></>);

  const photoSlots = [...stage.stageTemplate.photoSlots].sort((a, b) => a.order - b.order);
  const photosBySlotId = new Map((submission?.photos || []).map((p) => [p.photoSlotId, p]));

  return (
    <>
      <Nav />
      <div className="page">
        <button className="btn secondary" onClick={() => router.back()} style={{ marginBottom: 12 }}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>{stage.project.siteName} — {stage.stageTemplate.name}</h1>
          <StatusBadge status={stage.status} />
        </div>

        {stage.status === 'REJECTED' && stage.rejectionReason && (
          <div className="error-box">Rejected: {stage.rejectionReason}</div>
        )}

        {!submission && <div className="card muted">No submission has been started for this stage yet.</div>}

        {submission && (
          <>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="muted">
                Submission v{submission.version} by {submission.submittedBy?.name || '—'}
                {stage.submittedAt && <> · submitted {new Date(stage.submittedAt).toLocaleString()}</>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {submission.pdfUrl && (
                  <a className="btn secondary" href={submission.pdfUrl} target="_blank" rel="noreferrer">Download PDF</a>
                )}
                {canManageSubmission && (
                  <button className="btn secondary" onClick={regeneratePdf} disabled={busy}>Regenerate PDF</button>
                )}
              </div>
            </div>

            {stage.status === 'SUBMITTED' && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Approval</h2>
                {requiredApprovals > 1 && (
                  <p className="muted" style={{ marginTop: 0 }}>
                    {approvals.filter((a) => a.decision === 'APPROVED').length} of {requiredApprovals} required approvals so far.
                  </p>
                )}
                {approvals.length > 0 && (
                  <ul style={{ margin: '0 0 12px 0', paddingLeft: 18 }}>
                    {approvals.map((a) => (
                      <li key={a.id}>
                        {a.approver.name} — <strong>{a.decision}</strong>
                        {a.comment && <> ({a.comment})</>}
                        <span className="muted"> · {new Date(a.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {canApprove && !alreadyDecided && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn" onClick={approve} disabled={busy}>Approve Stage</button>
                    <button className="btn danger" onClick={() => setShowReject((s) => !s)} disabled={busy}>Reject Stage</button>
                  </div>
                )}
                {canApprove && alreadyDecided && (
                  <p className="muted">You've already recorded a decision for this submission.</p>
                )}
                {showReject && (
                  <div style={{ marginTop: 12 }}>
                    <div className="field">
                      <label>Rejection reason</label>
                      <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    </div>
                    <button className="btn danger" onClick={reject} disabled={busy || !rejectReason}>Confirm Reject</button>
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Report Data</h2>
              <SubmissionData fieldDefs={stage.stageTemplate.fieldDefs} dataJson={submission.dataJson} />
            </div>

            {photoSlots.length > 0 && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Geotagged Photos</h2>
                <div className="photo-grid">
                  {photoSlots.map((slot) => {
                    const photo = photosBySlotId.get(slot.id);
                    return (
                      <div className="photo-cell" key={slot.id}>
                        {photo ? (
                          <img src={photo.stampedUrl || photo.originalUrl} alt={slot.label} />
                        ) : (
                          <div className="missing">Not submitted{slot.required ? ' (required)' : ''}</div>
                        )}
                        <div className="label">{slot.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
