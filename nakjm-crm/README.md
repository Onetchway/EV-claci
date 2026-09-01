# NAKJM EPC CRM

Client, project, procurement and vendor management for NAKJM's EPC
business — clients → projects → quotations/BOQ → purchase orders/proforma
invoices → payments, plus team assignment and site progress reporting.

Built as a Next.js + Firebase app (Firestore, Auth, Storage), the same
stack and deploy story as this repo's other CRM (`crm/`, for Alpha Green's EV charging franchise business) — see [DEPLOYMENT.md](./DEPLOYMENT.md)
for the full first-time setup (Firebase project, security rules, App
Hosting, custom domain).

## Local development

```bash
cp .env.example .env.local   # fill in your Firebase web-app keys
npm install
npm run dev                  # http://localhost:3200
```

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run typecheck`
- `npm run seed -- --email you@nakjminfra.com --name "Your Name"` — bootstraps the first super admin
- `npm run create-user -- --email jane@nakjminfra.com --name "Jane Doe" --role ADMIN` — creates any other user from the CLI

## Structure

- `src/lib/constants.ts`, `src/lib/types.ts` — roles, enums, entity shapes
- `src/lib/db/*.ts` — Firestore reads/writes per entity (clients, vendors,
  team members, projects, quotations, BOQ, purchase orders, proforma
  invoices, payments, site reports, documents)
- `src/lib/boq-parser.ts` — parses an uploaded BOQ Excel file into
  structured line items, in the browser
- `src/app/(app)/*` — the authenticated app shell and pages
- `src/app/api/users/*` — Admin-SDK-backed user provisioning (create /
  update role / deactivate)
- `firebase/` — Firestore security rules, indexes, Storage rules
