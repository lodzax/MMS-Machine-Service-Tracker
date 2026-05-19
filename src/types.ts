export type UserRole = 'Field Technician' | 'Manager' | 'Administrator';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  avatarUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  loyaltyPoints: number;
  totalSpend: number;
  changeCredit: number;
  installationBalance: number;
  createdAt: string;
}

export type LoyaltyTransactionType = 'PURCHASE' | 'REDEMPTION' | 'CHANGE_CREDIT' | 'CREDIT_SPENT';

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: LoyaltyTransactionType;
  amount: number;
  points: number;
  invoiceNumber?: string;
  description: string;
  timestamp: string;
}

export type AfterSalesTransactionType = 'INSTALLATION_FEE' | 'SERVICE_EXPENSE' | 'TOP_UP';

export interface AfterSalesTransaction {
  id: string;
  customerId: string;
  type: AfterSalesTransactionType;
  amount: number;
  invoiceNumber?: string;
  description: string;
  timestamp: string;
}

export type MachineryType = string;
export type MachineryStatus = 'Operational' | 'Due for Service' | 'Under Repair';

export interface MachineryTypeRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface Machinery {
  id: string;
  customerId: string;
  type: MachineryType;
  model: string;
  serialNumber: string;
  purchasePrice?: number;
  purchaseDate?: string;
  warrantyExpiry: string;
  lastServiceDate?: string;
  nextServiceDueDate?: string;
  status: MachineryStatus;
}

export type TicketStatus = 'Open' | 'In Progress' | 'Completed';

export interface ServiceTicket {
  id: string;
  machineryId: string;
  customerId: string;
  mechanicId?: string;
  status: TicketStatus;
  description: string;
  openedAt: string;
  closedAt?: string;
  satisfactionScore?: number; // 1-5
}

export interface ServiceLog {
  id: string;
  ticketId: string;
  mechanicId: string;
  mechanicName: string;
  workDone: string;
  partsReplaced?: string;
  usedParts?: UsedPart[];
  timestamp: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  description?: string;
  quantity: number;
  minQuantity?: number;
  unitPrice: number;
  category?: string;
  updatedAt?: string;
}

export interface UsedPart {
  partId?: string;
  partName: string;
  sku: string;
  quantity: number;
}

export interface ServiceNotification {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  machineryId?: string;
  machineryModel?: string;
  partId?: string;
  partName?: string;
  type: 'SERVICE_REMINDER' | 'LOW_STOCK';
  status: 'SENT' | 'FAILED' | 'MOCKED' | 'SYSTEM';
  sentAt: string;
  message: string;
}

export interface BranchReturn {
  id: string;
  branchName: string;
  machineryId: string;
  customerId: string;
  supervisorName: string;
  returnDate: string;
  description: string;
  status: 'Received' | 'In Repair' | 'Ready' | 'Returned';
  ticketId?: string;
}

export const BRANCHES = [
  'Belmont',
  'Esigodini 1',
  'Esigodini 2',
  'VID',
  'Thobelani',
  'Mthwakazi',
  'Mswela',
  'Maphisa',
  'Gweru-Luton Rd',
  'Gweru-Bradford',
  'Junkshop',
  'Tongogara'
];
