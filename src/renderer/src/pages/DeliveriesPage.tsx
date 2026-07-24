import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Download, AlertTriangle } from 'lucide-react';
import { deliveryApi, orderApi } from '../services/api';
import Modal from '../components/ui/Modal';
import Badge, { statusBadge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate, fmtRWF } from '../hooks/useToastHelper';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['SCHEDULED','IN_TRANSIT','DELIVERED','RETURNED'];

export default function DeliveriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [modal, setModal] = useState<'create' | 'status' | 'damage' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<any>({ orderId: '', vehicle_plate: '', driver_name: '', scheduled_date: '', quantity_loaded: 0, delivery_fee: 0 });
  const [statusForm, setStatusForm] = useState<any>({ status: 'SCHEDULED', actual_delivery_date: new Date().toISOString().slice(0,10), notes: '', receiver_name: '' });
  const [damageForm, setDamageForm] = useState<any>({ damage_qty: 0, damage_notes: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => deliveryApi.list().then(r => r.data.data),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderApi.list().then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: (data: any) => deliveryApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); toast('Delivery scheduled', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const deleteDelivery = useMutation({
    mutationFn: (id: string) => deliveryApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); toast('Delivery deleted', 'success'); setDeleteId(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, ...data }: any) => deliveryApi.updateStatus(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); toast('Status updated', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const recordDamage = useMutation({
    mutationFn: ({ id, ...data }: any) => deliveryApi.recordDamage(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); toast('Damage recorded', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent">Deliveries</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setForm({ orderId: '', vehicle_plate: '', driver_name: '', scheduled_date: new Date().toISOString().slice(0,10), quantity_loaded: 0, delivery_fee: 0 }); setModal('create'); }}>
          <Plus size={16} /> Schedule Delivery
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Customer','Driver','Vehicle','Scheduled','Qty','Delivery Fee','Status','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d: any) => {
                  const cost = d.costs?.reduce((s: number, c: any) => s + (c.driver_fee || 0), 0) || 0;
                  return (
                    <tr key={d.id} className="border-b border-border hover:bg-background">
                      <td className="px-3 py-3">{d.order?.customer?.company_name || d.order?.customer?.full_name || '-'}</td>
                      <td className="px-3 py-3">{d.driver_name || '-'}</td>
                      <td className="px-3 py-3 font-mono text-xs">{d.vehicle_plate || '-'}</td>
                      <td className="px-3 py-3">{d.scheduled_date ? fmtDate(d.scheduled_date) : '-'}</td>
                      <td className="px-3 py-3">{d.quantity_loaded?.toLocaleString()}</td>
                      <td className="px-3 py-3">{fmtRWF(cost)}</td>
                      <td className="px-3 py-3"><Badge variant={statusBadge(d.status)}>{d.status}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 items-center flex-wrap">
                          <button onClick={() => { setSelected(d); setStatusForm({ status: d.status, actual_delivery_date: new Date().toISOString().slice(0,10), notes: '', receiver_name: d.receiver_name || '' }); setModal('status'); }} className="text-xs text-primary hover:underline">Update</button>
                          <span className="text-muted-foreground">·</span>
                          <button type="button" onClick={() => deliveryApi.downloadWaybillPdf(d.id).catch(err => toast(getErrorMessage(err), 'error'))} title="Print Waybill" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                            <Download size={11} /> Waybill
                          </button>
                          {d.status === 'DELIVERED' && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <button onClick={() => { setSelected(d); setDamageForm({ damage_qty: d.damage_qty || 0, damage_notes: d.damage_notes || '' }); setModal('damage'); }} className="text-xs text-orange-600 hover:underline flex items-center gap-0.5">
                                <AlertTriangle size={11} /> Damage
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <button onClick={() => setDeleteId(d.id)} className="flex items-center text-xs text-danger hover:underline" title="Delete Delivery">
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {deliveries.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No deliveries yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Delivery"
        message="This will permanently remove the delivery record. This cannot be undone."
        onConfirm={() => deleteDelivery.mutate(deleteId!)}
        onCancel={() => setDeleteId(null)}
      />

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Schedule Delivery" size="lg">
        <form onSubmit={e => { e.preventDefault(); create.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Order <span className="text-primary">*</span></label>
            <select className="input" value={form.orderId} onChange={e => {
              const order = orders.find((o: any) => o.id === e.target.value);
              setForm({ ...form, orderId: e.target.value, quantity_loaded: order?.quantity ?? 0 });
            }} required>
              <option value="">-- Select Order --</option>
              {orders.filter((o: any) => o.status === 'READY').map((o: any) => (
                <option key={o.id} value={o.id}>{o.customer?.company_name || o.customer?.full_name}: {o.brick_type === 'CUSTOM' ? (o.custom_name || 'Custom') : o.brick_type.replace(/_/g, ' ')} ({o.quantity?.toLocaleString()})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Driver Name</label><input className="input" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} /></div>
            <div><label className="label">Vehicle Plate</label><input className="input" value={form.vehicle_plate} onChange={e => setForm({ ...form, vehicle_plate: e.target.value })} /></div>
            <div><label className="label">Scheduled Date</label><input type="date" className="input" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} /></div>
            <div><label className="label">Quantity Loaded <span className="text-xs text-muted-foreground">(from order, editable)</span></label><input type="number" className="input" value={form.quantity_loaded} onChange={e => setForm({ ...form, quantity_loaded: Number(e.target.value) })} /></div>
          </div>
          <div>
            <label className="label">Delivery Fee (RWF)</label>
            <input type="number" className="input" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: Number(e.target.value) })} min={0} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Saving...' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Update Delivery Status">
        <div className="space-y-4">
          <div>
            <label className="label">Status</label>
            <select className="input" value={statusForm.status} onChange={e => setStatusForm((f: any) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {statusForm.status === 'DELIVERED' && (
            <div>
              <label className="label">Receiver Name <span className="text-xs text-muted-foreground">(Proof of delivery)</span></label>
              <input className="input" placeholder="Name of person who received" value={statusForm.receiver_name} onChange={e => setStatusForm((f: any) => ({ ...f, receiver_name: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Actual Delivery Date</label>
            <input type="date" className="input" value={statusForm.actual_delivery_date} onChange={e => setStatusForm((f: any) => ({ ...f, actual_delivery_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={statusForm.notes} onChange={e => setStatusForm((f: any) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => updateStatus.mutate({ id: selected.id, ...statusForm })} disabled={updateStatus.isPending}>Update</button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'damage'} onClose={() => setModal(null)} title="Record Transport Damage">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Delivery for: <strong>{selected?.order?.customer?.company_name || selected?.order?.customer?.full_name}</strong>, {selected?.quantity_loaded?.toLocaleString()} bricks loaded</p>
          <div>
            <label className="label">Damaged Quantity</label>
            <input type="number" min={0} className="input" value={damageForm.damage_qty} onChange={e => setDamageForm((f: any) => ({ ...f, damage_qty: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Damage Notes</label>
            <textarea className="input" rows={3} value={damageForm.damage_notes} onChange={e => setDamageForm((f: any) => ({ ...f, damage_notes: e.target.value }))} placeholder="Describe the damage (cracks, breakage, etc.)" />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => recordDamage.mutate({ id: selected.id, ...damageForm })} disabled={recordDamage.isPending}>
              {recordDamage.isPending ? 'Saving...' : 'Record Damage'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
