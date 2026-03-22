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
}

export interface ServiceLog {
  id: string;
  ticketId: string;
  mechanicId: string;
  workDone: string;
  partsReplaced?: string;
  timestamp: string;
}

export interface ServiceNotification {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  machineryId: string;
  machineryModel?: string;
  type: 'SERVICE_REMINDER';
  status: 'SENT' | 'FAILED' | 'MOCKED';
  sentAt: string;
  message: string;
}
