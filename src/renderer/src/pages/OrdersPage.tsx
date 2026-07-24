import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { orderApi, customerApi, proformaApi, priceCatalogueApi, inventoryApi } from '../services/api';
import { Order } from '../types';
import Modal from '../components/ui/Modal';
import Badge, { statusBadge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate, fmtRWF, toDateInputValue } from '../hooks/useToastHelper';
import { PRODUCTS, getBrickLabel } from '../constants/products';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const BRICK_TYPES = Object.keys(PRODUCTS);
const GRADES = ['GRADE_A','GRADE_B','REJECT'];
// DELIVERED is set automatically when the linked delivery is completed, not chosen manually here.
const STATUSES = ['PENDING','CONFIRMED','IN_PRODUCTION','READY','CANCELLED'];

const EMPTY = { customerId: '', brick_type: 'BRICK_10', quality_grade: 'GRADE_A', quantity: 0, unit_price: 0, order_date: new Date().toISOString().slice(0,10), required_delivery_date: '', notes: '' };

export default function OrdersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [modal, setModal] = useState<'create' | 'edit' | 'status' | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: catalogue = [] } = useQuery({
    queryKey: ['price-catalogue'],
    queryFn: () => priceCatalogueApi.list().then(r => r.data.data),
  });
  const priceMap = Object.fromEntries((catalogue as any[]).map((p: any) => [p.brick_type, p.unit_price]));

  const { data: finishedGoods } = useQuery<any>({
    queryKey: ['inventory-finished'],
    queryFn: () => inventoryApi.listFinished().then(r => r.data.data),
  });
  const stockSummary: any[] = finishedGoods?.summary || [];
  const availableStock = stockSummary.find(
    (s: any) => s.brick_type === form.brick_type && s.quality_grade === form.quality_grade
  )?.current_stock ?? 0;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderApi.list().then(r => r.data.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.list().then(r => r.data.data),
  });

  const createOrder = useMutation({
    mutationFn: (data: any) => orderApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Order created', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => orderApi.updateStatus(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Status updated', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) => orderApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Order deleted', 'success'); setDeleteId(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => orderApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast('Order updated', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const generateProforma = useMutation({
    mutationFn: (orderId: string) => proformaApi.create({ orderId }),
    onSuccess: (res) => {
      const proforma = res.data.data;
      proformaApi.downloadPdf(proforma.id).catch(err => toast(getErrorMessage(err), 'error'));
      toast('Proforma invoice generated', 'success');
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function openEdit(o: Order) {
    setSelected(o);
    setForm({
      customerId: (o as any).customerId || '',
      brick_type: o.brick_type,
      quality_grade: o.quality_grade,
      quantity: o.quantity,
      unit_price: o.unit_price,
      order_date: toDateInputValue(o.order_date),
      required_delivery_date: toDateInputValue((o as any).required_delivery_date),
      notes: o.notes || '',
      custom_name: (o as any).custom_name || '',
    });
    setModal('edit');
  }

  function handleBrickTypeChange(brick_type: string) {
    const cataloguePrice = priceMap[brick_type];
    setForm((f: any) => ({
      ...f,
      brick_type,
      ...(cataloguePrice != null && f.unit_price === 0 ? { unit_price: cataloguePrice } : {}),
    }));
  }

  const totalAmount = (form.quantity || 0) * (form.unit_price || 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent">Orders</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setForm({ ...EMPTY, unit_price: priceMap[EMPTY.brick_type] ?? 0 }); setModal('create'); }}>
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Customer','Brick Type','Grade','Qty','Total','Date','Status','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: Order) => (
                  <tr key={o.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3 font-medium">{o.customer?.company_name || o.customer?.full_name || '-'}</td>
                    <td className="px-3 py-3">{getBrickLabel(o.brick_type, o.custom_name)}</td>
                    <td className="px-3 py-3"><Badge variant={o.quality_grade === 'GRADE_A' ? 'success' : o.quality_grade === 'GRADE_B' ? 'warning' : 'danger'}>{o.quality_grade}</Badge></td>
                    <td className="px-3 py-3">{o.quantity?.toLocaleString()}</td>
                    <td className="px-3 py-3 font-medium">{fmtRWF(o.total_amount)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{fmtDate(o.order_date)}</td>
                    <td className="px-3 py-3"><Badge variant={statusBadge(o.status)}>{o.status}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 items-center flex-wrap">
                        <button title="Update Status" onClick={() => { setSelected(o); setModal('status'); }} className="text-xs text-primary hover:underline">Status</button>
                        <span className="text-muted-foreground">·</span>
                        <button title="Proforma Invoice" onClick={() => generateProforma.mutate(o.id)} className="text-xs text-accent hover:underline flex items-center gap-1">
                          <FileText size={11} /> PRO
                        </button>
                        {o.status === 'PENDING' && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <button title="Amend Order" onClick={() => openEdit(o)} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                              <Pencil size={11} /> Edit
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <button title="Delete Order" onClick={() => setDeleteId(o.id)} className="text-xs text-danger hover:underline flex items-center gap-1">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Order Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal open onClose={() => setModal(null)} title={modal === 'edit' ? 'Amend Order' : 'New Order'} size="lg">
          <form onSubmit={e => {
            e.preventDefault();
            if (modal === 'edit' && selected) {
              updateOrder.mutate({ id: selected.id, data: { ...form, total_amount: totalAmount } });
            } else {
              createOrder.mutate({ ...form, total_amount: totalAmount });
            }
          }} className="space-y-4">
            {modal === 'edit' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                Amendments are only allowed on PENDING orders.
              </div>
            )}
            <div>
              <label className="label">Customer <span className="text-primary">*</span></label>
              <select className="input" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required disabled={modal === 'edit'}>
                <option value="">-- Select Customer --</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Brick Type</label>
                <select className="input" value={form.brick_type} onChange={e => handleBrickTypeChange(e.target.value)}>
                  {BRICK_TYPES.map(b => <option key={b} value={b}>{PRODUCTS[b].name}{b !== 'CUSTOM' ? ` (${PRODUCTS[b].dimensions})` : ''}</option>)}
                </select>
              </div>
              {form.brick_type === 'CUSTOM' && (
                <div><label className="label">Custom Name</label><input className="input" value={form.custom_name || ''} onChange={e => setForm({ ...form, custom_name: e.target.value })} /></div>
              )}
              <div>
                <label className="label">Quality Grade</label>
                <select className="input" value={form.quality_grade} onChange={e => setForm({ ...form, quality_grade: e.target.value })}>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">
                  Quantity
                  {form.brick_type !== 'CUSTOM' && (
                    <span className={`ml-1 text-xs ${form.quantity > availableStock ? 'text-danger' : 'text-muted-foreground'}`}>
                      (available: {availableStock.toLocaleString()})
                    </span>
                  )}
                </label>
                <input type="number" className="input" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="label">Unit Price (RWF){priceMap[form.brick_type] && <span className="ml-1 text-xs text-muted-foreground">(catalogue: {fmtRWF(priceMap[form.brick_type])})</span>}</label>
                <input type="number" className="input" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })} required />
              </div>
            </div>
            {totalAmount > 0 && (
              <div className="bg-background p-3 rounded-lg text-sm">
                <strong>Total Amount:</strong> {fmtRWF(totalAmount)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Order Date</label><input type="date" className="input" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} /></div>
              <div><label className="label">Required Delivery Date</label><input type="date" className="input" value={form.required_delivery_date} onChange={e => setForm({ ...form, required_delivery_date: e.target.value })} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={createOrder.isPending || updateOrder.isPending}>
                {createOrder.isPending || updateOrder.isPending ? 'Saving...' : modal === 'edit' ? 'Save Changes' : 'Create Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Order"
        message="This will permanently remove the order. This cannot be undone."
        onConfirm={() => deleteOrder.mutate(deleteId!)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Update Status Modal */}
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Update Order Status">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Order: {selected?.customer?.company_name || selected?.customer?.full_name}</p>
          {selected?.status === 'DELIVERED' ? (
            <p className="text-sm text-muted-foreground">This order has been delivered. Its status is set automatically from the linked delivery and cannot be changed here.</p>
          ) : (
            <div>
              <label className="label">New Status</label>
              <select className="input" defaultValue={selected?.status} onChange={e => updateStatus.mutate({ id: selected!.id, status: e.target.value })}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          <button className="btn-outline w-full" onClick={() => setModal(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
