import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { 
  auth, db, loginWithGoogle, logout, onAuthStateChanged, FirebaseUser,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, onSnapshot, orderBy, limit, writeBatch,
  OperationType, handleFirestoreError, logAudit
} from './firebase';
import { UserProfile, Customer, Machinery, ServiceTicket, ServiceLog, UserRole, MachineryType, MachineryStatus, TicketStatus, ServiceNotification } from './types';
import { 
  LayoutDashboard, Users, Construction, Ticket, History, LogOut, Search, Plus, 
  CheckCircle2, AlertCircle, Clock, ChevronRight, Settings, Wrench, Phone, Mail, MapPin, Calendar, User as UserIcon, Filter, FileText, Download,
  Tractor, Zap, Droplets, Cpu, Box, RotateCw, Hammer, Wind, Fuel, Settings2, Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Contexts ---
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
});

const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`pointer-events-auto p-4 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center gap-3 min-w-[300px] ${
                toast.type === 'success' ? 'bg-green-50' : 
                toast.type === 'error' ? 'bg-red-50' : 'bg-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="text-green-600" size={18} /> : 
               toast.type === 'error' ? <AlertCircle className="text-red-600" size={18} /> : 
               <Clock className="text-blue-600" size={18} />}
              <p className="text-xs font-bold uppercase tracking-tight flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-[#141414]">
                <Plus className="rotate-45" size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isTechnician: boolean;
  canEditCustomers: boolean;
  canEditMachinery: boolean;
  canEditTickets: boolean;
  canViewAuditLogs: boolean;
  canEditMechanics: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false, 
  isManager: false, 
  isTechnician: false,
  canEditCustomers: false,
  canEditMachinery: false,
  canEditTickets: false,
  canViewAuditLogs: false,
  canEditMechanics: false
});

const useAuth = () => useContext(AuthContext);

// --- Components ---

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen bg-[#E4E3E0]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#141414]"></div>
  </div>
);

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      try {
        const parsed = JSON.parse(e.message);
        setError(parsed.error || "An unexpected error occurred.");
      } catch {
        setError(e.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#E4E3E0] p-4">
        <div className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-red-600" /> System Error
          </h2>
          <p className="text-sm text-gray-600 mb-6 font-mono">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-[#141414] text-white hover:bg-gray-800 transition-colors"
          >
            Restart Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Main App ---

// --- Helpers ---
const getMachineryIcon = (type: MachineryType, size = 20) => {
  switch (type) {
    case 'Tractor': return <Tractor size={size} />;
    case 'Generator': return <Zap size={size} />;
    case 'Water pump': return <Droplets size={size} />;
    case 'Electric Motors': return <Cpu size={size} />;
    case 'Transformers': return <Box size={size} />;
    case 'Bow Mills': return <RotateCw size={size} />;
    case 'Jaw Crusher': return <Hammer size={size} />;
    case 'Electric Compressors': return <Wind size={size} />;
    case 'Diesel Compressors': return <Fuel size={size} />;
    case 'Engines': return <Settings2 size={size} />;
    default: return <Construction size={size} />;
  }
};

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ToastProvider>
  );
}

function AppContent() {
  const { addToast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const currentProfile = userDoc.data() as UserProfile;
            // Automatically upgrade specific user to admin if needed
            if (currentProfile.email === 'lodzax@gmail.com' && currentProfile.role !== 'Administrator') {
              const updatedProfile = { ...currentProfile, role: 'Administrator' as UserRole };
              await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'Administrator' });
              setTimeout(() => {
                setProfile(updatedProfile);
              }, 500);
              await logAudit(firebaseUser.uid, currentProfile.name, 'UPDATE', 'User', firebaseUser.uid, 'Auto-assigned Administrator role');
              addToast("Administrator role auto-assigned", "info");
            } else {
              setProfile(currentProfile);
            }
          } else {
            // Create default profile for first-time login
            const isAdmin = firebaseUser.email === 'lodzax@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email || '',
              role: isAdmin ? 'Administrator' : 'Field Technician',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            // Small delay to allow Firestore rules to propagate the new document
            setTimeout(() => {
              setProfile(newProfile);
            }, 1000);
            addToast("Account initialized successfully", "success");
            await logAudit(firebaseUser.uid, newProfile.name, 'CREATE', 'User', firebaseUser.uid, 'Initial profile creation' + (isAdmin ? ' (Administrator)' : ''));
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const authValue = useMemo(() => {
    const role = profile?.role;
    const isAdmin = role === 'Administrator';
    const isManager = role === 'Manager';
    const isTechnician = role === 'Field Technician';

    return {
      user,
      profile,
      loading,
      isAdmin,
      isManager,
      isTechnician,
      canEditCustomers: isAdmin || isManager,
      canEditMachinery: isAdmin || isManager,
      canEditTickets: isAdmin || isManager || isTechnician,
      canViewAuditLogs: isAdmin,
      canEditMechanics: isAdmin
    };
  }, [user, profile, loading]);

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#141414] p-12 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] text-center"
        >
          <Wrench className="w-16 h-16 mx-auto mb-6 text-[#141414]" />
          <h1 className="text-4xl font-bold mb-2 tracking-tighter">SERVICE TRACKER</h1>
          <p className="text-gray-500 mb-8 font-mono italic">Machinery Maintenance & Warranty Management</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full py-4 bg-[#141414] text-white font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
          >
            <UserIcon size={20} />
            SIGN IN WITH GOOGLE
          </button>
          <p className="mt-6 text-xs text-gray-400 uppercase tracking-widest">Authorized Personnel Only</p>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      <ErrorBoundary>
        <AppLayout 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          selectedMachineId={selectedMachineId} 
          setSelectedMachineId={setSelectedMachineId} 
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
        />
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}

function AppLayout({ 
  activeTab, 
  setActiveTab, 
  selectedMachineId, 
  setSelectedMachineId,
  selectedCustomerId,
  setSelectedCustomerId
}: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void, 
  selectedMachineId: string | null, 
  setSelectedMachineId: (id: string | null) => void,
  selectedCustomerId: string | null,
  setSelectedCustomerId: (id: string | null) => void
}) {
  const { profile, canViewAuditLogs, canEditMechanics } = useAuth();

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex font-sans text-[#141414]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#141414] bg-white flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-[#141414]">
          <h2 className="text-xl font-bold tracking-tighter flex items-center gap-2">
            <Wrench size={24} /> TRACKER
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18} />} label="DASHBOARD" />
          <NavItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="CUSTOMERS" />
          <NavItem active={activeTab === 'machinery'} onClick={() => setActiveTab('machinery')} icon={<Construction size={18} />} label="MACHINERY" />
          <NavItem active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket size={18} />} label="SERVICE TICKETS" />
          <NavItem active={activeTab === 'history'} onClick={() => { setSelectedMachineId(null); setActiveTab('history'); }} icon={<History size={18} />} label="SERVICE HISTORY" />
          {canEditMechanics && (
            <NavItem active={activeTab === 'mechanics'} onClick={() => setActiveTab('mechanics')} icon={<UserIcon size={18} />} label="TEAM / MECHANICS" />
          )}
          {canViewAuditLogs && (
            <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<FileText size={18} />} label="AUDIT LOGS" />
          )}
        </nav>
        <div className="p-4 border-t border-[#141414]">
          <div className="flex items-center gap-3 mb-4 p-2">
            <div className="w-8 h-8 bg-[#141414] text-white rounded-full flex items-center justify-center text-xs font-bold">
              {profile?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate uppercase">{profile?.name}</p>
              <p className="text-[10px] text-gray-500 font-mono uppercase">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 text-xs font-bold p-2 hover:bg-red-50 text-red-600 transition-colors"
          >
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-[#141414] bg-white flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-sm font-bold tracking-widest uppercase">{activeTab}</h1>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-gray-400">{new Date().toLocaleDateString()}</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-200">SYSTEM ONLINE</span>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" />}
            {activeTab === 'customers' && (
              <CustomersView 
                key="customers" 
                initialCustomerId={selectedCustomerId} 
                onCloseModal={() => setSelectedCustomerId(null)} 
              />
            )}
            {activeTab === 'machinery' && (
              <MachineryView 
                key="machinery" 
                onViewHistory={(id) => { setSelectedMachineId(id); setActiveTab('history'); }} 
                onViewCustomer={(id) => { setSelectedCustomerId(id); setActiveTab('customers'); }}
              />
            )}
            {activeTab === 'tickets' && <TicketsView key="tickets" />}
            {activeTab === 'history' && (
              <HistoryView 
                key="history" 
                initialMachineId={selectedMachineId} 
                onViewCustomer={(id) => { setSelectedCustomerId(id); setActiveTab('customers'); }}
              />
            )}
            {activeTab === 'mechanics' && canEditMechanics && <MechanicsView key="mechanics" />}
            {activeTab === 'audit' && canViewAuditLogs && <AuditLogsView key="audit" />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}


function AuditLogsView() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'notifications'>('audit');
  const [search, setSearch] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<ServiceNotification | null>(null);
  const [emailMode, setEmailMode] = useState<'LIVE' | 'MOCK' | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetch('/api/admin/config')
      .then(res => res.json())
      .then(data => setEmailMode(data.emailMode))
      .catch(err => console.error("Failed to fetch config:", err));

    const qAudit = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (activeTab === 'audit') setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));

    const qNotif = query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(100));
    const unsubNotif = onSnapshot(qNotif, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceNotification)));
      if (activeTab === 'notifications') setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    return () => {
      unsubAudit();
      unsubNotif();
    };
  }, [activeTab]);

  const handleTriggerCheck = async () => {
    setTriggering(true);
    try {
      const response = await fetch('/api/admin/check-service-due', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        addToast(`Service check complete. Processed ${data.processed} machinery.`, "success");
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Failed to trigger service check:", err);
      addToast("Failed to trigger service check", "error");
    } finally {
      setTriggering(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.userName.toLowerCase().includes(search.toLowerCase()) || 
    l.details.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entityType.toLowerCase().includes(search.toLowerCase())
  );

  const filteredNotifications = notifications.filter(n => 
    n.customerName.toLowerCase().includes(search.toLowerCase()) || 
    n.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
    n.machineryModel?.toLowerCase().includes(search.toLowerCase()) ||
    n.message.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">System Administration</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="SEARCH..." 
              className="w-full pl-10 pr-4 py-1.5 bg-white border border-[#141414] text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button 
          onClick={handleTriggerCheck}
          disabled={triggering}
          className={`px-4 py-2 text-white text-[10px] font-bold tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 ${
            emailMode === 'MOCK' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#141414] hover:bg-gray-800'
          }`}
        >
          <Clock size={14} /> 
          {triggering ? 'RUNNING CHECK...' : (emailMode === 'MOCK' ? 'TRIGGER MOCK REMINDERS' : 'TRIGGER SERVICE REMINDERS')}
        </button>
      </div>

      {emailMode === 'MOCK' && (
        <div className="bg-amber-50 border border-amber-200 p-3 flex items-center gap-3 text-amber-800">
          <AlertCircle size={16} className="shrink-0" />
          <div className="text-[10px] font-bold uppercase tracking-wider">
            SMTP CREDENTIALS NOT CONFIGURED. SYSTEM IS IN <span className="underline">MOCK MODE</span>. EMAILS WILL BE LOGGED BUT NOT SENT TO CUSTOMERS.
          </div>
        </div>
      )}

      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('audit')}
          className={`pb-2 text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'audit' ? 'border-b-2 border-[#141414] text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Audit Trail
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={`pb-2 text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'notifications' ? 'border-b-2 border-[#141414] text-[#141414]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Sent Notifications
        </button>
      </div>

      {activeTab === 'audit' ? (
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-widest uppercase italic">System Audit Trail (Last 100 entries)</h2>
            <FileText size={16} className="text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-gray-100 border-b border-[#141414]">
                  <th className="p-3 font-bold uppercase tracking-widest">Timestamp</th>
                  <th className="p-3 font-bold uppercase tracking-widest">User</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Action</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Entity</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-bold">{log.userName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-800' : 
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-gray-400 uppercase mr-1">{log.entityType}:</span>
                      <span className="font-bold">{log.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="p-3 text-gray-600 italic truncate max-w-xs">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-widest uppercase italic">Notification History (Last 100 entries)</h2>
            <Mail size={16} className="text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-gray-100 border-b border-[#141414]">
                  <th className="p-3 font-bold uppercase tracking-widest">Sent At</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Customer</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Machine</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Status</th>
                  <th className="p-3 font-bold uppercase tracking-widest">Message Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">No notifications found</td>
                  </tr>
                ) : (
                  filteredNotifications.map(notif => (
                    <tr 
                      key={notif.id} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedNotif(notif)}
                    >
                      <td className="p-3 text-gray-500">{new Date(notif.sentAt).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="font-bold">{notif.customerName}</div>
                        <div className="text-[9px] text-gray-400">{notif.customerEmail}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold">{notif.machineryModel}</div>
                        <div className="text-[9px] text-gray-400">ID: {notif.machineryId.slice(0, 8)}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          notif.status === 'SENT' ? 'bg-green-100 text-green-800' : 
                          notif.status === 'MOCKED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {notif.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 italic truncate max-w-xs">{notif.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-[#141414] bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-xs tracking-widest uppercase italic">Notification Details</h3>
              <button onClick={() => setSelectedNotif(null)} className="text-gray-400 hover:text-[#141414] transition-colors">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recipient</p>
                  <p className="text-sm font-bold">{selectedNotif.customerName}</p>
                  <p className="text-xs text-gray-500 font-mono">{selectedNotif.customerEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Machinery</p>
                  <p className="text-sm font-bold">{selectedNotif.machineryModel}</p>
                  <p className="text-xs text-gray-500 font-mono">ID: {selectedNotif.machineryId}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sent At</p>
                  <p className="text-xs font-mono">{new Date(selectedNotif.sentAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    selectedNotif.status === 'SENT' ? 'bg-green-100 text-green-800' : 
                    selectedNotif.status === 'MOCKED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedNotif.status}
                  </span>
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Message Content</p>
                <div className="bg-gray-50 p-4 border border-gray-200 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedNotif.message}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-[#141414] bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedNotif(null)}
                className="px-6 py-2 bg-[#141414] text-white text-[10px] font-bold tracking-widest hover:bg-gray-800 transition-all"
              >
                CLOSE
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-all ${
        active 
          ? 'bg-[#141414] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]' 
          : 'hover:bg-gray-100 text-gray-500'
      }`}
    >
      {icon}
      <span className="tracking-widest">{label}</span>
    </button>
  );
}

// --- View Components ---

function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ due: 0, active: 0, completed: 0 });
  const [dueMachinery, setDueMachinery] = useState<Machinery[]>([]);
  const [activeTickets, setActiveTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    if (!profile) return;
    // Fetch machinery due for service
    const qDue = query(collection(db, 'machinery'), where('status', '==', 'Due for Service'));
    const unsubDue = onSnapshot(qDue, (snap) => {
      setDueMachinery(snap.docs.map(d => ({ id: d.id, ...d.data() } as Machinery)));
      setStats(prev => ({ ...prev, due: snap.size }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'machinery'));

    // Fetch active tickets
    const qTickets = query(collection(db, 'serviceTickets'), where('status', 'in', ['Open', 'In Progress']));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      setActiveTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceTicket)));
      setStats(prev => ({ ...prev, active: snap.size }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'serviceTickets'));

    return () => { unsubDue(); unsubTickets(); };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="DUE FOR SERVICE" value={stats.due} icon={<AlertCircle className="text-red-600" />} color="bg-red-50" />
        <StatCard label="ACTIVE TICKETS" value={stats.active} icon={<Clock className="text-blue-600" />} color="bg-blue-50" />
        <StatCard label="COMPLETED TODAY" value={0} icon={<CheckCircle2 className="text-green-600" />} color="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Due Machinery */}
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="p-4 border-b border-[#141414] flex justify-between items-center">
            <h3 className="font-bold text-xs tracking-widest uppercase italic">Machinery Due for Service</h3>
            <AlertCircle size={16} className="text-red-600" />
          </div>
          <div className="divide-y divide-[#141414]">
            {dueMachinery.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-xs font-mono">NO MACHINERY CURRENTLY DUE</p>
            ) : (
              dueMachinery.map(m => (
                <div key={m.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 flex items-center justify-center border border-[#141414] shrink-0 ${
                      m.status === 'Operational' ? 'bg-green-50 text-green-600' : 
                      m.status === 'Due for Service' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {getMachineryIcon(m.type, 16)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{m.model} <span className="text-[10px] text-gray-400 font-mono ml-2">#{m.serialNumber}</span></p>
                      <p className="text-xs text-gray-500 uppercase tracking-tighter">{m.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-red-600 font-bold uppercase tracking-widest">Due: {m.nextServiceDueDate}</p>
                    <ChevronRight size={14} className="ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Tickets */}
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="p-4 border-b border-[#141414] flex justify-between items-center">
            <h3 className="font-bold text-xs tracking-widest uppercase italic">Ongoing Service Tickets</h3>
            <Ticket size={16} className="text-blue-600" />
          </div>
          <div className="divide-y divide-[#141414]">
            {activeTickets.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-xs font-mono">NO ACTIVE TICKETS</p>
            ) : (
              activeTickets.map(t => (
                <div key={t.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center group cursor-pointer">
                  <div>
                    <p className="font-bold text-sm truncate max-w-[200px]">{t.description}</p>
                    <p className="text-[10px] text-gray-500 font-mono uppercase">STATUS: {t.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-gray-400 uppercase">OPENED: {new Date(t.openedAt).toLocaleDateString()}</p>
                    <ChevronRight size={14} className="ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className={`p-6 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] bg-white ${color}`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-bold tracking-widest text-gray-500">{label}</span>
        {icon}
      </div>
      <p className="text-4xl font-bold tracking-tighter">{value}</p>
    </div>
  );
}

function CustomersView({ initialCustomerId, onCloseModal }: { initialCustomerId?: string | null, onCloseModal?: () => void }) {
  const { profile, canEditCustomers } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [initialCustomerId, customers]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'customers'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));
    return unsub;
  }, []);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="SEARCH CUSTOMERS..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#141414] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEditCustomers && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition-all"
          >
            <Plus size={16} /> ADD CUSTOMER
          </button>
        )}
      </div>

      <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-[#141414]">
              <th className="p-4 text-[10px] font-bold tracking-widest uppercase italic">Name</th>
              <th className="p-4 text-[10px] font-bold tracking-widest uppercase italic">Contact</th>
              <th className="p-4 text-[10px] font-bold tracking-widest uppercase italic">Address</th>
              <th className="p-4 text-[10px] font-bold tracking-widest uppercase italic">Registered</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]">
            {filtered.map(c => (
              <tr 
                key={c.id} 
                className="hover:bg-gray-50 transition-colors group cursor-pointer"
                onClick={() => setSelectedCustomer(c)}
              >
                <td className="p-4">
                  <p className="text-sm font-bold">{c.name}</p>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs flex items-center gap-1 text-gray-600"><Phone size={10} /> {c.phone}</span>
                    {c.email && <span className="text-xs flex items-center gap-1 text-gray-600"><Mail size={10} /> {c.email}</span>}
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{c.address || 'N/A'}</p>
                </td>
                <td className="p-4 font-mono text-[10px] text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <button className="p-2 hover:bg-gray-200 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding && <AddCustomerModal onClose={() => setIsAdding(false)} />}
      {selectedCustomer && (
        <CustomerDetailModal 
          customer={selectedCustomer} 
          onClose={() => {
            setSelectedCustomer(null);
            onCloseModal?.();
          }} 
        />
      )}
    </motion.div>
  );
}

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', address: '',
    invoiceDate: '', invoiceNumber: '', invoiceAmount: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        ...formData,
        invoiceAmount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0,
        createdAt: new Date().toISOString()
      });
      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'Customer', docRef.id, `Created customer: ${formData.name}`);
      }
      addToast(`Customer ${formData.name} registered successfully`, "success");
      onClose();
    } catch (err) {
      addToast("Failed to register customer", "error");
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <h2 className="text-xl font-bold mb-6 tracking-tighter uppercase italic">New Customer Registration</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Full Name *</label>
            <input 
              required
              type="text" 
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Phone *</label>
              <input 
                required
                type="tel" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Email</label>
              <input 
                type="email" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Address</label>
            <textarea 
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none h-20"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-[10px] font-bold tracking-widest text-[#141414] mb-3 uppercase italic">Initial Purchase Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                  value={formData.invoiceDate}
                  onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Number</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                  value={formData.invoiceNumber}
                  onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Amount ($)</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.invoiceAmount}
                onChange={e => setFormData({ ...formData, invoiceAmount: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'REGISTER CUSTOMER'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function CustomerDetailModal({ customer, onClose }: { customer: Customer, onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [formData, setFormData] = useState({ 
    name: customer.name, 
    email: customer.email || '', 
    phone: customer.phone, 
    address: customer.address || '',
    invoiceDate: customer.invoiceDate || '',
    invoiceNumber: customer.invoiceNumber || '',
    invoiceAmount: customer.invoiceAmount?.toString() || ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'machinery'), where('customerId', '==', customer.id));
    const unsub = onSnapshot(q, (snap) => {
      setMachinery(snap.docs.map(d => ({ id: d.id, ...d.data() } as Machinery)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'machinery'));
    return unsub;
  }, [customer.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        ...formData,
        invoiceAmount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0
      });
      if (profile) {
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Customer', customer.id, `Updated customer details: ${customer.name}`);
      }
      addToast("Customer information updated", "success");
      setIsEditing(false);
    } catch (err) {
      addToast("Failed to update customer", "error");
      handleFirestoreError(err, OperationType.UPDATE, `customers/${customer.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">Customer Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 border border-[#141414]">
            <Plus className="rotate-45" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Full Name *</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Phone *</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Address</label>
                  <textarea 
                    className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none h-20"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <h3 className="text-[10px] font-bold tracking-widest text-[#141414] uppercase italic">Invoice Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Date</label>
                      <input 
                        type="date" 
                        className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                        value={formData.invoiceDate}
                        onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Number</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                        value={formData.invoiceNumber}
                        onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Invoice Amount ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.invoiceAmount}
                      onChange={e => setFormData({ ...formData, invoiceAmount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'SAVING...' : 'SAVE CHANGES'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#141414] text-white border border-[#141414] flex items-center justify-center font-bold text-xl shadow-[2px_2px_0px_0px_rgba(20,20,20,0.2)]">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">{customer.name}</h3>
                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Customer ID: {customer.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Registered On</p>
                      <p className="text-xs font-mono font-bold">{new Date(customer.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border border-[#141414] bg-gray-50 flex flex-col justify-center items-center text-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Machinery</span>
                      <span className="text-2xl font-bold tracking-tighter">{machinery.length}</span>
                    </div>
                    <div className="p-3 border border-[#141414] bg-gray-50 flex flex-col justify-center items-center text-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Spent</span>
                      <span className="text-2xl font-bold tracking-tighter">
                        ${customer.invoiceAmount?.toLocaleString(undefined, { minimumFractionDigits: 0 }) || '0'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-[#141414] text-white p-5 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)] space-y-4">
                      <h4 className="text-[10px] font-bold tracking-widest uppercase italic border-b border-white/20 pb-1 flex items-center gap-2">
                        <UserIcon size={12} /> Contact Information
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-white/10 border border-white/20 flex items-center justify-center">
                            <Phone size={16} className="text-white" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Phone Number</p>
                            <p className="text-sm font-mono font-bold">{customer.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-white/10 border border-white/20 flex items-center justify-center">
                            <Mail size={16} className="text-white" />
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Email Address</p>
                            <p className="text-sm font-mono font-bold truncate">{customer.email || 'NOT PROVIDED'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border border-[#141414] bg-white shadow-[2px_2px_0px_0px_rgba(20,20,20,0.05)]">
                      <MapPin size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Physical Address</p>
                        <p className="text-sm font-mono leading-relaxed">{customer.address || 'NO ADDRESS RECORDED'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-gray-50 border border-[#141414] space-y-4">
                    <h4 className="text-[10px] font-bold tracking-widest uppercase italic border-b border-gray-200 pb-1 flex items-center gap-2">
                      <FileText size={12} /> Purchase Invoice Details
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Invoice Date</p>
                        <p className="text-sm font-mono font-bold">{customer.invoiceDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Invoice Number</p>
                        <p className="text-sm font-mono font-bold">{customer.invoiceNumber || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Invoice Amount</p>
                      <p className="text-xl font-bold font-mono text-[#141414]">
                        {customer.invoiceAmount ? `$${customer.invoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'NOT SPECIFIED'}
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  <Settings size={14} /> EDIT CUSTOMER PROFILE
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold tracking-widest uppercase italic border-b border-[#141414] pb-2">Owned Machinery</h3>
            <div className="space-y-3">
              {machinery.length === 0 ? (
                <p className="text-[10px] text-gray-400 font-mono uppercase py-4 text-center border border-dashed border-gray-200">No machinery registered</p>
              ) : (
                machinery.map(m => (
                  <div key={m.id} className="p-3 border border-[#141414] bg-gray-50 flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center border border-[#141414] bg-white shrink-0 text-gray-400">
                      {getMachineryIcon(m.type, 20)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="text-sm font-bold uppercase tracking-tight truncate">{m.model}</h4>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 border border-[#141414] uppercase shrink-0 ${
                          m.status === 'Operational' ? 'bg-green-100 text-green-800' : 
                          m.status === 'Due for Service' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 font-mono uppercase truncate">{m.type} • #{m.serialNumber}</p>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-400 font-mono">
                        <Clock size={10} />
                        <span>NEXT SERVICE: {m.nextServiceDueDate || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MachineryView({ onViewHistory, onViewCustomer }: { onViewHistory?: (id: string) => void, onViewCustomer?: (id: string) => void }) {
  const { profile, canEditMachinery } = useAuth();
  const { addToast } = useToast();
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<MachineryStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<MachineryType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'machinery'));
    const unsub = onSnapshot(q, (snap) => {
      setMachinery(snap.docs.map(d => ({ id: d.id, ...d.data() } as Machinery)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'machinery'));

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach(d => map[d.id] = d.data().name);
      setCustomers(map);
    });

    return () => { unsub(); unsubCust(); };
  }, [profile]);

  const handleDownloadReport = async (m: Machinery) => {
    setLoadingReport(m.id);
    try {
      // 1. Get Customer
      const customerDoc = await getDoc(doc(db, 'customers', m.customerId));
      if (!customerDoc.exists()) throw new Error("Customer not found");
      const customer = { id: customerDoc.id, ...customerDoc.data() } as Customer;

      // 2. Get all Tickets for this machine
      const q = query(collection(db, 'serviceTickets'), where('machineryId', '==', m.id), orderBy('openedAt', 'desc'));
      const ticketsSnap = await getDocs(q);
      const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceTicket));

      // 3. Get logs for all tickets
      const allLogs: Record<string, ServiceLog[]> = {};
      for (const t of tickets) {
        const logsSnap = await getDocs(query(collection(db, 'serviceTickets', t.id, 'logs'), orderBy('timestamp', 'asc')));
        allLogs[t.id] = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceLog));
      }

      generateMachineryFullReport(m, customer, tickets, allLogs);
      
      if (profile) {
        await logAudit(profile.uid, profile.name, 'DOWNLOAD', 'MachineryReport', m.id, `Generated full report for ${m.model} (${m.serialNumber})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'machinery_report');
    } finally {
      setLoadingReport(null);
    }
  };

  const filtered = machinery.filter(m => {
    const matchesStatus = filter === 'ALL' || m.status === filter;
    const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
    const customerName = customers[m.customerId] || '';
    const matchesSearch = 
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      customerName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const handleBulkStatusUpdate = async (status: MachineryStatus) => {
    if (selectedIds.size === 0 || !profile) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      const selectedMachinery = machinery.filter(m => selectedIds.has(m.id));
      
      for (const m of selectedMachinery) {
        const ref = doc(db, 'machinery', m.id);
        batch.update(ref, { status });
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', m.id, `Bulk status update to ${status}`);
      }
      
      await batch.commit();
      const count = selectedIds.size;
      setSelectedIds(new Set());
      addToast(`Successfully updated ${count} machines to ${status}`, "success");
    } catch (err) {
      addToast("Bulk update failed", "error");
      handleFirestoreError(err, OperationType.UPDATE, 'machinery_bulk');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDownloadReports = async () => {
    if (selectedIds.size === 0) return;
    const selectedMachinery = machinery.filter(m => selectedIds.has(m.id));
    
    // Process one by one to avoid overwhelming or browser blocks
    for (const m of selectedMachinery) {
      await handleDownloadReport(m);
    }
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="bg-[#141414] text-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] flex flex-col md:flex-row justify-between items-center gap-4 sticky top-20 z-20"
          >
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold tracking-widest">{selectedIds.size} MACHINES SELECTED</span>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] underline uppercase tracking-widest opacity-60 hover:opacity-100"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border-r border-white/20 pr-3">
                <span className="text-[10px] font-bold opacity-60 uppercase">Set Status:</span>
                <select 
                  disabled={isBulkUpdating}
                  onChange={(e) => e.target.value && handleBulkStatusUpdate(e.target.value as MachineryStatus)}
                  className="bg-transparent border border-white/40 text-[10px] font-bold p-1 focus:outline-none uppercase"
                  value=""
                >
                  <option value="" className="text-black">SELECT...</option>
                  <option value="Operational" className="text-black">Operational</option>
                  <option value="Due for Service" className="text-black">Due for Service</option>
                  <option value="Under Repair" className="text-black">Under Repair</option>
                </select>
              </div>
              <button 
                onClick={handleBulkDownloadReports}
                className="px-4 py-1.5 bg-white text-[#141414] text-[10px] font-bold tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <Download size={14} /> DOWNLOAD REPORTS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-start sm:items-center">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              className="w-4 h-4 accent-[#141414] cursor-pointer"
              checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
              onChange={toggleSelectAll}
              title="Select All Filtered"
            />
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH MACHINERY..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#141414] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2 border-r border-[#141414] pr-2">
              <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="ALL" />
              <FilterButton active={filter === 'Operational'} onClick={() => setFilter('Operational')} label="OPERATIONAL" />
              <FilterButton active={filter === 'Due for Service'} onClick={() => setFilter('Due for Service')} label="DUE" />
              <FilterButton active={filter === 'Under Repair'} onClick={() => setFilter('Under Repair')} label="REPAIR" />
            </div>
            <select 
              className="px-3 py-1.5 text-[10px] font-bold tracking-widest border border-[#141414] bg-white focus:outline-none uppercase"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="ALL">ALL TYPES</option>
              <option value="Tractor">Tractor</option>
              <option value="Generator">Generator</option>
              <option value="Water pump">Water pump</option>
              <option value="Electric Motors">Electric Motors</option>
              <option value="Transformers">Transformers</option>
              <option value="Bow Mills">Bow Mills</option>
              <option value="Jaw Crusher">Jaw Crusher</option>
              <option value="Electric Compressors">Electric Compressors</option>
              <option value="Diesel Compressors">Diesel Compressors</option>
              <option value="Engines">Engines</option>
            </select>
          </div>
        </div>
        {canEditMachinery && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shrink-0"
          >
            <Plus size={16} /> ADD MACHINERY
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(m => (
          <div 
            key={m.id} 
            className={`bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-6 group hover:-translate-y-1 transition-all relative ${
              selectedIds.has(m.id) ? 'ring-2 ring-[#141414] bg-gray-50' : ''
            }`}
          >
            <div className="absolute top-4 right-4 z-10">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-[#141414] cursor-pointer"
                checked={selectedIds.has(m.id)}
                onChange={() => toggleSelect(m.id)}
              />
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`text-[9px] font-bold px-2 py-0.5 border border-[#141414] uppercase flex items-center gap-1.5 ${
                  m.status === 'Operational' ? 'bg-green-100 text-green-800' : 
                  m.status === 'Due for Service' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    m.status === 'Operational' ? 'bg-green-600' : 
                    m.status === 'Due for Service' ? 'bg-red-600' : 'bg-yellow-600'
                  }`} />
                  {m.status}
                </span>
                <h3 className="text-lg font-bold mt-2 tracking-tight">{m.model}</h3>
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{m.type} • #{m.serialNumber}</p>
              </div>
              <div className="text-gray-300 group-hover:text-[#141414] transition-colors">
                {getMachineryIcon(m.type, 28)}
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => onViewCustomer?.(m.customerId)}
                className="flex items-center gap-2 text-xs hover:text-blue-600 transition-colors group/cust"
              >
                <UserIcon size={12} className="text-gray-400 group-hover/cust:text-blue-600" />
                <span className="font-bold uppercase underline decoration-dotted underline-offset-2">{customers[m.customerId] || 'Unknown Customer'}</span>
              </button>
              <div className="flex items-center gap-2 text-xs">
                <Calendar size={12} className="text-gray-400" />
                <span className="text-gray-600">Warranty Expiry: <span className="font-mono">{m.warrantyExpiry}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock size={12} className="text-gray-400" />
                <span className="text-gray-600">Next Service: <span className="font-mono font-bold text-red-600">{m.nextServiceDueDate || 'N/A'}</span></span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => onViewHistory?.(m.id)}
                className="flex-1 py-2 border border-[#141414] text-[10px] font-bold tracking-widest hover:bg-[#141414] hover:text-white transition-all uppercase"
              >
                VIEW DETAILS
              </button>
              <button 
                onClick={() => handleDownloadReport(m)}
                disabled={loadingReport === m.id}
                className="px-4 py-2 bg-white border border-[#141414] text-[10px] font-bold tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                title="Download Full Report"
              >
                {loadingReport === m.id ? <Clock size={14} className="animate-spin" /> : <Download size={14} />}
                REPORT
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdding && <AddMachineryModal onClose={() => setIsAdding(false)} />}
    </motion.div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] font-bold tracking-widest border border-[#141414] transition-all ${
        active ? 'bg-[#141414] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function AddMachineryModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ 
    customerId: '', type: 'Tractor' as MachineryType, model: '', serialNumber: '', 
    purchaseDate: '', warrantyExpiry: '', nextServiceDueDate: '', status: 'Operational' as MachineryStatus 
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'customers')).then(snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'machinery'), formData);
      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'Machinery', docRef.id, `Created machinery: ${formData.model} (${formData.serialNumber})`);
      }
      addToast(`Machinery ${formData.model} registered successfully`, "success");
      onClose();
    } catch (err) {
      addToast("Failed to register machinery", "error");
      handleFirestoreError(err, OperationType.CREATE, 'machinery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <h2 className="text-xl font-bold mb-6 tracking-tighter uppercase italic">Register New Machinery</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Owner / Customer *</label>
            <select 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
              value={formData.customerId}
              onChange={e => setFormData({ ...formData, customerId: e.target.value })}
            >
              <option value="">SELECT CUSTOMER...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Machine Type *</label>
              <select 
                required
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as MachineryType })}
              >
                <option value="Tractor">Tractor</option>
                <option value="Generator">Generator</option>
                <option value="Water pump">Water pump</option>
                <option value="Electric Motors">Electric Motors</option>
                <option value="Transformers">Transformers</option>
                <option value="Bow Mills">Bow Mills</option>
                <option value="Jaw Crusher">Jaw Crusher</option>
                <option value="Electric Compressors">Electric Compressors</option>
                <option value="Diesel Compressors">Diesel Compressors</option>
                <option value="Engines">Engines</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Model Name *</label>
              <input 
                required
                type="text" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Serial Number *</label>
              <input 
                required
                type="text" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Purchase Date</label>
              <input 
                type="date" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.purchaseDate}
                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Warranty Expiry *</label>
              <input 
                required
                type="date" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.warrantyExpiry}
                onChange={e => setFormData({ ...formData, warrantyExpiry: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Next Service Due</label>
              <input 
                type="date" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.nextServiceDueDate}
                onChange={e => setFormData({ ...formData, nextServiceDueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'REGISTER MACHINERY'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TicketsView() {
  const { profile, canEditTickets } = useAuth();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [machinery, setMachinery] = useState<Record<string, Machinery>>({});
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [mechanics, setMechanics] = useState<Record<string, UserProfile>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'serviceTickets'), orderBy('openedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceTicket)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'serviceTickets'));

    const unsubMach = onSnapshot(collection(db, 'machinery'), (snap) => {
      const map: Record<string, Machinery> = {};
      snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() } as Machinery);
      setMachinery(map);
    });

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      const map: Record<string, Customer> = {};
      snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() } as Customer);
      setCustomers(map);
    });

    const unsubMech = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, UserProfile> = {};
      snap.docs.forEach(d => map[d.id] = { uid: d.id, ...d.data() } as UserProfile);
      setMechanics(map);
    });

    return () => { unsub(); unsubMach(); unsubCust(); unsubMech(); };
  }, []);

  const filteredTickets = tickets.filter(t => {
    const machine = machinery[t.machineryId];
    const customer = customers[t.customerId];
    const mechanic = t.mechanicId ? mechanics[t.mechanicId] : null;
    
    const searchLower = searchTerm.toLowerCase();
    
    return (
      (machine?.model || '').toLowerCase().includes(searchLower) ||
      (customer?.name || '').toLowerCase().includes(searchLower) ||
      (mechanic?.name || '').toLowerCase().includes(searchLower) ||
      t.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text"
            placeholder="SEARCH BY MACHINE, CUSTOMER, OR MECHANIC..."
            className="w-full pl-10 pr-4 py-2 border border-[#141414] text-xs font-mono focus:outline-none bg-white shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {canEditTickets && (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full md:w-auto px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <Plus size={16} /> OPEN NEW TICKET
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-white border border-[#141414] p-12 text-center shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <Ticket size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">No matching service tickets found.</p>
          </div>
        ) : (
          filteredTickets.map(t => (
            <div 
              key={t.id} 
              onClick={() => setSelectedTicket(t)}
              className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:translate-x-1 transition-transform cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 flex items-center justify-center border border-[#141414] ${
                  t.status === 'Open' ? 'bg-red-50 text-red-600' : 
                  t.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>
                  {(() => {
                    const m = machinery[t.machineryId];
                    return m ? getMachineryIcon(m.type, 24) : <Ticket size={24} />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 border border-[#141414] uppercase">{t.status}</span>
                    <span className="text-[10px] font-mono text-gray-400">ID: {t.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="font-bold text-sm tracking-tight">{machinery[t.machineryId]?.model || 'Unknown Machine'}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                      <Users size={10} /> {customers[t.customerId]?.name || 'Unknown Customer'}
                    </p>
                    {t.mechanicId && (
                      <p className="text-[10px] text-blue-600 font-bold uppercase flex items-center gap-1">
                        <Wrench size={10} /> {mechanics[t.mechanicId]?.name || 'Unknown Mechanic'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opened At</p>
                  <p className="text-xs font-mono">{new Date(t.openedAt).toLocaleString()}</p>
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && <AddTicketModal onClose={() => setIsAdding(false)} />}
      {selectedTicket && <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
    </motion.div>
  );
}

function AddTicketModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ machineryId: '', description: '', mechanicId: profile?.uid || '' });
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mechanics, setMechanics] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  useEffect(() => {
    if (profile?.uid && profile.role === 'Field Technician' && !formData.mechanicId) {
      setFormData(prev => ({ ...prev, mechanicId: profile.uid }));
    }
  }, [profile?.uid, profile?.role]);

  useEffect(() => {
    getDocs(collection(db, 'machinery')).then(snap => {
      setMachinery(snap.docs.map(d => ({ id: d.id, ...d.data() } as Machinery)));
    });
    getDocs(collection(db, 'customers')).then(snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });
    getDocs(collection(db, 'users')).then(snap => {
      setMechanics(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });
  }, []);

  // Filter machinery based on selected customer
  const filteredMachinery = selectedCustomerId 
    ? machinery.filter(m => m.customerId === selectedCustomerId)
    : machinery;

  const handleMachineChange = (machineId: string) => {
    setFormData({ ...formData, machineryId: machineId });
    if (machineId) {
      const machine = machinery.find(m => m.id === machineId);
      if (machine) {
        setSelectedCustomerId(machine.customerId);
      }
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    // If current machine doesn't belong to new customer, reset it
    const currentMachine = machinery.find(m => m.id === formData.machineryId);
    if (currentMachine && currentMachine.customerId !== customerId) {
      setFormData({ ...formData, machineryId: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machineryId || !selectedCustomerId || !formData.mechanicId) {
      addToast("Please fill in all required fields", "error");
      return;
    }
    
    setLoading(true);
    const machine = machinery.find(m => m.id === formData.machineryId);
    if (!machine) return;

    try {
      const docRef = await addDoc(collection(db, 'serviceTickets'), {
        machineryId: formData.machineryId,
        description: formData.description,
        customerId: selectedCustomerId,
        mechanicId: formData.mechanicId,
        status: 'Open',
        openedAt: new Date().toISOString()
      });
      // Update machinery status to Under Repair
      await updateDoc(doc(db, 'machinery', machine.id), { status: 'Under Repair' });
      
      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'ServiceTicket', docRef.id, `Created ticket: ${formData.description}`);
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', machine.id, 'Status changed to Under Repair');
      }
      addToast("Service ticket opened successfully", "success");
      onClose();
    } catch (err) {
      addToast("Failed to open ticket", "error");
      handleFirestoreError(err, OperationType.CREATE, 'serviceTickets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <h2 className="text-xl font-bold mb-6 tracking-tighter uppercase italic">Open Service Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Select Customer *</label>
            <select 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
              value={selectedCustomerId}
              onChange={e => handleCustomerChange(e.target.value)}
            >
              <option value="">SELECT CUSTOMER...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Select Machinery *</label>
            <select 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
              value={formData.machineryId}
              onChange={e => handleMachineChange(e.target.value)}
            >
              <option value="">SELECT MACHINE...</option>
              {filteredMachinery.map(m => (
                <option key={m.id} value={m.id}>
                  {m.model} ({m.serialNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Assign Mechanic *</label>
            <select 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
              value={formData.mechanicId}
              onChange={e => setFormData({ ...formData, mechanicId: e.target.value })}
            >
              <option value="">SELECT MECHANIC...</option>
              {mechanics.map(m => (
                <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Problem Description *</label>
            <textarea 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none h-32"
              placeholder="DESCRIBE THE ISSUE OR SERVICE REQUIRED..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors">CANCEL</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? 'OPENING...' : 'OPEN TICKET'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TicketDetailModal({ ticket, onClose }: { ticket: ServiceTicket, onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [machinery, setMachinery] = useState<Machinery | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [mechanic, setMechanic] = useState<UserProfile | null>(null);
  const [newLog, setNewLog] = useState({ workDone: '', partsReplaced: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'serviceTickets', ticket.id, 'logs'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceLog)));
    });

    // Fetch related data for PDF
    getDoc(doc(db, 'machinery', ticket.machineryId))
      .then(d => setMachinery({ id: d.id, ...d.data() } as Machinery))
      .catch(err => handleFirestoreError(err, OperationType.GET, `machinery/${ticket.machineryId}`));
    
    getDoc(doc(db, 'customers', ticket.customerId))
      .then(d => setCustomer({ id: d.id, ...d.data() } as Customer))
      .catch(err => handleFirestoreError(err, OperationType.GET, `customers/${ticket.customerId}`));

    if (ticket.mechanicId) {
      getDoc(doc(db, 'users', ticket.mechanicId))
        .then(d => setMechanic({ uid: d.id, ...d.data() } as UserProfile))
        .catch(err => handleFirestoreError(err, OperationType.GET, `users/${ticket.mechanicId}`));
    }

    return unsub;
  }, [ticket.id, ticket.machineryId, ticket.customerId, ticket.mechanicId]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.workDone) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'serviceTickets', ticket.id, 'logs'), {
        ...newLog,
        ticketId: ticket.id,
        mechanicId: profile?.uid,
        timestamp: new Date().toISOString()
      });
      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'ServiceLog', docRef.id, `Added log to ticket ${ticket.id}: ${newLog.workDone}`);
      }
      // If ticket was "Open", move to "In Progress"
      if (ticket.status === 'Open') {
        await updateDoc(doc(db, 'serviceTickets', ticket.id), { status: 'In Progress' });
        if (profile) {
          await logAudit(profile.uid, profile.name, 'UPDATE', 'ServiceTicket', ticket.id, 'Status changed to In Progress');
        }
      }
      addToast("Service log added successfully", "success");
      setNewLog({ workDone: '', partsReplaced: '' });
    } catch (err) {
      addToast("Failed to add service log", "error");
      handleFirestoreError(err, OperationType.CREATE, 'serviceLogs');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTicket = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'serviceTickets', ticket.id), { 
        status: 'Completed',
        closedAt: new Date().toISOString()
      });
      // Update machinery status back to Operational
      await updateDoc(doc(db, 'machinery', ticket.machineryId), { 
        status: 'Operational',
        lastServiceDate: new Date().toISOString().split('T')[0]
      });
      if (profile) {
        await logAudit(profile.uid, profile.name, 'UPDATE', 'ServiceTicket', ticket.id, 'Status changed to Completed');
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', ticket.machineryId, 'Status changed to Operational');
      }
      addToast("Service ticket completed successfully", "success");
      onClose();
    } catch (err) {
      addToast("Failed to complete ticket", "error");
      handleFirestoreError(err, OperationType.UPDATE, 'serviceTickets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] max-w-4xl w-full h-[90vh] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] flex flex-col"
      >
        <div className="p-6 border-b border-[#141414] flex justify-between items-start bg-gray-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center border border-[#141414] bg-[#141414] text-white shrink-0 mt-1">
              {machinery ? getMachineryIcon(machinery.type, 24) : <Construction size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#141414] text-white uppercase tracking-widest">{ticket.status}</span>
                <span className="text-[10px] font-mono text-gray-400 uppercase">TICKET #{ticket.id.slice(0, 8)}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tighter uppercase italic">{ticket.description}</h2>
              {machinery && <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-1">{machinery.model} • #{machinery.serialNumber}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 transition-colors border border-[#141414]">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Logs & Interaction */}
          <div className="lg:col-span-2 space-y-8">
            {ticket.status !== 'Completed' && (
              <div className="bg-gray-50 border border-[#141414] p-6">
                <h3 className="text-xs font-bold tracking-widest uppercase mb-4 italic">Log New Work Entry</h3>
                <form onSubmit={handleAddLog} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Work Done *</label>
                    <textarea 
                      required
                      className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none h-20"
                      placeholder="WHAT WORK WAS PERFORMED?"
                      value={newLog.workDone}
                      onChange={e => setNewLog({ ...newLog, workDone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Parts Replaced</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                      placeholder="LIST ANY PARTS REPLACED..."
                      value={newLog.partsReplaced}
                      onChange={e => setNewLog({ ...newLog, partsReplaced: e.target.value })}
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'LOGGING...' : 'ADD LOG ENTRY'}
                  </button>
                </form>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-bold tracking-widest uppercase italic">Service Log History</h3>
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-xs font-mono border border-dashed border-gray-300">NO LOGS RECORDED YET</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="p-4 border border-[#141414] bg-white relative">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">MECHANIC ID: {log.mechanicId.slice(0, 5)}</span>
                      </div>
                      <p className="text-sm mb-3 font-medium">{log.workDone}</p>
                      {log.partsReplaced && (
                        <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold bg-blue-50 p-1.5 border border-blue-100">
                          <Settings size={10} /> PARTS: {log.partsReplaced}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Info & Actions */}
          <div className="space-y-6">
            <div className="bg-white border border-[#141414] p-6 space-y-4">
              <h3 className="text-xs font-bold tracking-widest uppercase italic border-b border-[#141414] pb-2">Ticket Info</h3>
              <div className="space-y-3">
                <InfoItem label="Opened" value={new Date(ticket.openedAt).toLocaleDateString()} />
                {ticket.closedAt && <InfoItem label="Closed" value={new Date(ticket.closedAt).toLocaleDateString()} />}
                <InfoItem label="Machine ID" value={ticket.machineryId.slice(0, 8)} />
                <InfoItem label="Customer ID" value={ticket.customerId.slice(0, 8)} />
                {mechanic && <InfoItem label="Assigned To" value={mechanic.name} />}
              </div>
            </div>

            {ticket.status === 'Completed' && machinery && customer && (
              <button 
                onClick={() => generatePDFReport(ticket, machinery, customer, logs)}
                className="w-full py-4 border border-[#141414] bg-white text-[#141414] font-bold text-sm tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={18} /> DOWNLOAD PDF REPORT
              </button>
            )}

            {ticket.status !== 'Completed' && (
              <button 
                onClick={handleCompleteTicket}
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white font-bold text-sm tracking-widest hover:bg-green-700 transition-all shadow-[4px_4px_0px_0px_rgba(22,101,52,1)] disabled:opacity-50"
              >
                COMPLETE SERVICE
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-gray-400 font-bold uppercase tracking-widest">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

const generatePDFReport = async (ticket: ServiceTicket, machinery: Machinery, customer: Customer, logs: ServiceLog[]) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [20, 20, 20]; // #141414

  // Header
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('MACHINERY SERVICE TRACKER', 105, 15, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('SERVICE REPORT', 105, 25, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`TICKET ID: ${ticket.id}`, 105, 33, { align: 'center' });

  // Customer Info
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('CUSTOMER DETAILS', 20, 50);
  doc.line(20, 52, 190, 52);
  
  doc.setFontSize(10);
  doc.text(`Name: ${customer.name}`, 20, 60);
  doc.text(`Phone: ${customer.phone}`, 20, 67);
  doc.text(`Email: ${customer.email || 'N/A'}`, 20, 74);
  doc.text(`Address: ${customer.address || 'N/A'}`, 20, 81);

  // Machinery Info
  doc.setFontSize(12);
  doc.text('MACHINERY DETAILS', 20, 100);
  doc.line(20, 102, 190, 102);
  
  doc.setFontSize(10);
  doc.text(`Type: ${machinery.type}`, 20, 110);
  doc.text(`Model: ${machinery.model}`, 20, 117);
  doc.text(`Serial Number: ${machinery.serialNumber}`, 20, 124);
  doc.text(`Warranty Expiry: ${machinery.warrantyExpiry}`, 20, 131);

  // Service Info
  doc.setFontSize(12);
  doc.text('SERVICE SUMMARY', 20, 150);
  doc.line(20, 152, 190, 152);
  
  doc.setFontSize(10);
  doc.text(`Description: ${ticket.description}`, 20, 160);
  doc.text(`Opened: ${new Date(ticket.openedAt).toLocaleString()}`, 20, 167);
  if (ticket.closedAt) {
    doc.text(`Completed: ${new Date(ticket.closedAt).toLocaleString()}`, 20, 174);
  }

  // Work Logs Table
  const tableData = logs.map(log => [
    new Date(log.timestamp).toLocaleDateString(),
    log.workDone,
    log.partsReplaced || '-'
  ]);

  autoTable(doc, {
    startY: 185,
    head: [['Date', 'Work Performed', 'Parts Replaced']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 4 },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
  }

  doc.save(`Service_Report_${ticket.id.slice(0, 8)}.pdf`);
};

const generateMachineryFullReport = (machinery: Machinery, customer: Customer, tickets: ServiceTicket[], allLogs: Record<string, ServiceLog[]>) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [20, 20, 20]; // #141414

  // Header
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('MACHINERY SERVICE TRACKER', 105, 15, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('MACHINERY FULL REPORT', 105, 25, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`SERIAL NUMBER: ${machinery.serialNumber}`, 105, 33, { align: 'center' });

  // Machine Details
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('MACHINERY SPECIFICATIONS', 20, 50);
  doc.line(20, 52, 190, 52);
  
  doc.setFontSize(10);
  doc.text(`Type: ${machinery.type}`, 20, 60);
  doc.text(`Model: ${machinery.model}`, 20, 67);
  doc.text(`Purchase Date: ${machinery.purchaseDate || 'N/A'}`, 20, 74);
  doc.text(`Warranty Expiry: ${machinery.warrantyExpiry}`, 20, 81);
  doc.text(`Current Status: ${machinery.status}`, 20, 88);

  // Owner Info
  doc.setFontSize(12);
  doc.text('OWNER DETAILS', 20, 105);
  doc.line(20, 107, 190, 107);
  
  doc.setFontSize(10);
  doc.text(`Name: ${customer.name}`, 20, 115);
  doc.text(`Phone: ${customer.phone}`, 20, 122);
  doc.text(`Email: ${customer.email || 'N/A'}`, 20, 129);
  doc.text(`Address: ${customer.address || 'N/A'}`, 20, 136);

  // Service History Summary
  doc.setFontSize(12);
  doc.text('SERVICE HISTORY SUMMARY', 20, 155);
  doc.line(20, 157, 190, 157);

  const tableData = tickets.map(t => [
    new Date(t.openedAt).toLocaleDateString(),
    t.description,
    t.status,
    t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '-'
  ]);

  autoTable(doc, {
    startY: 165,
    head: [['Opened', 'Description', 'Status', 'Closed']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 4 },
  });

  // Detailed Logs
  let currentY = (doc as any).lastAutoTable.finalY + 15;
  
  if (tickets.length > 0) {
    doc.setFontSize(12);
    doc.text('DETAILED WORK LOGS', 20, currentY);
    doc.line(20, currentY + 2, 190, currentY + 2);
    currentY += 10;

    tickets.forEach((t) => {
      const logs = allLogs[t.id] || [];
      if (logs.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Ticket: ${t.description} (${new Date(t.openedAt).toLocaleDateString()})`, 20, currentY);
        currentY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        logs.forEach(log => {
          const logText = `- ${new Date(log.timestamp).toLocaleDateString()}: ${log.workDone}${log.partsReplaced ? ` (Parts: ${log.partsReplaced})` : ''}`;
          const splitText = doc.splitTextToSize(logText, 160);
          doc.text(splitText, 25, currentY);
          currentY += (splitText.length * 5);
          
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }
        });
        currentY += 4;
      }
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
  }

  doc.save(`Machinery_Report_${machinery.serialNumber}.pdf`);
};

function HistoryView({ initialMachineId, onViewCustomer }: { initialMachineId?: string | null, onViewCustomer?: (id: string) => void }) {
  const { profile } = useAuth();
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [selectedId, setSelectedId] = useState<string | null>(initialMachineId || null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, 'machinery'))
      .then(snap => {
        setMachinery(snap.docs.map(d => ({ id: d.id, ...d.data() } as Machinery)));
      })
      .catch(err => handleFirestoreError(err, OperationType.LIST, 'machinery'));

    getDocs(collection(db, 'customers'))
      .then(snap => {
        const map: Record<string, Customer> = {};
        snap.docs.forEach(d => map[d.id] = { id: d.id, ...d.data() } as Customer);
        setCustomers(map);
      })
      .catch(err => handleFirestoreError(err, OperationType.LIST, 'customers'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    const q = query(collection(db, 'serviceTickets'), where('machineryId', '==', selectedId), orderBy('openedAt', 'desc'));
    getDocs(q)
      .then(snap => {
        setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceTicket)));
        setLoading(false);
      })
      .catch(err => {
        handleFirestoreError(err, OperationType.LIST, 'serviceTickets');
        setLoading(false);
      });
  }, [selectedId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-2 uppercase">Select Machinery to View History</label>
        <select 
          className="w-full p-3 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">SELECT MACHINE...</option>
          {machinery.map(m => <option key={m.id} value={m.id}>{m.model} (#{m.serialNumber})</option>)}
        </select>
      </div>

      {!selectedId ? (
        <div className="flex items-center justify-center h-64 border border-dashed border-[#141414]">
          <div className="text-center">
            <History size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase italic">Select a machine above to see its full history.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-[#141414] pb-4">
            <div className="w-12 h-12 flex items-center justify-center border border-[#141414] bg-[#141414] text-white shrink-0">
              {(() => {
                const m = machinery.find(m => m.id === selectedId);
                return m ? getMachineryIcon(m.type, 24) : <Construction size={24} />;
              })()}
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-widest uppercase italic text-gray-400">Service History for</h3>
              <div className="flex items-baseline gap-3">
                <p className="text-xl font-bold tracking-tighter uppercase">{machinery.find(m => m.id === selectedId)?.model}</p>
                {(() => {
                  const m = machinery.find(m => m.id === selectedId);
                  const customer = m ? customers[m.customerId] : null;
                  return customer ? (
                    <button 
                      onClick={() => onViewCustomer?.(customer.id)}
                      className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-widest flex items-center gap-1"
                    >
                      <UserIcon size={10} /> {customer.name}
                    </button>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          {tickets.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-xs font-mono border border-[#141414] bg-white">NO SERVICE HISTORY FOUND</p>
          ) : (
            <div className="space-y-6">
              {tickets.map(t => (
                <div key={t.id} className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-[#141414] text-white uppercase mr-3">{t.status}</span>
                      <span className="text-xs font-bold uppercase">{t.description}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">{new Date(t.openedAt).toLocaleDateString()}</span>
                  </div>
                  <TicketLogs 
                    ticketId={t.id} 
                    ticket={t} 
                    machinery={machinery.find(m => m.id === selectedId)} 
                    customer={customers[t.customerId]} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function TicketLogs({ ticketId, ticket, machinery, customer }: { ticketId: string, ticket?: ServiceTicket, machinery?: Machinery, customer?: Customer }) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ServiceLog[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'serviceTickets', ticketId, 'logs'), orderBy('timestamp', 'asc'));
    getDocs(q)
      .then(snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceLog)));
      })
      .catch(err => handleFirestoreError(err, OperationType.LIST, `serviceTickets/${ticketId}/logs`));
  }, [ticketId]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Logs</h4>
        {ticket && machinery && customer && ticket.status === 'Completed' && (
          <button 
            onClick={() => generatePDFReport(ticket, machinery, customer, logs)}
            className="flex items-center gap-1 text-[9px] font-bold hover:underline"
          >
            <Download size={10} /> PDF REPORT
          </button>
        )}
      </div>
      {logs.map(log => (
        <div key={log.id} className="pl-4 border-l-2 border-[#141414] py-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
            <span className="text-[9px] font-mono text-gray-300">MECH: {log.mechanicId.slice(0, 5)}</span>
          </div>
          <p className="text-xs">{log.workDone}</p>
          {log.partsReplaced && <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase">Parts: {log.partsReplaced}</p>}
        </div>
      ))}
    </div>
  );
}

function MechanicsView() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [mechanics, setMechanics] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMechanics(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return unsub;
  }, []);

  const handleDelete = async (uid: string) => {
    if (uid === profile?.uid) {
      addToast("You cannot delete your own account", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this team member?")) return;

    try {
      await deleteDoc(doc(db, 'users', uid));
      if (profile) {
        await logAudit(profile.uid, profile.name, 'DELETE', 'User', uid, 'Removed team member');
      }
      addToast("Team member removed successfully", "success");
    } catch (err) {
      addToast("Failed to remove team member", "error");
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase italic">Team & Personnel Management</h2>
        <button 
          onClick={() => { setEditingMechanic(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition-all"
        >
          <Plus size={16} /> ADD TEAM MEMBER
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mechanics.map(m => (
          <div key={m.uid} className="bg-white border border-[#141414] p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-[#141414] text-white rounded-full flex items-center justify-center text-xl font-bold">
                  {m.name.charAt(0)}
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 border border-[#141414] uppercase ${
                  m.role === 'Administrator' ? 'bg-red-50 text-red-600' : 
                  m.role === 'Manager' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                }`}>
                  {m.role}
                </span>
              </div>
              <h3 className="text-lg font-bold tracking-tight uppercase mb-1">{m.name}</h3>
              <p className="text-xs text-gray-400 font-mono mb-4">{m.email}</p>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                  <span>Joined</span>
                  <span className="font-mono text-[#141414]">{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                  <span>ID</span>
                  <span className="font-mono text-[#141414]">{m.uid.slice(0, 8)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <button 
                onClick={() => { setEditingMechanic(m); setIsModalOpen(true); }}
                className="flex-1 py-2 border border-[#141414] text-[10px] font-bold hover:bg-gray-50 transition-colors uppercase"
              >
                Edit Role
              </button>
              <button 
                onClick={() => handleDelete(m.uid)}
                className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} className="rotate-180" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <MechanicModal 
          mechanic={editingMechanic} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </motion.div>
  );
}

function MechanicModal({ mechanic, onClose }: { mechanic: UserProfile | null, onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: mechanic?.name || '',
    email: mechanic?.email || '',
    role: mechanic?.role || 'Field Technician' as UserRole
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mechanic) {
        // Update
        await updateDoc(doc(db, 'users', mechanic.uid), formData);
        if (profile) {
          await logAudit(profile.uid, profile.name, 'UPDATE', 'User', mechanic.uid, `Updated team member: ${formData.name} (${formData.role})`);
        }
        addToast("Team member updated successfully", "success");
      } else {
        // Create (Pre-initialize profile)
        const uid = `invited_${Math.random().toString(36).slice(2, 11)}`;
        const newProfile: UserProfile = {
          uid,
          ...formData,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid), newProfile);
        if (profile) {
          await logAudit(profile.uid, profile.name, 'CREATE', 'User', uid, `Added new team member: ${formData.name} (${formData.role})`);
        }
        addToast("Team member added successfully", "success");
      }
      onClose();
    } catch (err) {
      addToast("Failed to save team member", "error");
      handleFirestoreError(err, mechanic ? OperationType.UPDATE : OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <h2 className="text-xl font-bold mb-6 tracking-tighter uppercase italic">{mechanic ? 'Edit Team Member' : 'Add Team Member'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Full Name *</label>
            <input 
              required
              type="text"
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
              placeholder="ENTER NAME..."
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Email Address *</label>
            <input 
              required
              type="email"
              disabled={!!mechanic}
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none disabled:bg-gray-50"
              placeholder="ENTER EMAIL..."
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">System Role *</label>
            <select 
              required
              className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
            >
              <option value="Field Technician">FIELD TECHNICIAN</option>
              <option value="Manager">MANAGER</option>
              <option value="Administrator">ADMINISTRATOR</option>
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors uppercase">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 uppercase">
              {loading ? 'Saving...' : 'Save Member'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
