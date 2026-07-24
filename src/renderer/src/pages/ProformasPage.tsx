import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Trash2 } from 'lucide-react';
import { proformaApi, customerApi, settingsApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate, fmtRWF } from '../hooks/useToastHelper';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { PRODUCTS, getBrickLabel } from '../constants/products';

const BRICK_TYPES = Object.keys(PRODUCTS);

const EMPTY_FORM = {
  customerId: '',
  brick_type: 'BRICK_10',
  custom_name: '',
  quantity: 0,
  unit_price: 0,
  notes: '',
  valid_until: '',
  payment_terms: '',
  delivery_period: '',
};

export default function ProformasPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: proformas = [], isLoading } = useQuery({
    queryKey: ['proformas'],
    queryFn: () => proformaApi.list().then(r => r.data.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.list().then(r => r.data.data),
  });

  const { data: companySettings } = useQuery({
    queryKey: ['settings-company'],
    queryFn: () => settingsApi.getCompany().then(r => r.data.data),
  });

  function openModal() {
    setForm({
      ...EMPTY_FORM,
      payment_terms:   companySettings?.default_payment_terms   || '',
      delivery_period: companySettings?.default_delivery_period || '',
    });
    setModal(true);
  }

  const createProforma = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => proformaApi.create({
      customerId:      data.customerId,
      brick_type:      data.brick_type,
      custom_name:     data.custom_name  || undefined,
      quantity:        Number(data.quantity),
      unit_price:      Number(data.unit_price),
      notes:           data.notes           || undefined,
      valid_until:     data.valid_until      || undefined,
      payment_terms:   data.payment_terms    || undefined,
      delivery_period: data.delivery_period  || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      toast('Proforma invoice created', 'success');
      setModal(false);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const deleteProforma = useMutation({
    mutationFn: (id: string) => proformaApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      toast('Proforma deleted', 'success');
      setDeleteId(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const total = Number(form.quantity) * Number(form.unit_price);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-accent">Proforma Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Issue preliminary invoices to customers before confirming an order</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openModal}>
          <Plus size={16} /> New Proforma
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Proforma #', 'Customer', 'Product', 'Qty', 'Amount', 'Date Issued', 'Valid Until', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proformas.map((p: any) => {
                  const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                  const brickType = p.brick_type || p.order?.brick_type;
                  const customName = p.custom_name || p.order?.custom_name;
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-background">
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-accent">{p.number}</td>
                      <td className="px-3 py-3 font-medium">{p.customer?.company_name || p.customer?.full_name || '-'}</td>
                      <td className="px-3 py-3">{brickType ? getBrickLabel(brickType, customName) : '-'}</td>
                      <td className="px-3 py-3">{(p.quantity ?? p.order?.quantity ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-3 font-semibold">{fmtRWF(p.total)}</td>
                      <td className="px-3 py-3">{fmtDate(p.date_issued)}</td>
                      <td className="px-3 py-3">
                        <span className={isExpired ? 'text-danger text-xs font-medium' : 'text-xs'}>
                          {fmtDate(p.valid_until)}{isExpired ? ' (expired)' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => proformaApi.downloadPdf(p.id).catch(err => toast(getErrorMessage(err), 'error'))}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download size={13} /> Download PDF
                          </button>
                          {isAdmin && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => setDeleteId(p.id)}
                                className="flex items-center text-xs text-danger hover:underline"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {proformas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      No proforma invoices yet. Click <strong>New Proforma</strong> to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Proforma Invoice" size="lg">
        <form onSubmit={e => { e.preventDefault(); createProforma.mutate(form); }} className="space-y-4">

          {/* Customer */}
          <div>
            <label className="label">Customer <span className="text-primary">*</span></label>
            <select
              className="input"
              value={form.customerId}
              onChange={e => setForm({ ...form, customerId: e.target.value })}
              required
            >
              <option value="">-- Select customer --</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name}
                  {c.customer_type === 'COMPANY' && c.contact_person_name ? ` (${c.contact_person_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Brick Type <span className="text-primary">*</span></label>
              <select
                className="input"
                value={form.brick_type}
                onChange={e => setForm({ ...form, brick_type: e.target.value, custom_name: '' })}
                required
              >
                {BRICK_TYPES.map(b => (
                  <option key={b} value={b}>
                    {PRODUCTS[b].name}{b !== 'CUSTOM' ? ` (${PRODUCTS[b].dimensions})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {form.brick_type === 'CUSTOM' && (
              <div>
                <label className="label">Custom Name <span className="text-primary">*</span></label>
                <input
                  className="input"
                  value={form.custom_name}
                  onChange={e => setForm({ ...form, custom_name: e.target.value })}
                  placeholder="Describe the product"
                  required
                />
              </div>
            )}
          </div>

          {/* Quantity & price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity (units) <span className="text-primary">*</span></label>
              <input
                type="number" className="input" min={1}
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="label">Unit Price (RWF) <span className="text-primary">*</span></label>
              <input
                type="number" className="input" min={0}
                value={form.unit_price}
                onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Total preview */}
          {form.quantity > 0 && form.unit_price > 0 && (
            <div className="bg-background border border-border rounded-lg px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{form.quantity.toLocaleString()} × {fmtRWF(form.unit_price)}</span>
              <span className="font-bold text-accent text-base">{fmtRWF(total)} total</span>
            </div>
          )}

          {/* Validity */}
          <div>
            <label className="label">Valid Until <span className="text-xs text-muted-foreground">(optional, defaults to 30 days)</span></label>
            <input
              type="date" className="input"
              value={form.valid_until}
              onChange={e => setForm({ ...form, valid_until: e.target.value })}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Delivery period */}
          <div>
            <label className="label">Delivery Period</label>
            <input
              className="input"
              value={form.delivery_period}
              onChange={e => setForm({ ...form, delivery_period: e.target.value })}
              placeholder="e.g. 45 days from receipt of advance payment"
            />
          </div>

          {/* Payment terms */}
          <div>
            <label className="label">Payment Terms</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.payment_terms}
              onChange={e => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="e.g. 50% advance, 25% upon 75% completion, 25% before final delivery"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Additional Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Special instructions, scope of supply, etc."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createProforma.isPending}>
              {createProforma.isPending ? 'Generating...' : 'Generate Proforma'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Proforma Invoice"
        message="This will permanently remove the proforma invoice. This cannot be undone."
        onConfirm={() => deleteProforma.mutate(deleteId!)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
