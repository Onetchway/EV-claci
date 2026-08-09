'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '../../../components/Nav';
import StatusBadge from '../../../components/StatusBadge';
import SubmissionData from '../../../components/SubmissionData';
import { apiFetch, getUser } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function StageDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const router = useRouter();
  const [stage, setStage] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const user = ready ? getUser() : null;

  async function load() {
    try {
      const data = await apiFetch(`/project-stages/${id}`);
      setStage(data.stage);
      setSubmission(data.latestSubmission);
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
                {user?.role === 'ADMIN' && (
                  <button className="btn secondary" onClick={regeneratePdf} disabled={busy}>Regenerate PDF</button>
                )}
              </div>
            </div>

            {user?.role === 'ADMIN' && stage.status === 'SUBMITTED' && (
              <div className="card">
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={approve} disabled={busy}>Approve Stage</button>
                  <button className="btn danger" onClick={() => setShowReject((s) => !s)} disabled={busy}>Reject Stage</button>
                </div>
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
