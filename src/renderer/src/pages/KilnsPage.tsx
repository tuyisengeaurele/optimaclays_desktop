import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { kilnApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate } from '../hooks/useToastHelper';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
};

const EMPTY = { name: '', capacity: 0, status: 'ACTIVE', last_service_date: '', notes: '' };

export default function KilnsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: kilns = [], isLoading } = useQuery({
    queryKey: ['kilns'],
    queryFn: () => kilnApi.list().then(r => r.data.data),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setModal(true);
  }

  function openEdit(k: any) {
    setEditing(k);
    setForm({
      name: k.name,
      capacity: k.capacity,
      status: k.status,
      last_service_date: k.last_service_date ? k.last_service_date.slice(0, 10) : '',
      notes: k.notes || '',
    });
    setModal(true);
  }

  const save = useMutation({
    mutationFn: (data: typeof EMPTY) =>
      editing ? kilnApi.update(editing.id, data) : kilnApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kilns'] });
      toast(editing ? 'Kiln updated' : 'Kiln created', 'success');
      setModal(false);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => kilnApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kilns'] });
      toast('Kiln deleted', 'success');
      setDeleteId(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-accent">Kilns</h1>
          <p className="text-sm text-gray-500 mt-1">Track kiln status and service history</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} /> Add Kiln
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Name', 'Capacity (bricks/firing)', 'Status', 'Last Serviced', 'Batches', 'Notes', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kilns.map((k: any) => (
                  <tr key={k.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3 font-semibold text-accent">{k.name}</td>
                    <td className="px-3 py-3">{k.capacity.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={`badge ${STATUS_COLORS[k.status] || 'bg-gray-100 text-gray-600'}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{k.last_service_date ? fmtDate(k.last_service_date) : <span className="text-muted-foreground">Not recorded</span>}</td>
                    <td className="px-3 py-3">{k._count?.batches ?? 0}</td>
                    <td className="px-3 py-3 text-muted-foreground">{k.notes || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(k)} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Pencil size={12} /> Edit
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button onClick={() => setDeleteId(k.id)} className="text-xs text-danger hover:underline flex items-center gap-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {kilns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      No kilns yet. Click <strong>Add Kiln</strong> to register your first kiln.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Kiln' : 'Add Kiln'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name <span className="text-primary">*</span></label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Kiln 1" />
            </div>
            <div>
              <label className="label">Capacity (bricks per firing)</label>
              <input type="number" className="input" min={0} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Under Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div>
              <label className="label">Last Service Date</label>
              <input type="date" className="input" value={form.last_service_date} onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : editing ? 'Update' : 'Add Kiln'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Kiln"
        message="Are you sure you want to delete this kiln? This cannot be undone."
        onConfirm={() => del.mutate(deleteId!)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
