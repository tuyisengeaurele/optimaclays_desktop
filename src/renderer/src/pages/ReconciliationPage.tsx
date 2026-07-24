import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight, Boxes, Layers } from 'lucide-react';
import { reconciliationApi, inventoryApi } from '../services/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TableSkeleton } from '../components/ui/Skeleton';
import { getErrorMessage, fmtDate } from '../hooks/useToastHelper';
import { getBrickLabel } from '../constants/products';

type ItemType = 'RAW_MATERIAL' | 'FINISHED_GOODS';

interface ReconciliationItem {
  item_type: ItemType;
  material_type?: string;
  brick_type?: string;
  quality_grade?: string;
  label: string;
  system_quantity: number;
  physical_quantity: number;
  unit: string;
  notes: string;
}

const GROUPS: { type: ItemType; label: string; icon: typeof Boxes }[] = [
  { type: 'RAW_MATERIAL', label: 'Raw Materials', icon: Boxes },
  { type: 'FINISHED_GOODS', label: 'Finished Goods', icon: Layers },
];

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [notes, setNotes] = useState('');

  const { data: reconciliations = [], isLoading } = useQuery({
    queryKey: ['reconciliations'],
    queryFn: () => reconciliationApi.list().then(r => r.data.data),
  });

  const { data: rawData, isFetching: rawFetching } = useQuery<any>({
    queryKey: ['inventory-raw'],
    queryFn: () => inventoryApi.listRaw().then(r => r.data.data),
  });

  const { data: finishedData, isFetching: finishedFetching } = useQuery<any>({
    queryKey: ['inventory-finished'],
    queryFn: () => inventoryApi.listFinished().then(r => r.data.data),
  });

  function openModal() {
    const rawSummary: any[] = rawData?.summary || [];
    const finSummary: any[] = finishedData?.summary || [];

    const rawItems: ReconciliationItem[] = rawSummary
      .filter((s: any) => s.current_stock > 0)
      .map((s: any) => ({
        item_type: 'RAW_MATERIAL',
        material_type: s.material_type,
        label: s.material_type.replace(/_/g, ' '),
        system_quantity: s.current_stock,
        physical_quantity: s.current_stock,
        unit: s.unit || '',
        notes: '',
      }));

    const finItems: ReconciliationItem[] = finSummary
      .filter((s: any) => s.current_stock > 0)
      .map((s: any) => ({
        item_type: 'FINISHED_GOODS',
        brick_type: s.brick_type,
        quality_grade: s.quality_grade,
        label: `${getBrickLabel(s.brick_type)} · ${s.quality_grade.replace(/_/g, ' ')}`,
        system_quantity: s.current_stock,
        physical_quantity: s.current_stock,
        unit: 'units',
        notes: '',
      }));

    setItems([...rawItems, ...finItems]);
    setCollapsedGroups({});
    setNotes('');
    setModal(true);
  }

  const create = useMutation({
    mutationFn: (data: any) => reconciliationApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      toast('Reconciliation saved', 'success');
      setModal(false);
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function updateItem(idx: number, field: keyof ReconciliationItem, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      notes,
      items: items.map(({ label, ...item }) => item),
    });
  }

  const varianceColor = (v: number) => v === 0 ? 'text-muted-foreground' : v > 0 ? 'text-success font-semibold' : 'text-danger font-semibold';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-accent">Stock Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">System quantities load from the DB, grouped by raw materials and finished goods. Just enter what you counted.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openModal} disabled={rawFetching || finishedFetching}>
          <Plus size={16} /> New Count
        </button>
      </div>

      <div className="card">
        {isLoading ? <TableSkeleton /> : (
          <div>
            {(reconciliations as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No counts recorded yet.</p>
            ) : (
              (reconciliations as any[]).map((rec: any) => {
                const groups = GROUPS.map(g => ({ ...g, items: (rec.items || []).filter((i: any) => i.item_type === g.type) })).filter(g => g.items.length > 0);
                return (
                  <div key={rec.id} className="border-b border-border last:border-0">
                    <button
                      className="w-full flex items-center justify-between px-4 py-4 hover:bg-background transition-colors text-left"
                      onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                    >
                      <div>
                        <span className="font-medium text-accent">{fmtDate(rec.createdAt)}</span>
                        <span className="ml-4 text-sm text-muted-foreground">by {rec.reconciled_by}</span>
                        {rec.notes && <span className="ml-4 text-sm text-muted-foreground italic">"{rec.notes}"</span>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {rec.items?.some((i: any) => i.variance < 0) && (
                          <span className="badge bg-red-100 text-red-700">
                            {rec.items.filter((i: any) => i.variance < 0).length} short
                          </span>
                        )}
                        {rec.items?.some((i: any) => i.variance > 0) && (
                          <span className="badge bg-green-100 text-green-700">
                            {rec.items.filter((i: any) => i.variance > 0).length} surplus
                          </span>
                        )}
                        <span>{rec.items?.length} lines</span>
                        {expanded === rec.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </button>

                    {expanded === rec.id && (
                      <div className="px-4 pb-4 space-y-4">
                        {groups.map(g => (
                          <div key={g.type}>
                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                              <g.icon size={13} /> {g.label}
                            </div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="table-header">
                                  {['Item', 'Unit', 'System', 'Physical', 'Variance', 'Notes'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left first:rounded-l last:rounded-r">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((item: any, i: number) => (
                                  <tr key={i} className="border-b border-border last:border-0">
                                    <td className="px-3 py-2 font-medium">
                                      {item.item_type === 'FINISHED_GOODS'
                                        ? `${getBrickLabel(item.brick_type)} · ${(item.quality_grade || '').replace(/_/g, ' ')}`
                                        : item.material_type?.replace(/_/g, ' ')}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{item.unit || '-'}</td>
                                    <td className="px-3 py-2">{item.system_quantity?.toLocaleString()}</td>
                                    <td className="px-3 py-2">{item.physical_quantity?.toLocaleString()}</td>
                                    <td className={`px-3 py-2 ${varianceColor(item.variance)}`}>
                                      {item.variance > 0 ? '+' : ''}{item.variance?.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{item.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Stock Count" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. End-of-month count" />
          </div>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No stock found. Add raw materials or finished goods in Inventory first.
            </p>
          )}

          {GROUPS.map(group => {
            const groupItems = items
              .map((item, idx) => ({ item, idx }))
              .filter(({ item }) => item.item_type === group.type);
            if (groupItems.length === 0) return null;
            const isCollapsed = collapsedGroups[group.type];

            return (
              <div key={group.type} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.type]: !prev[group.type] }))}
                  className="w-full flex items-center justify-between px-3 py-2 bg-background text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5"><group.icon size={13} /> {group.label} <span className="normal-case font-normal">({groupItems.length})</span></span>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>

                {!isCollapsed && (
                  <div className="p-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <div className="col-span-4">Item</div>
                      <div className="col-span-2 text-right pr-2">System</div>
                      <div className="col-span-2">Physical</div>
                      <div className="col-span-1 text-center">Var</div>
                      <div className="col-span-3">Notes</div>
                    </div>
                    {groupItems.map(({ item, idx }) => {
                      const variance = item.physical_quantity - item.system_quantity;
                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-background rounded-lg px-3 py-2.5">
                          <div className="col-span-4 text-sm font-medium">
                            {item.label}
                            {item.unit && <span className="ml-1 text-xs text-muted-foreground">({item.unit})</span>}
                          </div>
                          <div className="col-span-2 text-right pr-2">
                            <span className="text-sm font-mono text-muted-foreground">{item.system_quantity.toLocaleString()}</span>
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min={0}
                              className="input text-center"
                              value={item.physical_quantity}
                              onChange={e => updateItem(idx, 'physical_quantity', Number(e.target.value))}
                            />
                          </div>
                          <div className={`col-span-1 text-center text-sm ${varianceColor(variance)}`}>
                            {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                          </div>
                          <div className="col-span-3">
                            <input
                              className="input text-xs"
                              placeholder="Reason"
                              value={item.notes}
                              onChange={e => updateItem(idx, 'notes', e.target.value)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {items.length > 0 && (
            <div className="text-xs px-1 text-muted-foreground">
              {items.every(i => i.physical_quantity === i.system_quantity)
                ? <span className="text-success font-medium">All quantities match</span>
                : <>
                    {items.filter(i => i.physical_quantity < i.system_quantity).length > 0 && (
                      <span className="text-danger font-medium mr-4">
                        {items.filter(i => i.physical_quantity < i.system_quantity).length} short
                      </span>
                    )}
                    {items.filter(i => i.physical_quantity > i.system_quantity).length > 0 && (
                      <span className="text-success font-medium">
                        {items.filter(i => i.physical_quantity > i.system_quantity).length} surplus
                      </span>
                    )}
                  </>
              }
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-border">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || items.length === 0}>
              {create.isPending ? 'Saving...' : 'Save Count'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
