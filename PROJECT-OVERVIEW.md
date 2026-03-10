# InvoiceKu — Project Overview & Features

## What This Project Is About

**InvoiceKu** is a **multi-tenant invoicing and business management web app** for **UMKM** (usaha mikro, kecil, menengah / small businesses) in Indonesia. It helps owners and staff manage:

- **Sales**: quotations, invoices, delivery notes (Surat Jalan)
- **Purchasing**: purchase orders (PO)
- **Master data**: customers, products (Barang), vendors, warehouses
- **Organization**: one org per business, with owner/admin and staff (kasir) roles

The app is built with **Next.js 16**, **React 19**, **Supabase** (auth + database), and **Tailwind CSS**. It supports **Indonesian** labels and **Rupiah** currency, and includes **PDF generation** (including dot-matrix–style for thermal printers) and **activity logging** for admins.

---

## Feature List

### Authentication & Users
- **Owner/Admin login** — Email + password at `/login`; sign up creates first user.
- **Staff login** — Separate flow at `/staff` using **Org Code** + **Username** (no email).
- **Auto org setup** — After first login, `POST /api/init-org` creates organization and membership.
- **Role-based sidebar** — Menu items like "Activity" and "Pengaturan" can be restricted (e.g. admin-only).

### Dashboard
- **KPI cards**: Outstanding (UNPAID/PARTIAL) count and sum, Paid this month, Paid last month, Total invoices.
- **“Butuh perhatian”** — Up to 8 oldest unpaid/partial invoices, clickable to detail.
- **Omset chart** — Bar chart of paid revenue for the last 6 months (no chart library).
- **Shortcuts** — Quick links to create invoice, list invoices, delivery notes, products.

### Sales
- **Quotations** — Create, list, view, update, delete; convert to invoice; PDF download.
- **Invoice** — Create, list, view; line items, discount %, tax %, amount paid; PDF (normal + dot-matrix), print (80-col text).
- **Surat Jalan (Delivery notes)** — Create from invoice or standalone; list, view; PDF and dot-matrix PDF.

### Purchasing
- **Purchase orders** — Create, list, view, cancel, delete; PDF preview and download.

### Master Data
- **Customer** — CRUD per organization.
- **Barang (Products)** — CRUD per organization.
- **Vendor** — CRUD per organization.
- **Warehouse** — CRUD; quick action “Buat Warehouse” in sidebar.

### PDF & Print
- **Invoice PDF** — Standard and dot-matrix style; optional bank info, discount, tax, note; optional delivery note section.
- **Invoice print** — 80-column dot-matrix–style text for thermal printers.
- **Quotation PDF** — Download from list and detail.
- **Delivery note PDF** — Normal and dot-matrix.
- **Purchase order PDF** — Preview and download.
- **Invoice template settings** — Per-org options (e.g. dot-matrix vs clean); PDF-auto route uses saved template.

### Payments
- **Invoice payment** — Record `amount_paid`; payment APIs and payment-specific routes (e.g. `/api/invoice/payment/[paymentId]`).
- **Pay state** — UNPAID / PARTIAL / PAID derived from grand total vs amount paid.

### Organization & Settings
- **Multi-tenant** — All data scoped by `org_id`.
- **Settings (Pengaturan)** — Org profile, invoice template (e.g. invoice-template page).
- **Activity log** — Admin-only; shows recent actions (actor role, action, entity, summary) from `activity_logs` table.

### API Overview
- **Auth**: `init-org`, logout, auth/invoices (and update), auth/logout.
- **Invoices**: CRUD, pdf, pdf-dotmatrix, pdf-auto, print, payment.
- **Quotations**: CRUD, pdf, next-number, convert to invoice, delete, update.
- **Delivery notes**: PDF, pdf-dotmatrix, from-invoice.
- **Purchase orders**: CRUD, pdf, cancel, delete.
- **Master**: products, vendors, warehouses, members, org (e.g. profile).

### Tech Stack (Summary)
- **Next.js 16** (App Router), **React 19**
- **Supabase** — Auth, database, RLS
- **@react-pdf/renderer** — All PDF generation
- **Tailwind CSS 4** — Styling
- **TypeScript**

---

*Generated from codebase exploration. Update this file when you add or change features.*
