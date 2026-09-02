'use client';

import { KeyRound } from 'lucide-react';

// Read-only reference. Mirrors the requireRole(...) guards actually
// enforced on the platform backend's routes -- keep this in sync by hand
// whenever a route's role list changes; it does not call the backend.
const ROLES = [
  { key: 'super_admin', label: 'Owner', description: 'Full access to everything. Always passes every check, regardless of the capability list below.' },
  { key: 'billing_ops', label: 'Finance', description: 'Runs billing day-to-day: invoices, payments, credits — without organization or platform-wide admin access.' },
  { key: 'operations', label: 'Operations', description: 'Moves tenants through their lifecycle and manages provisioning, without touching billing or admin accounts.' },
  { key: 'support', label: 'Support', description: 'Handles support sessions with tenants. No billing or lifecycle access.' },
  { key: 'read_only', label: 'Read-only', description: 'Can view every page in this console. Cannot create, edit, or delete anything.' },
];

const CAPABILITIES = [
  { area: 'Organizations', action: 'View organizations & detail', roles: ['super_admin', 'billing_ops', 'operations', 'support', 'read_only'] },
  { area: 'Organizations', action: 'Create / edit organization, branding, domains', roles: ['super_admin'] },
  { area: 'Organizations', action: 'Change lifecycle status (activate, pause, suspend, cancel…)', roles: ['super_admin', 'operations'] },
  { area: 'Organizations', action: 'Retry CRM provisioning', roles: ['super_admin', 'operations'] },
  { area: 'Organizations', action: 'Rotate API key / delete / permanently delete', roles: ['super_admin'] },
  { area: 'Billing', action: 'View plans, invoices, payments', roles: ['super_admin', 'billing_ops', 'operations', 'support', 'read_only'] },
  { area: 'Billing', action: 'Generate / mark paid / void invoices, resend email', roles: ['super_admin', 'billing_ops'] },
  { area: 'Billing', action: 'Create payment order, issue refund, add credit', roles: ['super_admin', 'billing_ops'] },
  { area: 'Billing', action: 'Manage plans, modules, add-ons, coupons catalog', roles: ['super_admin'] },
  { area: 'Operations', action: 'View audit log, jobs, system health', roles: ['super_admin', 'billing_ops', 'operations', 'support', 'read_only'] },
  { area: 'Operations', action: 'Run a job manually', roles: ['super_admin'] },
  { area: 'Operations', action: 'Start / end a support session', roles: ['super_admin', 'support'] },
  { area: 'Alpha Admin', action: 'View / manage administrators', roles: ['super_admin'] },
];

export default function RolesPermissionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Roles &amp; Permissions</h1>
        <p className="text-sm text-ink-500 mt-0.5">What each Alpha administrator role can do in this console. Reference only — edit a person&apos;s role from the Administrators page.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((r) => (
          <div key={r.key} className="card card-pad space-y-1.5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-600" />
              <span className="font-medium text-ink-900">{r.label}</span>
            </div>
            <p className="text-xs text-ink-500">{r.description}</p>
          </div>
        ))}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Capability</th>
              {ROLES.map((r) => <th key={r.key} className="text-center">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c, i) => (
              <tr key={i}>
                <td className="text-ink-500">{c.area}</td>
                <td className="text-ink-800">{c.action}</td>
                {ROLES.map((r) => (
                  <td key={r.key} className="text-center">
                    {c.roles.includes(r.key) ? (
                      <span className="badge badge-green">yes</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
