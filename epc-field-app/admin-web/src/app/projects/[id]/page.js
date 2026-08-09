'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';
import StatusBadge from '../../../components/StatusBadge';
import { apiFetch } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/useAuthGuard';

export default function ProjectDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await apiFetch(`/projects/${id}`);
      setProject(data.project);
      setMilestones(data.paymentMilestones);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, id]);

  if (!ready) return null;
  if (error) return (<><Nav /><div className="page"><div className="error-box">{error}</div></div></>);
  if (!project) return (<><Nav /><div className="page">Loading…</div></>);

  return (
    <>
      <Nav />
      <div className="page">
        <h1>{project.siteName}</h1>
        <p className="muted">{project.client?.name} — {project.address}</p>

        <div className="grid cols-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Execution Stages</h2>
            <table>
              <thead><tr><th>#</th><th>Stage</th><th>Status</th></tr></thead>
              <tbody>
                {project.stages.map((s) => (
                  <tr key={s.id}>
                    <td>{s.stageTemplate.order}</td>
                    <td>
                      {s.status === 'LOCKED'
                        ? s.stageTemplate.name
                        : <Link href={`/stages/${s.id}`}>{s.stageTemplate.name}</Link>}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Payment Milestones</h2>
            {milestones.map((m) => (
              <div className="milestone-row" key={m.key}>
                <span><span className={`dot ${m.achieved ? 'achieved' : 'pending'}`} />{m.label}</span>
                <strong>{m.percent}%{m.achieved ? ' ✓' : ''}</strong>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 10 }}>
              Derived automatically from stage approvals per the V-Green Playbook §12 payment terms.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
