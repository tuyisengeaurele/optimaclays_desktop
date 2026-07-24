export type Role = 'ADMIN' | 'PRODUCTION_SUPERVISOR' | 'SALES_OFFICER' | 'STORE_MANAGER' | 'ACCOUNTANT';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export type WageType = 'MONTHLY' | 'DAILY' | 'PIECE_RATE';

export interface Employee {
  id: string;
  full_name: string;
  national_id?: string;
  phone?: string;
  job_title?: string;
  hire_date?: string;
  wage_type: WageType;
  base_salary: number;
  bank_name?: string;
  bank_account_number?: string;
  is_active: boolean;
  createdAt: string;
}

export type PaymentStatus = 'PENDING' | 'PAID';

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employee: Employee;
  gross_salary: number;
  net_salary: number;
  narration: string;
  payment_status: PaymentStatus;
  payment_date?: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PaymentStatus;
  finalized: boolean;
  entries: PayrollEntry[];
  createdAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';

export interface AttendanceLog {
  id: string;
  employeeId: string;
  employee: Employee;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export type ProductionStage = 'RAW_MIXING' | 'MOLDING' | 'DRYING' | 'KILN_FIRING' | 'QUALITY_CHECK' | 'STOCKPILED';
export type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export interface ProductionBatch {
  id: string;
  date: string;
  shift: Shift;
  kiln_number: string;
  brick_type: BrickType;
  custom_name?: string | null;
  bricks_target: number;
  bricks_produced: number;
  bricks_rejected: number;
  rejection_reason?: string;
  current_stage: ProductionStage;
  completed_at?: string | null;
  consumptions?: { material_type: MaterialType; quantity_used: number }[];
}

export type MaterialType = 'CLAY' | 'SAND' | 'FUEL_FIREWOOD' | 'FUEL_COAL' | 'DIESEL' | 'CEMENT' | 'OTHER';
export type BrickType = 'BRICK_10' | 'PAVING_BLOCK' | 'HALF_BRICK' | 'LOW_ROCK_BOND' | 'CUSTOM';
export type QualityGrade = 'GRADE_A' | 'GRADE_B' | 'REJECT';

export interface RawMaterialStock {
  id: string;
  material_type: MaterialType;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  supplier?: string;
  date: string;
}

export interface FinishedGoodsStock {
  id: string;
  brick_type: BrickType;
  custom_name?: string;
  quality_grade: QualityGrade;
  quantity: number;
  date: string;
}

export type CustomerType = 'INDIVIDUAL' | 'COMPANY';

export interface Customer {
  id: string;
  customer_type: CustomerType;
  full_name?: string;
  phone?: string;
  company_name?: string;
  tin_number?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  customerId: string;
  customer: Customer;
  brick_type: BrickType;
  custom_name?: string;
  quality_grade: QualityGrade;
  quantity: number;
  unit_price: number;
  total_amount: number;
  order_date: string;
  required_delivery_date?: string;
  status: OrderStatus;
  notes?: string;
}

export interface ProformaInvoice {
  id: string;
  number: string;
  customer: Customer;
  order: Order;
  date_issued: string;
  valid_until: string;
  subtotal: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;
  order: Order;
  date: string;
  due_date?: string;
  subtotal: number;
  total: number;
  is_overdue: boolean;
  paid: number;
  balance: number;
  payments: Payment[];
}

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';

export interface Delivery {
  id: string;
  order: Order;
  vehicle_plate?: string;
  driver_name?: string;
  scheduled_date?: string;
  actual_delivery_date?: string;
  quantity_loaded: number;
  status: DeliveryStatus;
  notes?: string;
  costs: DeliveryCost[];
}

export interface DeliveryCost {
  id: string;
  fuel_cost: number;
  driver_fee: number;
  hired_truck_cost: number;
}

export type ExpenseCategory = 'MAINTENANCE' | 'UTILITIES' | 'TRANSPORT' | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description?: string;
}
