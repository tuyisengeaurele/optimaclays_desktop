import fs from 'fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { LOGO_PATH } from './logoPath'
import { numberToWords } from './numberToWords'

type InvoiceWithDetail = Prisma.InvoiceGetPayload<{
  include: { order: { include: { customer: true } }; items: true; payments: true }
}>
type InvoiceWithComputed = InvoiceWithDetail & { paid: number; balance: number; is_overdue: boolean }

interface CreateInvoicePayload {
  orderId: string
  due_date?: string
}

interface GetInvoicePayload {
  id: string
}

interface DeleteInvoicePayload {
  id: string
}

interface InvoicePdfPayload {
  id: string
}

interface InvoicePdfResult {
  html: string
  filename: string
}

export function computeIsOverdue(invoice: { due_date: Date | null; total: number }, paid: number): boolean {
  if (!invoice.due_date) return false
  return new Date() > invoice.due_date && paid < invoice.total
}

async function buildInvoiceHtml(id: string): Promise<{ html: string; number: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { order: { include: { customer: true } }, items: true, payments: true }
  })
  if (!invoice) return null

  const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } })
  const co = {
    name: 'OPTIMA CLAYS LTD',
    tin: settings?.tin || '102724630',
    bank_name: settings?.bank_name || 'Bank of Kigali',
    bank_account: settings?.bank_account || '000490774630268',
    phone: settings?.phone || '0788640901',
    email: settings?.email || 'optimaclaysltd@gmail.com',
    address: settings?.address || 'Rwanda, Southern Province, Muhanga, Shyogwe, Ruli',
    director_name: settings?.director_name || 'Eurelie MUREKEYISONI',
    director_title: settings?.director_title || 'Managing Director'
  }

  const customer = invoice.order?.customer
  const fmt = (n: number): string => n.toLocaleString('en-RW')
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0)
  const balance = invoice.total - paid
  const isOverdue = computeIsOverdue(invoice, paid)

  const clientName = customer
    ? customer.customer_type === 'INDIVIDUAL'
      ? customer.full_name || ''
      : customer.company_name || ''
    : ''
  const clientTin = customer?.tin_number || null
  const clientContact = customer
    ? customer.customer_type === 'INDIVIDUAL'
      ? customer.phone || ''
      : customer.contact_person_name
        ? `${customer.contact_person_name}${customer.contact_person_phone ? ' · ' + customer.contact_person_phone : ''}`
        : ''
    : ''
  const clientLocation = customer?.location || ''

  // Logo, embed as base64 so it prints offline
  let logoHtml = `<div style="width:80px;height:80px;background:#f0eeec;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#1a1a2e;letter-spacing:1px;">OPTIMA<br>CLAYS</div>`
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const b64 = fs.readFileSync(LOGO_PATH).toString('base64')
      logoHtml = `<img src="data:image/png;base64,${b64}" style="max-height:90px;max-width:200px;object-fit:contain;" alt="Optima Clays Ltd" />`
    }
  } catch {
    // fall back to the text logo above
  }

  const fmtDate = (d: Date): string => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const itemRows = invoice.items
    .map(
      (item, i) => `
        <tr>
          <td>${String(i + 1).padStart(2, '0')}</td>
          <td>
            <div class="prod-name">${item.description}</div>
            <div class="prod-meta">${item.brick_type.replace(/_/g, ' ')} · ${item.quality_grade.replace(/_/g, ' ')}</div>
          </td>
          <td class="r">${fmt(item.quantity)}</td>
          <td class="r">${fmt(item.unit_price)}</td>
          <td class="r">${fmt(item.total)}</td>
        </tr>`
    )
    .join('')

  const amountWords = numberToWords(invoice.total)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoice.number}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #eef0f4; }

  .page { max-width: 880px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 32px rgba(0,0,0,0.13); }

  /* ── HEADER ── */
  .hd { background: #fff; padding: 24px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 2px solid #1a1a2e; }
  .hd-left { display: flex; flex-direction: column; gap: 10px; }
  .hd-company { color: #666; font-size: 11.5px; line-height: 1.65; margin-top: 4px; }
  .hd-company strong { display: block; font-size: 15px; font-weight: 700; color: #1a1a2e; letter-spacing: 0.3px; margin-bottom: 3px; }
  .hd-right { text-align: right; flex-shrink: 0; }
  .doc-word { font-size: 32px; font-weight: 800; color: #b71c1c; letter-spacing: 3px; line-height: 1; }
  .doc-sub  { font-size: 12px; color: #999; letter-spacing: 4px; margin-top: 2px; text-transform: uppercase; }
  .doc-num  { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-top: 10px; }
  .doc-dates { margin-top: 6px; }
  .doc-dates td { font-size: 11.5px; color: #888; padding: 1.5px 0; }
  .doc-dates td:first-child { padding-right: 12px; opacity: 0.7; }
  .doc-dates td:last-child  { font-weight: 600; color: #1a1a2e; }
  .status-pill { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }

  /* ── ADDRESS ROW ── */
  .addr-row { display: flex; border-bottom: 1.5px solid #f0f0f0; }
  .addr-cell { flex: 1; padding: 18px 36px; }
  .addr-cell + .addr-cell { border-left: 1px solid #f0f0f0; }
  .addr-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b71c1c; margin-bottom: 9px; }
  .addr-tbl td { font-size: 12.5px; padding: 2.5px 0; vertical-align: top; }
  .addr-tbl td:first-child { color: #999; width: 85px; }
  .addr-tbl td:last-child  { font-weight: 600; color: #1a1a2e; padding-left: 8px; }

  /* ── ITEMS TABLE ── */
  .tbl-wrap { padding: 22px 36px 0; }
  .tbl-title { font-size: 9.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b71c1c; margin-bottom: 10px; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead tr { background: #1a1a2e; }
  table.items thead th { color: #fff; font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; padding: 11px 14px; text-align: left; }
  table.items thead th.r { text-align: right; }
  table.items tbody tr:nth-child(even) { background: #fdf8f7; }
  table.items tbody td { padding: 14px 14px; border-bottom: 1px solid #f0eeec; font-size: 13px; vertical-align: top; }
  table.items tbody td.r { text-align: right; font-weight: 600; color: #1a1a2e; }
  .prod-name { font-weight: 700; color: #1a1a2e; }
  .prod-meta { font-size: 11px; color: #888; margin-top: 3px; line-height: 1.5; }

  /* ── TOTALS ── */
  .totals-wrap { padding: 18px 36px 22px; display: flex; justify-content: flex-end; }
  .totals-box { width: 320px; border: 1px solid #f0eeec; border-radius: 8px; overflow: hidden; }
  .totals-box table { width: 100%; border-collapse: collapse; }
  .totals-box table td { padding: 9px 16px; font-size: 13px; border-bottom: 1px solid #f5f5f5; }
  .totals-box table tr:last-child td { border-bottom: none; }
  .tot-lbl { color: #888; }
  .tot-val { text-align: right; font-weight: 600; }
  .tot-val.paid { color: #1e7d32; }
  .tot-val.due { color: #b71c1c; }
  .grand td { background: #1a1a2e !important; color: #fff !important; font-size: 15px !important; font-weight: 700 !important; padding: 12px 16px !important; }

  /* ── AMOUNT IN WORDS ── */
  .words-row { margin: 0 36px; border: 1px solid #f0eeec; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; }
  .words-lbl { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #b71c1c; margin-bottom: 3px; }
  .words-val { font-size: 12px; font-style: italic; color: #333; line-height: 1.4; }

  /* ── FOOTER ── */
  .ft { background: #1a1a2e; padding: 18px 36px; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .ft-bank { font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.75; }
  .ft-bank strong { display: block; font-size: 12px; color: #fff; margin-bottom: 2px; }
  .ft-sig { text-align: right; }
  .sig-name { border-top: 1px solid rgba(255,255,255,0.3); margin-top: 32px; padding-top: 7px; font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; }
  .sig-title { font-size: 10.5px; color: rgba(255,255,255,0.6); margin-top: 2px; }
  .sig-company { font-size: 10.5px; color: rgba(255,255,255,0.5); margin-top: 1px; }

  /* ── DISCLAIMER ── */
  .disclaimer { background: #f8f8f8; border-top: 1px solid #eee; padding: 9px 36px; font-size: 10px; color: #999; text-align: center; line-height: 1.5; }

  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; border-radius: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hd">
    <div class="hd-left">
      ${logoHtml}
      <div class="hd-company">
        <strong>${co.name}</strong>
        ${co.address}<br/>
        TIN: ${co.tin}<br/>
        Tel: ${co.phone}&nbsp;&nbsp;|&nbsp;&nbsp;${co.email}
      </div>
    </div>
    <div class="hd-right">
      <div class="doc-word">INVOICE</div>
      <div class="doc-num">${invoice.number}</div>
      <table class="doc-dates">
        <tr><td>Date Issued:</td><td>${fmtDate(invoice.date)}</td></tr>
        ${invoice.due_date ? `<tr><td>Due Date:</td><td>${fmtDate(invoice.due_date)}</td></tr>` : ''}
      </table>
      <div class="status-pill" style="background:${balance <= 0 ? '#e6f4ea' : isOverdue ? '#fdeaea' : '#fff4e0'};color:${balance <= 0 ? '#1e7d32' : isOverdue ? '#b71c1c' : '#a86412'};">
        ${balance <= 0 ? 'Paid in full' : isOverdue ? 'Overdue' : 'Awaiting payment'}
      </div>
    </div>
  </div>

  <!-- ADDRESSES -->
  <div class="addr-row">
    <div class="addr-cell">
      <div class="addr-lbl">From (Seller)</div>
      <table class="addr-tbl">
        <tr><td>Company:</td><td>${co.name}</td></tr>
        <tr><td>TIN:</td><td>${co.tin}</td></tr>
        <tr><td>Bank:</td><td>${co.bank_name}</td></tr>
        <tr><td>Acc. No:</td><td>${co.bank_account}</td></tr>
        <tr><td>Tel:</td><td>${co.phone}</td></tr>
        <tr><td>Email:</td><td>${co.email}</td></tr>
      </table>
    </div>
    <div class="addr-cell">
      <div class="addr-lbl">To (Buyer)</div>
      <table class="addr-tbl">
        <tr><td>${customer?.customer_type === 'COMPANY' ? 'Company:' : 'Name:'}</td><td>${clientName || '—'}</td></tr>
        ${clientTin ? `<tr><td>TIN:</td><td>${clientTin}</td></tr>` : ''}
        ${clientContact ? `<tr><td>Contact:</td><td>${clientContact}</td></tr>` : ''}
        ${clientLocation ? `<tr><td>Location:</td><td>${clientLocation}</td></tr>` : ''}
        <tr><td>Currency:</td><td>RWF (Rwandan Franc)</td></tr>
      </table>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <div class="tbl-wrap">
    <div class="tbl-title">Line Items</div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:36px;">#</th>
          <th>Description</th>
          <th class="r" style="width:100px;">Qty (units)</th>
          <th class="r" style="width:120px;">Unit Price (RWF)</th>
          <th class="r" style="width:130px;">Total (RWF)</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals-wrap">
    <div class="totals-box">
      <table>
        <tr><td class="tot-lbl">Subtotal</td><td class="tot-val">${fmt(invoice.subtotal)} RWF</td></tr>
        ${paid > 0 ? `<tr><td class="tot-lbl">Paid</td><td class="tot-val paid">−${fmt(paid)} RWF</td></tr>` : ''}
        <tr class="grand"><td>${balance <= 0 ? 'Total Paid' : 'Balance Due'}</td><td style="text-align:right;">${fmt(balance <= 0 ? invoice.total : balance)} RWF</td></tr>
      </table>
    </div>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words-row">
    <div class="words-lbl">Amount in words</div>
    <div class="words-val">${amountWords} Rwandan Francs only &nbsp;(RWF ${fmt(invoice.total)})</div>
  </div>

  <!-- FOOTER -->
  <div class="ft">
    <div class="ft-bank">
      <strong>Payment Instructions</strong>
      Bank: ${co.bank_name}<br/>
      Account Name: ${co.name}<br/>
      Account No: ${co.bank_account}<br/>
      Reference: ${invoice.number}
    </div>
    <div class="ft-sig">
      <div class="sig-name">${co.director_name}</div>
      <div class="sig-title">${co.director_title}</div>
      <div class="sig-company">${co.name}</div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    This is a tax invoice issued by ${co.name}.
    &nbsp;|&nbsp; All amounts in Rwandan Francs (RWF)
    ${invoice.due_date ? `&nbsp;|&nbsp; Payment due: ${fmtDate(invoice.due_date)}` : ''}
  </div>

</div>
</body>
</html>`

  return { html, number: invoice.number }
}

export function registerInvoiceHandlers(): void {
  handle<void, InvoiceWithComputed[]>('invoices:list', null, async () => {
    const invoices = await prisma.invoice.findMany({
      include: { order: { include: { customer: true } }, items: true, payments: true },
      orderBy: { date: 'desc' }
    })
    return invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
      const balance = inv.total - paid
      // Always compute is_overdue dynamically, don't rely on the stored flag
      const is_overdue = computeIsOverdue(inv, paid)
      return { ...inv, paid, balance, is_overdue }
    })
  })

  handle<CreateInvoicePayload, InvoiceWithDetail>(
    'invoices:create',
    null,
    async ({ orderId, due_date }) => {
      if (!orderId) throw new BadRequestError('orderId is required')

      const order = await prisma.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: { customer: true }
      })
      if (!order) throw new NotFoundError('Order not found')

      const existingInvoice = await prisma.invoice.findFirst({ where: { orderId } })
      if (existingInvoice) throw new BadRequestError(`This order was already invoiced as ${existingInvoice.number}`)

      const year = new Date().getFullYear()
      // Use a transaction so count + create are atomic, prevents duplicate numbers under concurrent calls
      return prisma.$transaction(async (tx) => {
        const count = await tx.invoice.count({ where: { number: { startsWith: `OCL-${year}-` } } })
        const number = `OCL-${year}-${String(count + 1).padStart(3, '0')}`
        return tx.invoice.create({
          data: {
            number,
            orderId,
            due_date: due_date ? new Date(due_date) : undefined,
            subtotal: order.total_amount,
            total: order.total_amount,
            items: {
              create: [
                {
                  description: 'Bricks Supply',
                  brick_type: order.brick_type,
                  quality_grade: order.quality_grade,
                  quantity: order.quantity,
                  unit_price: order.unit_price,
                  total: order.total_amount
                }
              ]
            }
          },
          include: { items: true, order: { include: { customer: true } }, payments: true }
        })
      })
    },
    { resource: 'invoice', action: 'CREATE' }
  )

  handle<GetInvoicePayload, InvoiceWithComputed>('invoices:get', null, async ({ id }) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, order: { include: { customer: true } }, payments: true }
    })
    if (!invoice) throw new NotFoundError('Invoice not found')
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0)
    const is_overdue = computeIsOverdue(invoice, paid)
    return { ...invoice, paid, balance: invoice.total - paid, is_overdue }
  })

  handle<InvoicePdfPayload, InvoicePdfResult>('invoices:pdf', null, async ({ id }) => {
    const doc = await buildInvoiceHtml(id)
    if (!doc) throw new NotFoundError('Invoice not found')
    return { html: doc.html, filename: `Invoice-${doc.number}.pdf` }
  })

  handle<DeleteInvoicePayload, { deleted: boolean }>(
    'invoices:delete',
    ['ADMIN', 'ACCOUNTANT'],
    async ({ id }) => {
      const invoice = await prisma.invoice.findUnique({ where: { id } })
      if (!invoice) throw new NotFoundError('Invoice not found')
      // Payments and items are child rows with no cascade delete configured on the schema,
      // so they are removed first, then the invoice, all in one transaction so a failure
      // partway through never leaves an orphaned payment/item behind.
      await prisma.$transaction(async (tx) => {
        await tx.payment.deleteMany({ where: { invoiceId: id } })
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
        await tx.invoice.delete({ where: { id } })
      })
      return { deleted: true }
    },
    { resource: 'invoice', action: 'DELETE' }
  )
}
