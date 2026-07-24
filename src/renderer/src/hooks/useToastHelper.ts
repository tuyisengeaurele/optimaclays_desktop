// Helper to extract error message from axios errors
export function getErrorMessage(err: any): string {
  return err?.response?.data?.message || err?.message || 'An error occurred';
}

export function fmtRWF(amount: number): string {
  return amount.toLocaleString('en-RW') + ' RWF';
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const BANK_CODES = [
  '00- National Bank of Rwanda',
  '10- I & M BANK LIMITED',
  '11- ECOBANK RWANDA',
  '15- ACCESS BANK',
  '20- AB BANK',
  '25- CRANE BANK',
  '40- Bank of Kigali',
  '44- Banque Populaire du Rwanda',
  '45- URWEGO OPPORTUNITY BANK',
  '50- Banque Rwandaise de Developpement',
  '70- GT BANK',
  '75- ZIGAMA CSS',
  '76- Bank of Africa',
  '80- UNGUKA BANK',
  '85- EQUITY BANK',
  '90- UMWALIMU SACCO',
  '32- RIM Ltd',
  '21- Letshego Rwanda Plc',
  '22- Atlantique Microfinance Plc',
  '23- Umutanguha Finance Company Plc',
  '24- Duterimbere IMF Plc',
  '26- Goshen Finance Plc',
  '27- COPEDU Plc',
  '28- Vision Funds Plc',
  '29- Financial Safety Co Plc',
  '31- Inkunga Finance Plc',
  '33- MUGANGA SACCO',
];
