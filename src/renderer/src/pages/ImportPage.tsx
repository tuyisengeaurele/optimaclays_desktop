import { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { importApi } from '../services/api';
import { useToast } from '../components/ui/Toast';
import { getErrorMessage } from '../hooks/useToastHelper';

type ImportType = 'customers' | 'employees';

const TEMPLATES: Record<ImportType, { headers: string[]; example: string[] }> = {
  customers: {
    headers: ['full_name', 'phone', 'company_name', 'tin_number', 'location', 'notes', 'customer_type', 'credit_limit'],
    example: ['Acme Ltd', '+250788000000', 'Acme Ltd', '123456789', 'Kigali', '', 'COMPANY', '0'],
  },
  employees: {
    headers: ['full_name', 'position', 'department', 'hire_date', 'wage_type', 'base_wage', 'id_number', 'phone'],
    example: ['Jane Doe', 'Supervisor', 'Production', '2024-01-01', 'MONTHLY', '150000', 'NID001', '+250788123456'],
  },
};

export default function ImportPage() {
  const { toast } = useToast();
  const [type, setType] = useState<ImportType>('customers');
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function downloadTemplate() {
    const tmpl = TEMPLATES[type];
    const csv = [tmpl.headers.join(','), tmpl.example.join(',')].join('\r\n');
    const buffer = btoa(unescape(encodeURIComponent(csv)));
    await window.api.invoke('dialogs:saveBuffer', { buffer, filename: `${type}_import_template.csv` });
  }

  async function handlePickFile() {
    const { filePath } = await window.api.invoke<{ extensions: string[]; title: string }, { filePath: string | null }>(
      'dialogs:openFile',
      { extensions: ['csv'], title: 'Select a CSV file to import' }
    );
    if (!filePath) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await importApi[type](filePath);
      const data = res.data.data as { imported: number; skipped: number; errors: string[] };
      setResult(data);
      toast(`Import complete: ${data.imported} imported`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-accent">Bulk CSV Import</h1>
        <p className="text-sm text-gray-500 mt-1">Add customers or employees in bulk from a CSV file</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-accent">Import Settings</h2>

          <div>
            <label className="label">What to import</label>
            <div className="flex gap-4">
              {(['customers', 'employees'] as ImportType[]).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => { setType(t); setResult(null); }} />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-background rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Required columns for <span className="text-primary">{type}</span>:</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATES[type].headers.map(h => (
                <span key={h} className="font-mono text-xs bg-surface border border-border px-2 py-0.5 rounded">{h}</span>
              ))}
            </div>
          </div>

          <button onClick={downloadTemplate} className="btn-outline flex items-center gap-2 w-full justify-center">
            <FileText size={15} /> Download CSV Template
          </button>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={handlePickFile}
          >
            <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-accent">Click to choose a CSV file</p>
            <p className="text-xs text-muted-foreground mt-1">Existing records (matched by phone or ID) are skipped</p>
          </div>

          {loading && (
            <div className="text-center text-sm text-muted-foreground py-2">Importing...</div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-accent">Import Result</h2>
          {!result ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No import run yet. Choose a CSV file to see results here.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle size={24} className="text-green-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-green-700">{result.imported}</div>
                  <div className="text-xs text-green-600">Imported</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <XCircle size={24} className="text-yellow-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
                  <div className="text-xs text-yellow-600">Skipped (duplicates)</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-danger mb-2">{result.errors.length} row(s) with errors:</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700 font-mono">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
