import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus } from 'lucide-react';
import { priceCatalogueApi } from '../services/api';
import { useToast } from '../components/ui/Toast';
import { getErrorMessage, fmtRWF } from '../hooks/useToastHelper';

const BRICK_TYPES = [
  { value: 'BRICK_10', label: 'Brick 10 (Standard)' },
  { value: 'PAVING_BLOCK', label: 'Paving Block' },
  { value: 'HALF_BRICK', label: 'Half Brick' },
  { value: 'LOW_ROCK_BOND', label: 'Low Rock Bond' },
  { value: 'CUSTOM', label: 'Custom / Other' },
];

export default function PriceCataloguePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Record<string, boolean>>({});

  const { data: catalogue = [] } = useQuery<any[]>({
    queryKey: ['price-catalogue'],
    queryFn: () => priceCatalogueApi.list().then(r => r.data.data),
  });

  React.useEffect(() => {
    if (catalogue.length) {
      const map: Record<string, string> = {};
      catalogue.forEach((p: any) => { map[p.brick_type] = String(p.unit_price); });
      setPrices(map);
    }
  }, [catalogue]);

  const save = useMutation({
    mutationFn: ({ brick_type, unit_price }: any) => priceCatalogueApi.upsert({ brick_type, unit_price: Number(unit_price) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['price-catalogue'] });
      setEdited(e => ({ ...e, [vars.brick_type]: false }));
      toast('Price saved', 'success');
    },
    onError: err => toast(getErrorMessage(err), 'error'),
  });

  function handleChange(type: string, value: string) {
    setPrices(p => ({ ...p, [type]: value }));
    setEdited(e => ({ ...e, [type]: true }));
  }

  const catalogueMap = Object.fromEntries(catalogue.map((p: any) => [p.brick_type, p]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-accent">Price Catalogue</h1>
        <p className="text-sm text-gray-500 mt-1">Default prices per brick type. These fill in automatically on new orders.</p>
      </div>

      <div className="card max-w-xl">
        <div className="space-y-4">
          {BRICK_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center gap-4">
              <div className="flex-1">
                <label className="label">{label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">RWF</span>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={prices[value] ?? ''}
                    placeholder="0"
                    onChange={e => handleChange(value, e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-5">
                {edited[value] ? (
                  <button
                    onClick={() => save.mutate({ brick_type: value, unit_price: prices[value] || 0 })}
                    disabled={save.isPending}
                    className="btn-primary flex items-center gap-1"
                  >
                    <Save size={14} /> Save
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {catalogueMap[value] ? fmtRWF(catalogueMap[value].unit_price) + ' / unit' : 'Not set'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
          Prices are used as defaults only. They can be overridden per order.
        </p>
      </div>
    </div>
  );
}
