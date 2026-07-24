import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { inventoryApi, supplierApi } from '../services/api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate } from '../hooks/useToastHelper';
import { PRODUCTS, getBrickLabel } from '../constants/products';

const MATERIALS = ['CLAY','SAND','FUEL_FIREWOOD','FUEL_COAL','DIESEL','CEMENT','OTHER'];
const BRICK_TYPES = Object.keys(PRODUCTS);
const GRADES = ['GRADE_A','GRADE_B','REJECT'];
const SUPPLIER_OTHER = '__OTHER__';

export default function InventoryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'raw' | 'finished'>('raw');
  const [modal, setModal] = useState<'add-raw' | 'consume' | 'add-finished' | 'threshold' | null>(null);
  const [form, setForm] = useState<any>({});
  const [supplierOther, setSupplierOther] = useState(false);

  const { data: rawData, isLoading: rawLoading } = useQuery({
    queryKey: ['inventory-raw'],
    queryFn: () => inventoryApi.listRaw().then(r => r.data.data),
  });
  const { data: finishedData, isLoading: finLoading } = useQuery<any>({
    queryKey: ['inventory-finished'],
    queryFn: () => inventoryApi.listFinished().then(r => r.data.data),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then(r => r.data.data),
  });
  const finishedGoods = finishedData?.stocks || [];

  const addRaw = useMutation({
    mutationFn: (data: any) => inventoryApi.addRaw(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-raw'] }); toast('Stock added', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const consume = useMutation({
    mutationFn: (data: any) => inventoryApi.consume(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-raw'] }); toast('Consumption recorded', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const addFinished = useMutation({
    mutationFn: (data: any) => inventoryApi.addFinished(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-finished'] }); toast('Stock recorded', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const setThreshold = useMutation({
    mutationFn: (data: any) => inventoryApi.setThreshold(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-raw'] }); toast('Threshold updated', 'success'); setModal(null); },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  const stocks = rawData?.stocks || [];
  const summary = rawData?.summary || [];

  const consumeMaterialSummary = summary.find((s: any) => s.material_type === form.material_type);
  const consumeAvailable = consumeMaterialSummary?.current_stock ?? 0;
  const consumeUnit = consumeMaterialSummary?.unit || '';
  const consumeRemaining = consumeAvailable - (form.quantity_used || 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-accent">Inventory</h1>
        <div className="flex gap-2">
          {tab === 'raw' && (
            <>
              <button className="btn-outline text-sm flex items-center gap-1.5" onClick={() => { setForm({ material_type: 'CLAY', threshold: 0, unit: 'kg' }); setModal('threshold'); }}>
                <SlidersHorizontal size={14} /> Set Threshold
              </button>
              <button className="btn-outline text-sm" onClick={() => { setForm({ material_type: 'CLAY', quantity: 0, unit: 'kg', unit_cost: 0, total_cost: 0, supplierId: '', supplier_name: '', date: new Date().toISOString().slice(0,10) }); setSupplierOther(false); setModal('add-raw'); }}>+ Add Stock</button>
              <button className="btn-secondary text-sm" onClick={() => { setForm({ material_type: 'CLAY', quantity_used: 0, date: new Date().toISOString().slice(0,10) }); setModal('consume'); }}>Record Consumption</button>
            </>
          )}
          {tab === 'finished' && (
            <button className="btn-primary text-sm flex items-center gap-2" onClick={() => { setForm({ brick_type: 'BRICK_10', quality_grade: 'GRADE_A', quantity: 0 }); setModal('add-finished'); }}>
              <Plus size={14} /> Add Finished Goods
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-background p-1 rounded-lg w-fit">
        {[['raw','Raw Materials'],['finished','Finished Goods']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === v ? 'bg-surface shadow text-accent' : 'text-muted-foreground'}`}>{l}</button>
        ))}
      </div>

      {tab === 'raw' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {summary.filter((s: any) => s.current_stock !== 0 || s.threshold > 0).map((s: any) => (
              <div key={s.material_type} className={`card flex flex-col gap-1 ${s.is_low ? 'border-warning' : ''}`}>
                {s.is_low && <AlertTriangle size={14} className="text-warning" />}
                <div className="font-semibold text-sm">{s.material_type.replace('_',' ')}</div>
                <div className={`text-xl font-bold ${s.is_low ? 'text-warning' : 'text-accent'}`}>{s.current_stock.toFixed(1)} {s.unit}</div>
                {s.threshold > 0 && <div className="text-xs text-muted-foreground">Threshold: {s.threshold} {s.unit}</div>}
              </div>
            ))}
          </div>

          <div className="card">
            {rawLoading ? <TableSkeleton /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    {['Date','Material','Quantity','Unit','Unit Cost','Total Cost','Supplier'].map(h => (
                      <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s: any) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="px-3 py-3">{fmtDate(s.date)}</td>
                      <td className="px-3 py-3">{s.material_type === 'OTHER' && s.notes ? s.notes : s.material_type.replace('_',' ')}</td>
                      <td className="px-3 py-3">{s.quantity} {s.unit}</td>
                      <td className="px-3 py-3">{s.unit}</td>
                      <td className="px-3 py-3">{s.unit_cost?.toLocaleString()}</td>
                      <td className="px-3 py-3 font-medium">{s.total_cost?.toLocaleString()}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.supplier?.name || '-'}</td>
                    </tr>
                  ))}
                  {stocks.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No stock records</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'finished' && (
        <div className="card">
          {finLoading ? <TableSkeleton /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {['Date','Brick Type','Grade','Quantity','Notes'].map(h => (
                    <th key={h} className="px-3 py-3 text-left first:rounded-l last:rounded-r">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finishedGoods.map((g: any) => (
                  <tr key={g.id} className="border-b border-border">
                    <td className="px-3 py-3">{fmtDate(g.date)}</td>
                    <td className="px-3 py-3">{getBrickLabel(g.brick_type, g.custom_name)}</td>
                    <td className="px-3 py-3"><Badge variant={g.quality_grade === 'GRADE_A' ? 'success' : g.quality_grade === 'GRADE_B' ? 'warning' : 'danger'}>{g.quality_grade}</Badge></td>
                    <td className="px-3 py-3 font-medium">{g.quantity?.toLocaleString()}</td>
                    <td className="px-3 py-3 text-muted-foreground">{g.notes || '-'}</td>
                  </tr>
                ))}
                {finishedGoods.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No finished goods records</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Raw Stock Modal */}
      <Modal open={modal === 'add-raw'} onClose={() => setModal(null)} title="Add Raw Material Stock">
        <form onSubmit={e => { e.preventDefault(); addRaw.mutate(form); }} className="space-y-4">
          <div><label className="label">Material Type</label>
            <select className="input" value={form.material_type || ''} onChange={e => setForm({ ...form, material_type: e.target.value, notes: '' })}>
              {MATERIALS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {form.material_type === 'OTHER' && (
            <div>
              <label className="label">Specify Material Name <span className="text-primary">*</span></label>
              <input
                className="input"
                value={form.notes || ''}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Rice Husks, Sawdust, Lime..."
                required
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Quantity</label><input type="number" className="input" value={form.quantity || 0} onChange={e => setForm({ ...form, quantity: Number(e.target.value), total_cost: Number(e.target.value) * (form.unit_cost || 0) })} /></div>
            <div><label className="label">Unit</label><input className="input" value={form.unit || ''} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, tons, liters" /></div>
            <div><label className="label">Unit Cost (RWF)</label><input type="number" className="input" value={form.unit_cost || 0} onChange={e => setForm({ ...form, unit_cost: Number(e.target.value), total_cost: Number(e.target.value) * (form.quantity || 0) })} /></div>
            <div><label className="label">Total Cost (RWF)</label><input type="number" className="input" value={form.total_cost || 0} onChange={e => setForm({ ...form, total_cost: Number(e.target.value) })} /></div>
          </div>
          <div>
            <label className="label">Supplier</label>
            <select
              className="input"
              value={supplierOther ? SUPPLIER_OTHER : (form.supplierId || '')}
              onChange={e => {
                if (e.target.value === SUPPLIER_OTHER) { setSupplierOther(true); setForm({ ...form, supplierId: '', supplier_name: '' }); }
                else { setSupplierOther(false); setForm({ ...form, supplierId: e.target.value, supplier_name: '' }); }
              }}
            >
              <option value="">-- Select Supplier --</option>
              {(suppliers as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={SUPPLIER_OTHER}>Not listed...</option>
            </select>
            {supplierOther && (
              <input
                className="input mt-2"
                placeholder="Enter supplier name"
                value={form.supplier_name || ''}
                onChange={e => setForm({ ...form, supplier_name: e.target.value })}
              />
            )}
          </div>
          <div><label className="label">Date</label><input type="date" className="input" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addRaw.isPending}>Save</button>
          </div>
        </form>
      </Modal>

      {/* Consume Modal */}
      <Modal open={modal === 'consume'} onClose={() => setModal(null)} title="Record Consumption">
        <form onSubmit={e => { e.preventDefault(); consume.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">
              Material Type
              <span className="ml-1 text-xs text-muted-foreground">
                (available: {consumeAvailable.toLocaleString()} {consumeUnit})
              </span>
            </label>
            <select className="input" value={form.material_type || ''} onChange={e => setForm({ ...form, material_type: e.target.value })}>
              {MATERIALS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity Used</label>
            <input type="number" className="input" value={form.quantity_used || 0} onChange={e => setForm({ ...form, quantity_used: Number(e.target.value) })} />
            <p className={`text-xs mt-1 ${consumeRemaining < 0 ? 'text-danger font-semibold' : 'text-muted-foreground'}`}>
              Remaining after this: {consumeRemaining.toLocaleString()} {consumeUnit}
              {consumeRemaining < 0 ? ' (exceeds available stock)' : ''}
            </p>
          </div>
          <div><label className="label">Date</label><input type="date" className="input" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">Notes</label><input className="input" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={consume.isPending}>Save</button>
          </div>
        </form>
      </Modal>

      {/* Set Threshold Modal */}
      <Modal isOpen={modal === 'threshold'} onClose={() => setModal(null)} title="Set Low-Stock Threshold">
        <form onSubmit={e => { e.preventDefault(); setThreshold.mutate(form); }} className="space-y-4">
          <p className="text-sm text-gray-500">Set the minimum stock level that triggers a low-stock warning on the dashboard.</p>
          <div><label className="label">Material Type</label>
            <select className="input" value={form.material_type || ''} onChange={e => setForm({ ...form, material_type: e.target.value })}>
              {MATERIALS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Threshold Quantity</label><input type="number" min={0} className="input" value={form.threshold || 0} onChange={e => setForm({ ...form, threshold: Number(e.target.value) })} /></div>
            <div><label className="label">Unit</label><input className="input" value={form.unit || ''} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, tons, liters" /></div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={setThreshold.isPending}>Save Threshold</button>
          </div>
        </form>
      </Modal>

      {/* Add Finished Goods Modal */}
      <Modal open={modal === 'add-finished'} onClose={() => setModal(null)} title="Add Finished Goods">
        <form onSubmit={e => { e.preventDefault(); addFinished.mutate(form); }} className="space-y-4">
          <div><label className="label">Brick Type</label>
            <select className="input" value={form.brick_type || ''} onChange={e => setForm({ ...form, brick_type: e.target.value })}>
              {BRICK_TYPES.map(b => <option key={b} value={b}>{PRODUCTS[b].name}{b !== 'CUSTOM' ? ` (${PRODUCTS[b].dimensions})` : ''}</option>)}
            </select>
          </div>
          {form.brick_type === 'CUSTOM' && (
            <div><label className="label">Custom Name</label><input className="input" value={form.custom_name || ''} onChange={e => setForm({ ...form, custom_name: e.target.value })} /></div>
          )}
          <div><label className="label">Quality Grade</label>
            <select className="input" value={form.quality_grade || ''} onChange={e => setForm({ ...form, quality_grade: e.target.value })}>
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div><label className="label">Quantity</label><input type="number" className="input" value={form.quantity || 0} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          <div><label className="label">Notes</label><input className="input" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addFinished.isPending}>Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
