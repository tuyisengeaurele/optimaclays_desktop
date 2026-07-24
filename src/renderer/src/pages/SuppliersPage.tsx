import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supplierApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage } from '../hooks/useToastHelper';

const MATERIAL_OPTIONS = [
  'CLAY', 'SAND', 'FUEL_FIREWOOD', 'FUEL_COAL', 'DIESEL', 'CEMENT', 'OTHER',
];

const EMPTY = { name: '', contact_name: '', phone: '', material_types: [] as string[], payment_terms: '', notes: '' };

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then(r => r.data.data),
  });

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setModal(true); }
  function openEdit(s: any) {
    setEditing(s);
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', material_types: s.material_types || [], payment_terms: s.payment_terms || '', notes: s.notes || '' });
    setModal(true);
  }

  function toggleMaterial(m: string) {
    setForm(f => ({
      ...f,
      material_types: f.material_types.includes(m) ? f.material_types.filter(x => x !== m) : [...f.material_types, m],
    }));
  }

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) => editing ? supplierApi.update(editing.id, data) : supplierApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast(editing ? 'Supplier updated' : 'Supplier added', 'success'); setModal(false); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => supplierApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast('Supplier removed', 'success'); setDeleteId(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-accent">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Raw material suppliers</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}><Plus size={16} /> Add Supplier</button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Supplier', 'Contact', 'Phone', 'Materials', 'Payment Terms', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s: any) => (
                  <tr key={s.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3 font-semibold text-accent">{s.name}</td>
                    <td className="px-3 py-3">{s.contact_name || '—'}</td>
                    <td className="px-3 py-3">{s.phone || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.material_types || []).map((m: string) => (
                          <span key={m} className="badge bg-blue-50 text-blue-700 text-xs">{m.replace(/_/g, ' ')}</span>
                        ))}
                        {!s.material_types?.length && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{s.payment_terms || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} className="text-xs text-primary hover:underline flex items-center gap-1"><Pencil size={12} /> Edit</button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => setDeleteId(s.id)} className="text-xs text-danger hover:underline"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No suppliers yet. Click <strong>Add Supplier</strong> to start.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name <span className="text-primary">*</span></label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <input className="input" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. Net 30 days" />
            </div>
          </div>
          <div>
            <label className="label">Materials Supplied</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {MATERIAL_OPTIONS.map(m => (
                <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.material_types.includes(m)} onChange={() => toggleMaterial(m)} className="rounded" />
                  {m.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving...' : editing ? 'Update' : 'Add Supplier'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Remove Supplier" message="Remove this supplier? This cannot be undone." onConfirm={() => del.mutate(deleteId!)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
