import fs from 'fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { handle } from './handle'
import { BadRequestError, NotFoundError } from './errors'
import { LOGO_PATH } from './logoPath'

type ProformaWithDetail = Prisma.ProformaInvoiceGetPayload<{ include: { customer: true; order: true } }>

interface CreateProformaPayload {
  orderId?: string
  customerId?: string
  brick_type?: string | null
  custom_name?: string | null
  quantity?: number | string
  unit_price?: number | string
  notes?: string | null
  valid_until?: string
  payment_terms?: string | null
  delivery_period?: string | null
}

interface GetProformaPayload {
  id: string
}

interface DeleteProformaPayload {
  id: string
}

interface ProformaPdfPayload {
  id: string
}

interface ProformaPdfResult {
  html: string
  filename: string
}

function getNextProformaNumber(year: number, count: number): string {
  return `PRO-${year}-${String(count + 1).padStart(3, '0')}`
}

const PRODUCT_CATALOGUE: Record<string, { name: string; dimensions: string; application: string }> = {
  BRICK_10: { name: 'Brick 10', dimensions: '21 × 10 × 6.5 cm', application: 'Structural & non-structural walling' },
  PAVING_BLOCK: { name: 'Paving Block', dimensions: '20 × 10 × 6 cm', application: 'External paving & pathways' },
  HALF_BRICK: { name: 'Half Brick', dimensions: '21 × 5 × 6.5 cm', application: 'Finishing & decorative detailing' },
  LOW_ROCK_BOND: { name: 'Low Rock Bond', dimensions: '21 × 5.5 × 10 cm', application: 'Feature walls & landscaping' },
  CUSTOM: { name: 'Custom Product', dimensions: 'As specified', application: 'Custom order' }
}

function numberToWords(n: number): string {
  const ones = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen'
  ]
  const tensArr = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  function convert(num: number): string {
    if (num === 0) return ''
    if (num < 20) return ones[num] + ' '
    if (num < 100) return tensArr[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '') + ' '
    if (num < 1_000) return ones[Math.floor(num / 100)] + ' hundred ' + convert(num % 100)
    if (num < 1_000_000) return convert(Math.floor(num / 1_000)) + 'thousand ' + convert(num % 1_000)
    if (num < 1_000_000_000) return convert(Math.floor(num / 1_000_000)) + 'million ' + convert(num % 1_000_000)
    return convert(Math.floor(num / 1_000_000_000)) + 'billion ' + convert(num % 1_000_000_000)
  }

  const raw = convert(Math.round(n)).trim().replace(/\s+/g, ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

async function buildProformaHtml(id: string): Promise<{ html: string; number: string } | null> {
  const proforma = await prisma.proformaInvoice.findUnique({
    where: { id },
    include: { customer: true, order: true }
  })
  if (!proforma) return null

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

  const { customer } = proforma
  const fmt = (n: number): string => n.toLocaleString('en-RW')

  const brickCode = proforma.brick_type || proforma.order?.brick_type || 'CUSTOM'
  const product = PRODUCT_CATALOGUE[brickCode] || PRODUCT_CATALOGUE['CUSTOM']
  const isCustom = brickCode === 'CUSTOM'
  const brickLabel = isCustom ? proforma.custom_name || proforma.order?.custom_name || 'Custom' : product.name
  const brickDimensions = isCustom ? 'As specified' : product.dimensions
  const brickApplication = isCustom ? 'As specified' : product.application

  const qty = proforma.quantity ?? proforma.order?.quantity ?? 0
  const unitPrice = proforma.unit_price ?? proforma.order?.unit_price ?? 0
  const total = proforma.total

  const deliveryPeriod = proforma.delivery_period || 'To be confirmed'
  const paymentTerms = proforma.payment_terms || 'To be confirmed'
  const amountWords = numberToWords(total)

  const clientName = customer.customer_type === 'INDIVIDUAL' ? customer.full_name || '' : customer.company_name || ''
  const clientTin = customer.tin_number ? customer.tin_number : null
  const clientContact =
    customer.customer_type === 'INDIVIDUAL'
      ? customer.phone || ''
      : customer.contact_person_name
        ? `${customer.contact_person_name}${customer.contact_person_phone ? ' · ' + customer.contact_person_phone : ''}`
        : ''
  const clientLocation = customer.location || ''

  // Logo — embed as base64 so it prints offline
  let logoHtml = `<div style="width:80px;height:80px;background:rgba(255,255,255,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;">OPTIMA<br>CLAYS</div>`
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const b64 = fs.readFileSync(LOGO_PATH).toString('base64')
      logoHtml = `<img src="data:image/png;base64,${b64}" style="max-height:90px;max-width:200px;object-fit:contain;" alt="Optima Clays Ltd" />`
    }
  } catch {
    // fall back to the text logo above
  }

  const fmtDate = (d: Date): string => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Proforma Invoice ${proforma.number}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #eef0f4; }

  .page { max-width: 880px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 6px 32px rgba(0,0,0,0.13); }

  /* ── HEADER ── */
  .hd { background: #b71c1c; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .hd-left { display: flex; flex-direction: column; gap: 10px; }
  .hd-company { color: rgba(255,255,255,0.9); font-size: 11.5px; line-height: 1.65; margin-top: 4px; }
  .hd-company strong { display: block; font-size: 15px; font-weight: 700; color: #fff; letter-spacing: 0.3px; margin-bottom: 3px; }
  .hd-right { text-align: right; flex-shrink: 0; }
  .doc-word { font-size: 32px; font-weight: 800; color: #fff; letter-spacing: 3px; line-height: 1; }
  .doc-sub  { font-size: 12px; color: rgba(255,255,255,0.65); letter-spacing: 4px; margin-top: 2px; text-transform: uppercase; }
  .doc-num  { font-size: 16px; font-weight: 700; color: rgba(255,255,255,0.95); margin-top: 10px; }
  .doc-dates { margin-top: 6px; }
  .doc-dates td { font-size: 11.5px; color: rgba(255,255,255,0.75); padding: 1.5px 0; }
  .doc-dates td:first-child { padding-right: 12px; opacity: 0.6; }
  .doc-dates td:last-child  { font-weight: 600; color: rgba(255,255,255,0.95); }

  /* ── ADDRESS ROW ── */
  .addr-row { display: flex; border-bottom: 1.5px solid #f0f0f0; }
  .addr-cell { flex: 1; padding: 18px 36px; }
  .addr-cell + .addr-cell { border-left: 1px solid #f0f0f0; }
  .addr-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b71c1c; margin-bottom: 9px; }
  .addr-tbl td { font-size: 12.5px; padding: 2.5px 0; vertical-align: top; }
  .addr-tbl td:first-child { color: #999; width: 85px; }
  .addr-tbl td:last-child  { font-weight: 600; color: #1a1a2e; padding-left: 8px; }

  /* ── TERMS STRIP ── */
  .terms { background: #fafafa; border-bottom: 1.5px solid #f0f0f0; padding: 13px 36px; display: flex; gap: 0; flex-wrap: wrap; }
  .term-cell { flex: 1; min-width: 160px; padding-right: 20px; }
  .term-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #999; margin-bottom: 4px; }
  .term-val { font-size: 12.5px; font-weight: 600; color: #1a1a2e; line-height: 1.4; }

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
  .grand td { background: #1a1a2e !important; color: #fff !important; font-size: 15px !important; font-weight: 700 !important; padding: 12px 16px !important; }

  /* ── AMOUNT IN WORDS ── */
  .words-row { margin: 0 36px; border: 1px solid #f0eeec; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; }
  .words-lbl { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #b71c1c; margin-bottom: 3px; }
  .words-val { font-size: 12px; font-style: italic; color: #333; line-height: 1.4; }

  /* ── NOTES ── */
  .notes-row { margin: 0 36px 20px; border-left: 3px solid #b71c1c; padding: 8px 14px; background: #fffaf9; }
  .notes-lbl { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #b71c1c; margin-bottom: 3px; }
  .notes-val { font-size: 12px; color: #444; line-height: 1.5; }

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
      <div class="doc-word">PROFORMA</div>
      <div class="doc-sub">Invoice</div>
      <div class="doc-num">${proforma.number}</div>
      <table class="doc-dates">
        <tr><td>Date Issued:</td><td>${fmtDate(proforma.date_issued)}</td></tr>
        <tr><td>Valid Until:</td><td>${fmtDate(proforma.valid_until)}</td></tr>
      </table>
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
        <tr><td>${customer.customer_type === 'COMPANY' ? 'Company:' : 'Name:'}</td><td>${clientName || '—'}</td></tr>
        ${clientTin ? `<tr><td>TIN:</td><td>${clientTin}</td></tr>` : ''}
        ${clientContact ? `<tr><td>Contact:</td><td>${clientContact}</td></tr>` : ''}
        ${clientLocation ? `<tr><td>Location:</td><td>${clientLocation}</td></tr>` : ''}
        <tr><td>Currency:</td><td>RWF (Rwandan Franc)</td></tr>
      </table>
    </div>
  </div>

  <!-- TERMS -->
  <div class="terms">
    <div class="term-cell">
      <div class="term-lbl">Delivery Period</div>
      <div class="term-val">${deliveryPeriod}</div>
    </div>
    <div class="term-cell">
      <div class="term-lbl">Payment Method</div>
      <div class="term-val">Bank Transfer via ${co.bank_name}</div>
    </div>
  </div>
  <div class="terms" style="border-top:none;padding-top:0;">
    <div class="term-cell" style="min-width:100%;flex:unset;">
      <div class="term-lbl">Payment Terms</div>
      <div class="term-val">${paymentTerms}</div>
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
      <tbody>
        <tr>
          <td>01</td>
          <td>
            <div class="prod-name">${brickLabel}</div>
            <div class="prod-meta">
              Dimensions: ${brickDimensions}<br/>
              Application: ${brickApplication}
            </div>
          </td>
          <td class="r">${fmt(qty)}</td>
          <td class="r">${fmt(unitPrice)}</td>
          <td class="r">${fmt(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals-wrap">
    <div class="totals-box">
      <table>
        <tr><td class="tot-lbl">Subtotal</td><td class="tot-val">${fmt(total)} RWF</td></tr>
        <tr class="grand"><td>Total Due</td><td style="text-align:right;">${fmt(total)} RWF</td></tr>
      </table>
    </div>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="words-row">
    <div class="words-lbl">Amount in words</div>
    <div class="words-val">${amountWords} Rwandan Francs only &nbsp;(RWF ${fmt(total)})</div>
  </div>

  ${
    proforma.notes
      ? `
  <!-- NOTES -->
  <div class="notes-row">
    <div class="notes-lbl">Additional Notes</div>
    <div class="notes-val">${proforma.notes}</div>
  </div>`
      : ''
  }

  <!-- FOOTER -->
  <div class="ft">
    <div class="ft-bank">
      <strong>Payment Instructions</strong>
      Bank: ${co.bank_name}<br/>
      Account Name: ${co.name}<br/>
      Account No: ${co.bank_account}<br/>
      Reference: ${proforma.number}
    </div>
    <div class="ft-sig">
      <div class="sig-name">${co.director_name}</div>
      <div class="sig-title">${co.director_title}</div>
      <div class="sig-company">${co.name}</div>
    </div>
  </div>

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    This proforma invoice is not a tax invoice and does not constitute a binding contract until payment is received.
    &nbsp;|&nbsp; Valid until: ${fmtDate(proforma.valid_until)}
    &nbsp;|&nbsp; All amounts in Rwandan Francs (RWF)
  </div>

</div>
</body>
</html>`

  return { html, number: proforma.number }
}

export function registerProformaHandlers(): void {
  handle<void, ProformaWithDetail[]>('proformas:list', null, async () =>
    prisma.proformaInvoice.findMany({
      include: { customer: true, order: true },
      orderBy: { date_issued: 'desc' }
    })
  )

  handle<CreateProformaPayload, ProformaWithDetail>(
    'proformas:create',
    null,
    async (payload) => {
      const { orderId } = payload
      let { customerId, brick_type, custom_name, quantity, unit_price, valid_until, payment_terms, delivery_period } = payload
      const { notes } = payload

      // Generating a proforma from an existing order (the Orders page "PRO" action) only
      // sends orderId, relying on the order's own fields rather than asking the caller to
      // repeat them.
      if (orderId) {
        const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } })
        if (!order) throw new NotFoundError('Order not found')
        customerId = customerId ?? order.customerId
        brick_type = brick_type ?? order.brick_type
        custom_name = custom_name ?? order.custom_name
        quantity = quantity ?? order.quantity
        unit_price = unit_price ?? order.unit_price
      }

      if (!customerId) throw new BadRequestError('Customer is required')
      if (!brick_type) throw new BadRequestError('Brick type is required')
      if (!quantity) throw new BadRequestError('Quantity is required')
      if (!unit_price) throw new BadRequestError('Unit price is required')

      const customer = await prisma.customer.findUnique({ where: { id: customerId } })
      if (!customer) throw new NotFoundError('Customer not found')

      const qty = Number(quantity)
      const price = Number(unit_price)
      const subtotal = qty * price

      const year = new Date().getFullYear()
      const dateIssued = new Date()
      const validUntil = valid_until ? new Date(valid_until) : new Date(dateIssued.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Fetch default terms from company settings if caller did not supply them
      let resolvedPaymentTerms = payment_terms || null
      let resolvedDeliveryPeriod = delivery_period || null
      if (!resolvedPaymentTerms || !resolvedDeliveryPeriod) {
        const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } })
        if (settings) {
          if (!resolvedPaymentTerms) resolvedPaymentTerms = settings.default_payment_terms || null
          if (!resolvedDeliveryPeriod) resolvedDeliveryPeriod = settings.default_delivery_period || null
        }
      }

      // Transaction so the running count + create stay atomic — prevents duplicate
      // proforma numbers under concurrent calls.
      return prisma.$transaction(async (tx) => {
        const count = await tx.proformaInvoice.count({ where: { number: { startsWith: `PRO-${year}-` } } })
        const number = getNextProformaNumber(year, count)
        return tx.proformaInvoice.create({
          data: {
            number,
            customerId: customerId as string,
            orderId: orderId || null,
            brick_type,
            custom_name: custom_name || null,
            quantity: qty,
            unit_price: price,
            date_issued: dateIssued,
            valid_until: validUntil,
            subtotal,
            total: subtotal,
            notes: notes || null,
            payment_terms: resolvedPaymentTerms,
            delivery_period: resolvedDeliveryPeriod
          },
          include: { customer: true, order: true }
        })
      })
    },
    { resource: 'proforma', action: 'CREATE' }
  )

  handle<GetProformaPayload, ProformaWithDetail>('proformas:get', null, async ({ id }) => {
    const proforma = await prisma.proformaInvoice.findUnique({
      where: { id },
      include: { customer: true, order: true }
    })
    if (!proforma) throw new NotFoundError('Proforma invoice not found')
    return proforma
  })

  handle<ProformaPdfPayload, ProformaPdfResult>('proformas:pdf', null, async ({ id }) => {
    const doc = await buildProformaHtml(id)
    if (!doc) throw new NotFoundError('Proforma invoice not found')
    return { html: doc.html, filename: `Proforma-${doc.number}.pdf` }
  })

  handle<DeleteProformaPayload, { deleted: boolean }>(
    'proformas:delete',
    ['ADMIN'],
    async ({ id }) => {
      const proforma = await prisma.proformaInvoice.findUnique({ where: { id } })
      if (!proforma) throw new NotFoundError('Proforma invoice not found')
      await prisma.proformaInvoice.delete({ where: { id } })
      return { deleted: true }
    },
    { resource: 'proforma', action: 'DELETE' }
  )
}
