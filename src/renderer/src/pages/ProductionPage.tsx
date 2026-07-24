import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { productionApi, kilnApi, inventoryApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ProductionBatch } from '../types';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate } from '../hooks/useToastHelper';
import { PRODUCTS } from '../constants/products';

const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'];
const OPEN_STAGES = ['RAW_MIXING', 'MOLDING', 'DRYING', 'KILN_FIRING', 'QUALITY_CHECK'];
const BRICK_TYPES = Object.keys(PRODUCTS);
const DEFECT_TYPES = ['CRACKING', 'UNDER_FIRING', 'OVER_FIRING', 'DIMENSION_ERROR', 'COLOUR_VARIATION', 'OTHER'];
const DISPOSITIONS = ['REWORK', 'DOWNGRADE_TO_B', 'DISPOSE'];
const MATERIALS = ['CLAY', 'SAND', 'FUEL_FIREWOOD', 'FUEL_COAL', 'DIESEL', 'CEMENT', 'OTHER'];

const EMPTY_START = {
  date: new Date().toISOString().slice(0, 10), shift: 'MORNING', kilnId: '', kiln_number: '',
  brick_type: 'BRICK_10', custom_name: '', bricks_target: 0, current_stage: 'RAW_MIXING',
  materials_used: [] as { material_type: string; quantity_used: number }[],
};

const EMPTY_COMPLETE = { bricks_produced: 0, rejection_reason: '', defect_types: [] as string[], reject_disposition: '' };

export default function ProductionPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<'start' | 'edit' | 'complete' | null>(null);
  const [selected, setSelected] = useState<ProductionBatch | null>(null);
  const [form, setForm] = useState<any>(EMPTY_START);
  const [completeForm, setCompleteForm] = useState<any>(EMPTY_COMPLETE);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['production'],
    queryFn: () => productionApi.list().then(r => {
      const d = r.data.data;
      // API returns paginated { batches, total } or a plain array
      return Array.isArray(d) ? d : (d.batches ?? []);
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['production-stats'],
    queryFn: () => productionApi.stats().then(r => r.data.data),
  });

  const { data: kilns = [] } = useQuery({
    queryKey: ['kilns'],
    queryFn: () => kilnApi.list().then(r => r.data.data),
  });

  const { data: rawData } = useQuery<any>({
    queryKey: ['inventory-raw'],
    queryFn: () => inventoryApi.listRaw().then(r => r.data.data),
  });
  const rawSummary: any[] = rawData?.summary || [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['production'] });
    qc.invalidateQueries({ queryKey: ['production-stats'] });
    qc.invalidateQueries({ queryKey: ['inventory-finished'] });
    qc.invalidateQueries({ queryKey: ['inventory-raw'] });
  };

  const save = useMutation({
    mutationFn: (data: any) => selected ? productionApi.update(selected.id, data) : productionApi.create(data),
    onSuccess: () => {
      invalidateAll();
      toast(selected ? 'Batch updated' : 'Batch started', 'success');
      setModal(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const complete = useMutation({
    mutationFn: (data: any) => productionApi.complete(selected!.id, data),
    onSuccess: () => {
      invalidateAll();
      toast('Batch completed and stock updated', 'success');
      setModal(null);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => productionApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast('Batch deleted', 'success');
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function openStart() { setSelected(null); setForm({ ...EMPTY_START, materials_used: [] }); setModal('start'); }
  function openEdit(b: ProductionBatch) {
    setSelected(b);
    setForm({
      ...b, date: b.date.slice(0, 10), kilnId: (b as any).kilnId || '', custom_name: b.custom_name || '',
      materials_used: (b.consumptions || []).map(c => ({ material_type: c.material_type, quantity_used: c.quantity_used })),
    });
    setModal('edit');
  }
  function openComplete(b: ProductionBatch) {
    setSelected(b);
    setCompleteForm({ ...EMPTY_COMPLETE, bricks_produced: b.bricks_target });
    setModal('complete');
  }

  function addMaterialRow() {
    setForm((f: any) => ({ ...f, materials_used: [...f.materials_used, { material_type: 'CLAY', quantity_used: 0 }] }));
  }
  function updateMaterialRow(idx: number, field: 'material_type' | 'quantity_used', value: string | number) {
    setForm((f: any) => ({
      ...f,
      materials_used: f.materials_used.map((m: any, i: number) => i === idx ? { ...m, [field]: value } : m),
    }));
  }
  function removeMaterialRow(idx: number) {
    setForm((f: any) => ({ ...f, materials_used: f.materials_used.filter((_: any, i: number) => i !== idx) }));
  }
  function availableFor(material_type: string) {
    const s = rawSummary.find(s => s.material_type === material_type);
    return { qty: s?.current_stock ?? 0, unit: s?.unit || '' };
  }

  function toggleDefect(defect: string) {
    setCompleteForm((f: any) => ({
      ...f,
      defect_types: f.defect_types.includes(defect) ? f.defect_types.filter((d: string) => d !== defect) : [...f.defect_types, defect],
    }));
  }

  const rejectedQty = Math.max(0, (selected?.bricks_target ?? 0) - (completeForm.bricks_produced ?? 0));

  const stageColor: Record<string, any> = {
    RAW_MIXING: 'muted', MOLDING: 'info', DRYING: 'warning',
    KILN_FIRING: 'danger', QUALITY_CHECK: 'info', STOCKPILED: 'success',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">Production</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openStart}>
          <Plus size={16} /> Start Batch
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalProduced?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Produced (30 days)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-danger">{stats.totalRejected?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Rejected (30 days)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-warning">{stats.rejectionRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Rejection Rate</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {stats?.daily?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-accent mb-4">Daily Output over the Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2D9D0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="produced" fill="#C0392B" radius={[3,3,0,0]} name="Produced" />
              <Bar dataKey="rejected" fill="#E74C3C" radius={[3,3,0,0]} name="Rejected" opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Date','Shift','Kiln','Product','Materials Used','Target','Produced','Rejected','Stage','Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b: ProductionBatch) => (
                  <tr key={b.id} className="border-b border-border hover:bg-background">
                    <td className="px-3 py-3">{fmtDate(b.date)}</td>
                    <td className="px-3 py-3">{b.shift}</td>
                    <td className="px-3 py-3">{b.kiln_number}</td>
                    <td className="px-3 py-3">{b.brick_type === 'CUSTOM' ? (b.custom_name || 'Custom') : PRODUCTS[b.brick_type]?.name}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {b.consumptions?.length
                        ? b.consumptions.map(c => `${c.material_type.replace(/_/g, ' ')}: ${c.quantity_used.toLocaleString()}`).join(', ')
                        : '-'}
                    </td>
                    <td className="px-3 py-3">{b.bricks_target?.toLocaleString()}</td>
                    <td className="px-3 py-3 font-medium">{b.completed_at ? b.bricks_produced?.toLocaleString() : <span className="text-muted-foreground">Pending</span>}</td>
                    <td className="px-3 py-3 text-danger">{b.completed_at ? b.bricks_rejected?.toLocaleString() : <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-3 py-3"><Badge variant={stageColor[b.current_stage]}>{b.current_stage.replace('_',' ')}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {!b.completed_at && (
                          <button onClick={() => openComplete(b)} className="p-1.5 hover:bg-background rounded text-success" title="Complete batch"><CheckCircle2 size={14} /></button>
                        )}
                        {!b.completed_at && (
                          <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-background rounded text-accent" title="Edit"><Pencil size={14} /></button>
                        )}
                        <button onClick={() => setDeleteId(b.id)} className="p-1.5 hover:bg-background rounded text-danger" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No batches recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Production Batch"
        message="Are you sure you want to permanently delete this batch? This cannot be undone."
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      {/* Start / Edit batch modal */}
      <Modal open={modal === 'start' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Batch' : 'Start Production Batch'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className="label">Shift</label>
            <select className="input" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
              {SHIFTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kiln</label>
            <select className="input" value={form.kilnId} onChange={e => {
              const kiln = (kilns as any[]).find((k: any) => k.id === e.target.value);
              setForm({ ...form, kilnId: e.target.value, kiln_number: kiln?.name || '' });
            }}>
              <option value="">-- Select Kiln --</option>
              {(kilns as any[]).filter((k: any) => k.status !== 'INACTIVE').map((k: any) => (
                <option key={k.id} value={k.id}>{k.name} ({k.status})</option>
              ))}
            </select>
            {!form.kilnId && (
              <input className="input mt-1" placeholder="Or enter kiln number manually" value={form.kiln_number} onChange={e => setForm({ ...form, kiln_number: e.target.value })} />
            )}
          </div>
          <div>
            <label className="label">Current Stage</label>
            <select className="input" value={form.current_stage} onChange={e => setForm({ ...form, current_stage: e.target.value })}>
              {OPEN_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Brick Type</label>
            <select className="input" value={form.brick_type} onChange={e => setForm({ ...form, brick_type: e.target.value })}>
              {BRICK_TYPES.map(b => <option key={b} value={b}>{PRODUCTS[b].name}</option>)}
            </select>
          </div>
          {form.brick_type === 'CUSTOM' && (
            <div>
              <label className="label">Custom Name</label>
              <input className="input" value={form.custom_name} onChange={e => setForm({ ...form, custom_name: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">Target Quantity</label>
            <input type="number" className="input" value={form.bricks_target} onChange={e => setForm({ ...form, bricks_target: Number(e.target.value) })} required />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Raw Materials Used</label>
              <button type="button" onClick={addMaterialRow} className="text-xs text-primary hover:underline">+ Add Material</button>
            </div>
            {form.materials_used.length === 0 && (
              <p className="text-xs text-muted-foreground">No materials recorded for this batch yet.</p>
            )}
            <div className="space-y-2">
              {form.materials_used.map((m: any, idx: number) => {
                const avail = availableFor(m.material_type);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-background rounded-lg px-3 py-2">
                    <select
                      className="input col-span-5"
                      value={m.material_type}
                      onChange={e => updateMaterialRow(idx, 'material_type', e.target.value)}
                    >
                      {MATERIALS.map(mat => <option key={mat} value={mat}>{mat.replace(/_/g, ' ')}</option>)}
                    </select>
                    <div className="col-span-5">
                      <input
                        type="number"
                        className="input"
                        value={m.quantity_used}
                        onChange={e => updateMaterialRow(idx, 'quantity_used', Number(e.target.value))}
                        placeholder="Quantity"
                      />
                      <p className={`text-xs mt-0.5 ${m.quantity_used > avail.qty ? 'text-danger' : 'text-muted-foreground'}`}>
                        available: {avail.qty.toLocaleString()} {avail.unit}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeMaterialRow(idx)} className="col-span-2 text-xs text-danger hover:underline">Remove</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-span-2 flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Complete batch modal */}
      <Modal open={modal === 'complete'} onClose={() => setModal(null)} title="Complete Batch" size="lg">
        <form onSubmit={e => { e.preventDefault(); complete.mutate(completeForm); }} className="grid grid-cols-2 gap-4">
          <p className="col-span-2 text-sm text-muted-foreground">
            Record what actually came out of the kiln for this batch. Rejected is the difference between what was loaded and what came out, calculated automatically. The good output is added to finished goods stock once you save.
          </p>
          <div>
            <label className="label">Target Loaded <span className="text-xs text-muted-foreground">(read-only)</span></label>
            <input type="number" className="input bg-background" value={selected?.bricks_target ?? 0} disabled />
          </div>
          <div>
            <label className="label">Produced</label>
            <input type="number" className="input" value={completeForm.bricks_produced} max={selected?.bricks_target} onChange={e => {
              const produced = Math.min(Number(e.target.value), selected?.bricks_target ?? Number(e.target.value));
              setCompleteForm({ ...completeForm, bricks_produced: produced });
            }} required />
          </div>
          <div className="col-span-2">
            <label className="label">Rejected <span className="text-xs text-muted-foreground">(target loaded minus produced)</span></label>
            <input type="number" className="input bg-background text-danger font-semibold" value={rejectedQty} disabled />
          </div>
          {rejectedQty > 0 && (
            <div>
              <label className="label">Reject Disposition</label>
              <select className="input" value={completeForm.reject_disposition} onChange={e => setCompleteForm({ ...completeForm, reject_disposition: e.target.value })}>
                <option value="">-- None --</option>
                {DISPOSITIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2 bg-background p-3 rounded-lg text-sm">
            <strong>Good output:</strong> {completeForm.bricks_produced.toLocaleString()} units will be added to stock
            {completeForm.reject_disposition === 'DOWNGRADE_TO_B' && rejectedQty > 0 && (
              <> · {rejectedQty.toLocaleString()} rejected units will be added as Grade B stock</>
            )}
          </div>
          {rejectedQty > 0 && (
            <div className="col-span-2">
              <label className="label">Defect Types <span className="text-xs text-muted-foreground">(select all that apply)</span></label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DEFECT_TYPES.map(d => (
                  <label key={d} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors ${completeForm.defect_types?.includes(d) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-accent'}`}>
                    <input type="checkbox" className="sr-only" checked={completeForm.defect_types?.includes(d)} onChange={() => toggleDefect(d)} />
                    {d.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          )}
          {rejectedQty > 0 && (
            <div className="col-span-2">
              <label className="label">Rejection Reason</label>
              <input className="input" value={completeForm.rejection_reason} onChange={e => setCompleteForm({ ...completeForm, rejection_reason: e.target.value })} />
            </div>
          )}
          <div className="col-span-2 flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={complete.isPending}>{complete.isPending ? 'Saving...' : 'Complete Batch'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
