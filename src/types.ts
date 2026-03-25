export type UserRole = 'Field Technician' | 'Manager' | 'Administrator';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  createdAt: string;
}

export type MachineryType = 'Tractor' | 'Generator' | 'Water pump' | 'Electric Motors' | 'Transformers' | 'Bow Mills' | 'Jaw Crusher' | 'Electric Compressors' | 'Diesel Compressors' | 'Engines';
export type MachineryStatus = 'Operational' | 'Due for Service' | 'Under Repair';

export interface Machinery {
  id: string;
  customerId: string;
  type: MachineryType;
  model: string;
  serialNumber: string;
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
