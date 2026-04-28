import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { 
  supabase, signIn, signUp, logout, onAuthStateChanged,
  OperationType, handleSupabaseError, logAudit
} from './supabase';
import { UserProfile, Customer, Machinery, ServiceTicket, ServiceLog, UserRole, MachineryType, MachineryStatus, TicketStatus, ServiceNotification, Part, UsedPart } from './types';
import { 
  LayoutDashboard, Users, Construction, Ticket, History, LogOut, Search, Plus, Trash2, Bell,
  CheckCircle2, AlertCircle, Clock, ChevronRight, Settings, Wrench, Phone, Mail, MapPin, Calendar, User as UserIcon, Filter, FileText, Download, BarChart3,
  Tractor, Zap, Droplets, Cpu, Box, RotateCw, Hammer, Wind, Fuel, Settings2, Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

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
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isTechnician: boolean;
  canEditCustomers: boolean;
  canEditMachinery: boolean;
  canEditTickets: boolean;
  canViewAuditLogs: boolean;
  canViewMechanics: boolean;
  canEditMechanics: boolean;
  canEditInventory: boolean;
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
  canViewMechanics: false,
  canEditMechanics: false,
  canEditInventory: false
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
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        addToast('Verification email sent! Please check your inbox.', 'info');
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (supabaseUser) => {
      setUser(supabaseUser);
      if (supabaseUser) {
        try {
          const { data: userDoc, error } = await supabase
            .from('users')
            .select('*')
            .eq('uid', supabaseUser.id)
            .single();

          if (userDoc) {
            const currentProfile: UserProfile = {
              uid: userDoc.uid,
              name: userDoc.name,
              email: userDoc.email,
              role: userDoc.role,
              createdAt: userDoc.created_at
            };
            // Automatically upgrade specific user to admin if needed
            if (currentProfile.email === 'lodzax@gmail.com' && currentProfile.role !== 'Administrator') {
              const updatedProfile = { ...currentProfile, role: 'Administrator' as UserRole };
              await supabase
                .from('users')
                .update({ role: 'Administrator' })
                .eq('uid', supabaseUser.id);
              
              setTimeout(() => {
                setProfile(updatedProfile);
              }, 500);
              await logAudit(supabaseUser.id, currentProfile.name, 'UPDATE', 'User', supabaseUser.id, 'Auto-assigned Administrator role');
              addToast("Administrator role auto-assigned", "info");
            } else {
              setProfile(currentProfile);
            }
          } else {
            // Create default profile for first-time login
            const isAdmin = supabaseUser.email === 'lodzax@gmail.com';
            const newProfileData = {
              uid: supabaseUser.id,
              name: supabaseUser.user_metadata?.full_name || 'New User',
              email: supabaseUser.email || '',
              role: isAdmin ? 'Administrator' : 'Field Technician',
              created_at: new Date().toISOString()
            };
            await supabase.from('users').insert(newProfileData);
            
            const newProfile: UserProfile = {
              uid: newProfileData.uid,
              name: newProfileData.name,
              email: newProfileData.email,
              role: newProfileData.role as UserRole,
              createdAt: newProfileData.created_at
            };
            
            setTimeout(() => {
              setProfile(newProfile);
            }, 1000);
            addToast("Account initialized successfully", "success");
            await logAudit(supabaseUser.id, newProfile.name, 'CREATE', 'User', supabaseUser.id, 'Initial profile creation' + (isAdmin ? ' (Administrator)' : ''));
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
      canViewMechanics: isAdmin || isManager,
      canEditMechanics: isAdmin,
      canEditInventory: isAdmin || isManager,
    };
  }, [user, profile, loading]);

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#141414] p-12 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
        >
          <div className="text-center mb-8">
            <Wrench className="w-16 h-16 mx-auto mb-6 text-[#141414]" />
            <h1 className="text-4xl font-bold mb-2 tracking-tighter">SERVICE TRACKER</h1>
            <p className="text-gray-500 font-mono italic">Machinery Maintenance & Warranty Management</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Email Address</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 border-2 border-[#141414] focus:bg-gray-50 outline-none font-mono"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-3 border-2 border-[#141414] focus:bg-gray-50 outline-none font-mono"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-[#141414] text-white font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {authLoading ? (
                <RotateCw className="animate-spin" size={20} />
              ) : (
                <UserIcon size={20} />
              )}
              {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-bold uppercase tracking-widest hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-400 uppercase tracking-[0.2em]">Authorized Personnel Only</p>
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

function NotificationBell() {
  const [notifications, setNotifications] = useState<ServiceNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Only show SYSTEM/LOW_STOCK notifications in the bell for now
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('status', 'SYSTEM')
        .order('sent_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Notification fetch error:", error);
      } else {
        setNotifications(data as ServiceNotification[]);
        setUnreadCount(data.length);
      }
    };

    fetchNotifications();

    const subscription = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'status=eq.SYSTEM' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="relative">
      <button 
        onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
        className="p-2 hover:bg-gray-100 transition-colors border border-[#141414] relative"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-bold flex items-center justify-center rounded-full border border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] z-50 overflow-hidden"
            >
              <div className="p-3 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
                <h3 className="text-[10px] font-bold uppercase tracking-widest italic">System Alerts</h3>
                <span className="text-[8px] font-mono text-gray-400 uppercase">Recent Activity</span>
              </div>
              <div className="max-h-96 overflow-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-[10px] font-mono italic">
                    NO ACTIVE ALERTS
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-amber-600">
                          <AlertCircle size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase mb-1">{n.type.replace('_', ' ')}</p>
                          <p className="text-[11px] text-gray-600 leading-tight mb-2">{n.message}</p>
                          <p className="text-[8px] font-mono text-gray-400 uppercase">{new Date(n.sentAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
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
  const { profile, isAdmin, canViewAuditLogs, canEditMechanics, canViewMechanics } = useAuth();

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
          <NavItem active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapPin size={18} />} label="MAP VIEW" />
          <NavItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="CUSTOMERS" />
          <NavItem active={activeTab === 'machinery'} onClick={() => setActiveTab('machinery')} icon={<Construction size={18} />} label="MACHINERY" />
          <NavItem active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={<Ticket size={18} />} label="SERVICE TICKETS" />
          <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box size={18} />} label="INVENTORY" />
          <NavItem active={activeTab === 'history'} onClick={() => { setSelectedMachineId(null); setActiveTab('history'); }} icon={<History size={18} />} label="SERVICE HISTORY" />
          {canViewMechanics && (
            <NavItem active={activeTab === 'mechanics'} onClick={() => setActiveTab('mechanics')} icon={<UserIcon size={18} />} label="TEAM / MECHANICS" />
          )}
          {canViewAuditLogs && (
            <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<FileText size={18} />} label="AUDIT LOGS" />
          )}
          {isAdmin && (
            <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<BarChart3 size={18} />} label="REPORTS" />
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
          <div className="flex items-center gap-6">
            <NotificationBell />
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-gray-400 hidden sm:inline">{new Date().toLocaleDateString()}</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-200">SYSTEM ONLINE</span>
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" />}
            {activeTab === 'map' && <MapView key="map" />}
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
            {activeTab === 'inventory' && <InventoryView key="inventory" />}
            {activeTab === 'history' && (
              <HistoryView 
                key="history" 
                initialMachineId={selectedMachineId} 
                onViewCustomer={(id) => { setSelectedCustomerId(id); setActiveTab('customers'); }}
              />
            )}
            {activeTab === 'mechanics' && canViewMechanics && <MechanicsView key="mechanics" />}
            {activeTab === 'audit' && canViewAuditLogs && <AuditLogsView key="audit" />}
            {activeTab === 'reports' && isAdmin && <ReportsView key="reports" />}
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

    const fetchAuditLogs = async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'audit_logs');
      } else {
        const mappedLogs = (data as any[]).map(l => ({
          ...l,
          userId: l.user_id,
          userName: l.user_name,
          entityType: l.entity_type,
          entityId: l.entity_id
        }));
        setLogs(mappedLogs);
        if (activeTab === 'audit') setLoading(false);
      }
    };

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'notifications');
      } else {
        const mappedNotifs = (data as any[]).map(n => ({
          ...n,
          customerId: n.customer_id,
          customerName: n.customer_name,
          customerEmail: n.customer_email,
          machineryId: n.machinery_id,
          machineryModel: n.machinery_model,
          partId: n.part_id,
          partName: n.part_name,
          sentAt: n.sent_at
        })) as ServiceNotification[];
        setNotifications(mappedNotifs);
        if (activeTab === 'notifications') setLoading(false);
      }
    };

    fetchAuditLogs();
    fetchNotifications();

    const auditSub = supabase
      .channel('audit_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchAuditLogs())
      .subscribe();

    const notifSub = supabase
      .channel('notifications_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .subscribe();

    return () => {
      auditSub.unsubscribe();
      notifSub.unsubscribe();
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
                      <span className="font-bold">{log.entityId?.slice(0, 8)}</span>
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
                        <div className="text-[9px] text-gray-400">ID: {notif.machineryId?.slice(0, 8)}</div>
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

function ReportsView() {
  const { profile, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mechanics, setMechanics] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [reportResults, setReportResults] = useState<{
    ticket: ServiceTicket;
    customer: Customer;
    machinery: Machinery;
    logs: ServiceLog[];
  }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, mechRes] = await Promise.all([
          supabase.from('customers').select('*'),
          supabase.from('users').select('*').in('role', ['Field Technician', 'Manager', 'Administrator'])
        ]);
        
        if (custRes.error) throw custRes.error;
        if (mechRes.error) throw mechRes.error;

        setCustomers(custRes.data as Customer[]);
        setMechanics((mechRes.data as any[]).map(u => ({
          uid: u.uid,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.created_at
        } as UserProfile)));
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'reports-init');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      let query = supabase.from('service_tickets').select('*').order('opened_at', { ascending: false });
      
      if (selectedCustomerId !== 'all') {
        query = query.eq('customer_id', selectedCustomerId);
      }
      
      if (selectedMechanicId !== 'all') {
        query = query.eq('mechanic_id', selectedMechanicId);
      }

      const { data: tickets, error: ticketError } = await query;
      if (ticketError) throw ticketError;
      
      const mappedTickets = (tickets as any[]).map(t => ({
        ...t,
        machineryId: t.machinery_id,
        customerId: t.customer_id,
        mechanicId: t.mechanic_id,
        openedAt: t.opened_at,
        closedAt: t.closed_at,
        satisfactionScore: t.satisfaction_score
      })) as ServiceTicket[];

      // Filter by date range client-side
      const filteredTickets = mappedTickets.filter(t => {
        const openedAt = new Date(t.openedAt);
        if (startDate && openedAt < new Date(startDate)) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (openedAt > end) return false;
        }
        return true;
      });

      // Fetch related data for each ticket
      const results = await Promise.all(filteredTickets.map(async (ticket) => {
        const [custRes, machRes, logsRes] = await Promise.all([
          supabase.from('customers').select('*').eq('id', ticket.customerId).single(),
          supabase.from('machinery').select('*').eq('id', ticket.machineryId).single(),
          supabase.from('service_logs').select('*').eq('ticket_id', ticket.id).order('timestamp', { ascending: true })
        ]);
        
        if (custRes.error) throw custRes.error;
        if (machRes.error) throw machRes.error;
        if (logsRes.error) throw logsRes.error;

        return {
          ticket,
          customer: custRes.data as Customer,
          machinery: machRes.data as Machinery,
          logs: logsRes.data as ServiceLog[]
        };
      }));

      setReportResults(results);
      if (results.length === 0) {
        addToast("No records found for the selected filters", "info");
      }
    } catch (err) {
      handleSupabaseError(err, OperationType.LIST, 'generate-report');
      addToast("Failed to generate report", "error");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    if (reportResults.length === 0) return;
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOM SERVICE HISTORY REPORT', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${timestamp}`, 105, 28, { align: 'center' });
    doc.text(`Filters: Customer: ${selectedCustomerId === 'all' ? 'All' : customers.find(c => c.id === selectedCustomerId)?.name}, ` +
             `Technician: ${selectedMechanicId === 'all' ? 'All' : mechanics.find(m => m.uid === selectedMechanicId)?.name}, ` +
             `Range: ${startDate || 'Start'} to ${endDate || 'End'}`, 105, 34, { align: 'center' });
    
    let currentY = 45;

    reportResults.forEach((res) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(240, 240, 240);
      doc.rect(20, currentY, 170, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(`TICKET: ${res.ticket.description.toUpperCase()} (${res.ticket.status})`, 25, currentY + 5);
      currentY += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Customer: ${res.customer.name}`, 25, currentY);
      doc.text(`Machinery: ${res.machinery.model} (${res.machinery.serialNumber})`, 100, currentY);
      currentY += 6;
      doc.text(`Opened: ${new Date(res.ticket.openedAt).toLocaleDateString()}`, 25, currentY);
      if (res.ticket.closedAt) {
        doc.text(`Closed: ${new Date(res.ticket.closedAt).toLocaleDateString()}`, 100, currentY);
      }
      currentY += 10;

      // Logs for this ticket
      if (res.logs.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [['Date', 'Technician', 'Work Done', 'Parts']],
          body: res.logs.map(log => [
            new Date(log.timestamp).toLocaleDateString(),
            log.mechanicName,
            log.workDone,
            [
              log.partsReplaced,
              ...(log.usedParts || []).map(up => `${up.partName} (x${up.quantity})`)
            ].filter(Boolean).join(', ')
          ]),
          margin: { left: 25 },
          styles: { fontSize: 8 },
          theme: 'grid'
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      } else {
        doc.text('No service logs recorded for this ticket.', 25, currentY);
        currentY += 10;
      }
    });

    doc.save(`Service_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    addToast("Report downloaded successfully", "success");
  };

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <h2 className="text-xl font-bold tracking-tighter uppercase italic mb-6 border-b border-[#141414] pb-2">Report Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Customer</label>
            <select 
              className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none bg-white"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="all">ALL CUSTOMERS</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Technician</label>
            <select 
              className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none bg-white"
              value={selectedMechanicId}
              onChange={(e) => setSelectedMechanicId(e.target.value)}
            >
              <option value="all">ALL TECHNICIANS</option>
              {mechanics.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Start Date</label>
            <input 
              type="date"
              className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">End Date</label>
            <input 
              type="date"
              className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button 
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex-1 py-3 bg-[#141414] text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RotateCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'GENERATING...' : 'GENERATE REPORT'}
          </button>
          
          {reportResults.length > 0 && (
            <button 
              onClick={downloadPDF}
              className="px-8 py-3 border-2 border-[#141414] text-[#141414] text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Download size={16} /> DOWNLOAD PDF
            </button>
          )}
        </div>
      </div>

      {reportResults.length > 0 && (
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-widest uppercase italic">Report Preview ({reportResults.length} Tickets)</h2>
            <BarChart3 size={16} className="text-gray-400" />
          </div>
          <div className="p-6 space-y-8">
            {reportResults.map((res) => (
              <div key={res.ticket.id} className="border border-gray-100 p-4 hover:border-[#141414] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase">{res.ticket.description}</h4>
                    <p className="text-[10px] font-mono text-gray-400 uppercase">{res.customer.name} | {res.machinery.model}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[8px] font-bold uppercase border ${
                    res.ticket.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 
                    res.ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                    {res.ticket.status}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {res.logs.map(log => (
                    <div key={log.id} className="text-[10px] border-l-2 border-gray-100 pl-3 py-1">
                      <div className="flex gap-4">
                        <span className="text-gray-400 font-mono shrink-0">{new Date(log.timestamp).toLocaleDateString()}</span>
                        <span className="font-bold shrink-0 w-24 truncate">{log.mechanicName}</span>
                        <span className="text-gray-600 italic">{log.workDone}</span>
                      </div>
                      {(log.partsReplaced || (log.usedParts && log.usedParts.length > 0)) && (
                        <div className="mt-1 text-[9px] text-gray-400 flex items-center gap-1">
                          <Box size={10} />
                          <span>
                            {[
                              log.partsReplaced,
                              ...(log.usedParts || []).map(up => `${up.partName} (x${up.quantity})`)
                            ].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function RecenterMap({ position, zoom }: { position: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position[0] !== 0 || position[1] !== 0) {
      map.setView(position, zoom || map.getZoom());
    }
  }, [position, zoom]);
  return null;
}

function MapView() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [customerLocations, setCustomerLocations] = useState<(Customer & { position: [number, number], machines: Machinery[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<MachineryStatus | 'All'>('All');

  const fetchIdRef = React.useRef(0);

  const getStatusPriority = (status: MachineryStatus): number => {
    switch (status) {
      case 'Under Repair': return 3;
      case 'Due for Service': return 2;
      case 'Operational': return 1;
      default: return 0;
    }
  };

  const getLocationStatus = (machines: Machinery[]): MachineryStatus => {
    if (machines.length === 0) return 'Operational';
    let highestPriority = 0;
    let dominantStatus: MachineryStatus = 'Operational';

    machines.forEach(m => {
      const p = getStatusPriority(m.status);
      if (p > highestPriority) {
        highestPriority = p;
        dominantStatus = m.status;
      }
    });

    return dominantStatus;
  };

  const getStatusColor = (status: MachineryStatus): string => {
    switch (status) {
      case 'Under Repair': return '#ef4444'; // Red
      case 'Due for Service': return '#eab308'; // Yellow
      case 'Operational': return '#22c55e'; // Green
      default: return '#141414';
    }
  };

  const createColoredIcon = (status: MachineryStatus) => {
    const color = getStatusColor(status);
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  };

  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setRefreshing(true);
    setLoading(true);
    try {
      const [custRes, machRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('machinery').select('*')
      ]);

      if (custRes.error) throw custRes.error;
      if (machRes.error) throw machRes.error;

      if (currentFetchId !== fetchIdRef.current) return;

      const customers = custRes.data as Customer[];
      const machines = (machRes.data as any[]).map(m => ({
        ...m,
        customerId: m.customer_id,
        serialNumber: m.serial_number,
        purchaseDate: m.purchase_date,
        warrantyExpiry: m.warranty_expiry,
        lastServiceDate: m.last_service_date,
        nextServiceDueDate: m.next_service_due_date,
      })) as Machinery[];

      // Map machines to customers
      const customerMachineMap = new Map<string, Machinery[]>();
      machines.forEach(m => {
        const list = customerMachineMap.get(m.customerId) || [];
        list.push(m);
        customerMachineMap.set(m.customerId, list);
      });

      // Filter customers into those with direct coordinates and those needing geocoding
      const directLocations: (Customer & { position: [number, number], machines: Machinery[] })[] = [];
      const needingGeocoding: Customer[] = [];

      customers.forEach(c => {
        if (c.latitude != null && c.longitude != null) {
          directLocations.push({
            ...c,
            position: [c.latitude, c.longitude],
            machines: customerMachineMap.get(c.id) || []
          });
        } else if (c.address && c.address.trim() !== '') {
          needingGeocoding.push(c);
        }
      });

      setCustomerLocations(directLocations);
      if (directLocations.length > 0) setLoading(false);

      setGeocodingProgress({ current: 0, total: needingGeocoding.length });

      // Geocode incrementally
      const geocode = async (address: string): Promise<[number, number] | null> => {
        try {
          // Nominatim requires 1s delay
          await new Promise(r => setTimeout(r, 1100));
          if (currentFetchId !== fetchIdRef.current) return null;
          
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MachineryServiceApp/1.0'
            }
          });
          const data = await res.json();
          if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          }
        } catch (e) {
          console.error("Geocoding failed for", address, e);
        }
        return null;
      };

      // Process addresses one by one to respect rate limits and update UI
      let count = 0;
      for (const customer of needingGeocoding) {
        if (currentFetchId !== fetchIdRef.current) break;

        if (customer.address) {
          const position = await geocode(customer.address);
          if (position && currentFetchId === fetchIdRef.current) {
            setCustomerLocations(prev => {
              // Prevent duplicates if results arrive out of order or multiple loops active
              if (prev.some(p => p.id === customer.id)) return prev;
              return [
                ...prev, 
                { 
                  ...customer, 
                  position, 
                  machines: customerMachineMap.get(customer.id) || [] 
                }
              ];
            });
          }
        }
        count++;
        if (currentFetchId === fetchIdRef.current) {
          setGeocodingProgress({ current: count, total: needingGeocoding.length });
          if (count === 1) setLoading(false);
        }
      }

    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        handleSupabaseError(err, OperationType.LIST, 'map-view');
        addToast("Failed to load map data", "error");
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  // Fix for default Leaflet marker icon
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const filteredLocations = useMemo(() => {
    if (statusFilter === 'All') return customerLocations;
    return customerLocations.filter(loc => getLocationStatus(loc.machines) === statusFilter);
  }, [customerLocations, statusFilter]);

  const center: [number, number] = useMemo(() => {
    if (filteredLocations.length === 0) return [0, 0];
    const sum = filteredLocations.reduce((acc, loc) => [acc[0] + loc.position[0], acc[1] + loc.position[1]], [0, 0]);
    return [sum[0] / filteredLocations.length, sum[1] / filteredLocations.length];
  }, [customerLocations, statusFilter]);

  if (loading && customerLocations.length === 0) return <div className="flex flex-col items-center justify-center p-12 gap-4">
    <LoadingSpinner />
    <p className="text-[10px] font-mono uppercase text-gray-500 animate-pulse">Initializing map & resolving addresses...</p>
  </div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 h-[calc(100vh-12rem)]">
      <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] h-full flex flex-col">
        <div className="p-4 bg-gray-50 border-b border-[#141414] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold tracking-widest uppercase italic font-mono">Customer Locations & Fleet Distribution</h2>
            {geocodingProgress.current < geocodingProgress.total && (
              <div className="flex items-center gap-2">
                <RotateCw size={12} className="animate-spin text-blue-500" />
                <span className="text-[10px] font-mono font-bold text-blue-500">
                  RESOLVING: {geocodingProgress.current}/{geocodingProgress.total}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Filter Status:</span>
               <div className="flex bg-white border border-[#141414] p-0.5">
                 {(['All', 'Operational', 'Due for Service', 'Under Repair'] as const).map(f => (
                   <button 
                     key={f}
                     onClick={() => setStatusFilter(f)}
                     className={`px-2 py-1 text-[9px] font-bold uppercase transition-all ${
                       statusFilter === f 
                        ? 'bg-[#141414] text-white' 
                        : 'text-gray-400 hover:text-[#141414]'
                     }`}
                   >
                     {f}
                   </button>
                 ))}
               </div>
             </div>
             
             <div className="h-4 w-px bg-gray-200 mx-2" />

             <div className="flex items-center gap-6 text-[10px] font-mono font-bold">
               <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>OPERATIONAL</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span>DUE SERVICE</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span>UNDER REPAIR</span>
                 </div>
               </div>
             </div>
             <button onClick={fetchData} className="p-1 hover:bg-gray-200 transition-colors border border-[#141414]">
               <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
             </button>
             <MapPin size={16} className="text-gray-400" />
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <MapContainer center={center[0] !== 0 ? center : [0, 0]} zoom={filteredLocations.length > 0 ? 5 : 2} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {center[0] !== 0 && <RecenterMap position={center} />}
            {filteredLocations.map((loc) => {
              const dominantStatus = getLocationStatus(loc.machines);
              return (
                <Marker 
                  key={loc.id} 
                  position={loc.position}
                  icon={createColoredIcon(dominantStatus)}
                >
                  <Popup>
                    <div className="p-2 min-w-[250px]">
                      <div className="flex items-center justify-between mb-2">
                         <h4 className="font-bold text-sm uppercase tracking-tight m-0">{loc.name}</h4>
                         <span className="text-[10px] font-mono bg-[#141414] text-white px-2 py-0.5">{loc.machines.length} UNITS</span>
                      </div>
                      <p className="text-[10px] uppercase text-gray-500 font-mono leading-tight mb-3 italic">{loc.address}</p>
                      
                      <div className="border-t border-[#141414] pt-2 mt-2 space-y-2 max-h-40 overflow-y-auto">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">MACHINERY AT THIS LOCATION:</p>
                        {loc.machines.length === 0 ? (
                          <p className="text-[10px] italic text-gray-400">No machinery registered</p>
                        ) : (
                          loc.machines.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200">
                              <div className="flex items-center gap-2">
                                {getMachineryIcon(m.type, 12)}
                                <span className="text-[10px] font-bold">{m.model}</span>
                              </div>
                              <span className={`text-[8px] font-bold uppercase ${
                                m.status === 'Operational' ? 'text-green-600' : 
                                m.status === 'Due for Service' ? 'text-yellow-600' : 'text-red-600'
                              }`}>{m.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <div className="flex-1 text-[9px] text-gray-400 font-mono text-right">
                          <Phone size={8} className="inline mr-1" /> {loc.phone}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
      <div className="bg-white p-3 border border-[#141414] flex items-center gap-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <p className="text-[9px] font-mono uppercase text-gray-400">Geographic distribution based on customer registered addresses. Geocoding resolves sequentially to respect Nominatim API terms. Map remains interactive during background resolution.</p>
      </div>
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
  const [stats, setStats] = useState({ 
    due: 0, 
    active: 0, 
    completed: 0, 
    lowStock: 0,
    underRepair: 0,
    recentlyServiced: 0
  });
  const [dueMachinery, setDueMachinery] = useState<Machinery[]>([]);
  const [activeTickets, setActiveTickets] = useState<ServiceTicket[]>([]);
  const [lowStockParts, setLowStockParts] = useState<Part[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    const fetchDashboardData = async () => {
      // Fetch all machinery to calculate multiple stats
      const { data: machData, error: machError } = await supabase
        .from('machinery')
        .select('*');
      
      if (machError) {
        handleSupabaseError(machError, OperationType.LIST, 'machinery');
      } else {
        const mappedMach = (machData as any[]).map(m => ({
          ...m,
          customerId: m.customer_id,
          serialNumber: m.serial_number,
          purchaseDate: m.purchase_date,
          warrantyExpiry: m.warranty_expiry,
          lastServiceDate: m.last_service_date,
          nextServiceDueDate: m.next_service_due_date
        })) as Machinery[];

        const dueCount = mappedMach.filter(m => m.status === 'Due for Service').length;
        const underRepairCount = mappedMach.filter(m => m.status === 'Under Repair').length;
        
        // Recently Serviced: last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentlyServicedCount = mappedMach.filter(m => {
          if (!m.lastServiceDate) return false;
          const lastService = new Date(m.lastServiceDate);
          return lastService >= thirtyDaysAgo;
        }).length;

        setDueMachinery(mappedMach.filter(m => m.status === 'Due for Service'));
        setStats(prev => ({ 
          ...prev, 
          due: dueCount,
          underRepair: underRepairCount,
          recentlyServiced: recentlyServicedCount
        }));
      }

      // Fetch active tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('service_tickets')
        .select('*')
        .in('status', ['Open', 'In Progress']);
      
      if (ticketError) {
        handleSupabaseError(ticketError, OperationType.LIST, 'service_tickets');
      } else {
        const mappedTickets = (ticketData as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[];
        setActiveTickets(mappedTickets);
        setStats(prev => ({ ...prev, active: ticketData.length }));
      }

      // Fetch low stock parts
      const { data: partData, error: partError } = await supabase
        .from('parts')
        .select('*');
      
      if (partError) {
        handleSupabaseError(partError, OperationType.LIST, 'parts');
      } else {
        const mappedParts = (partData as any[]).map(p => ({
          ...p,
          minQuantity: p.min_quantity,
          unitPrice: p.unit_price,
          updatedAt: p.updated_at
        })) as Part[];
        const lowStock = mappedParts.filter(p => p.quantity <= (p.minQuantity || 0));
        setLowStockParts(lowStock);
        setStats(prev => ({ ...prev, lowStock: lowStock.length }));
      }
    };

    fetchDashboardData();

    const dueSub = supabase
      .channel('machinery_due_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machinery', filter: 'status=eq.Due for Service' }, () => fetchDashboardData())
      .subscribe();

    const ticketSub = supabase
      .channel('service_tickets_active_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => fetchDashboardData())
      .subscribe();

    const partSub = supabase
      .channel('parts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      dueSub.unsubscribe();
      ticketSub.unsubscribe();
      partSub.unsubscribe();
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard label="DUE FOR SERVICE" value={stats.due} icon={<AlertCircle className="text-red-600" />} color="bg-red-50" />
        <StatCard label="UNDER REPAIR" value={stats.underRepair} icon={<Wrench className="text-orange-600" />} color="bg-orange-50" />
        <StatCard label="RECENTLY SERVICED" value={stats.recentlyServiced} icon={<CheckCircle2 className="text-green-600" />} color="bg-green-50" />
        <StatCard label="ACTIVE TICKETS" value={stats.active} icon={<Clock className="text-blue-600" />} color="bg-blue-50" />
        <StatCard label="LOW STOCK PARTS" value={stats.lowStock} icon={<Box className="text-amber-600" />} color="bg-amber-50" />
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

        {/* Low Stock Alerts */}
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] lg:col-span-2">
          <div className="p-4 border-b border-[#141414] flex justify-between items-center bg-amber-50">
            <h3 className="font-bold text-xs tracking-widest uppercase italic text-amber-900">Inventory Alerts: Low Stock</h3>
            <Box size={16} className="text-amber-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-[#141414]">
            {lowStockParts.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-xs font-mono col-span-full">ALL INVENTORY LEVELS SUFFICIENT</p>
            ) : (
              lowStockParts.map(p => (
                <div key={p.id} className="p-4 flex justify-between items-center bg-white">
                  <div>
                    <p className="font-bold text-xs uppercase">{p.name}</p>
                    <p className="text-[9px] text-gray-400 font-mono">SKU: {p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{p.quantity}</p>
                    <p className="text-[8px] text-gray-400 uppercase font-bold">MIN: {p.minQuantity}</p>
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

  const fetchCustomers = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (error) {
      handleSupabaseError(error, OperationType.LIST, 'customers');
    } else {
      const mappedCustomers = (data as any[]).map(c => ({
        ...c,
        invoiceDate: c.invoice_date,
        invoiceNumber: c.invoice_number,
        invoiceAmount: c.invoice_amount,
        createdAt: c.created_at
      })) as Customer[];
      setCustomers(mappedCustomers);
    }
  }, [profile]);

  useEffect(() => {
    fetchCustomers();

    const subscription = supabase
      .channel('customers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchCustomers]);

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

      {isAdding && <AddCustomerModal onClose={() => setIsAdding(false)} onSuccess={fetchCustomers} />}
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

function AddCustomerModal({ onClose, onSuccess }: { onClose: () => void, onSuccess?: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', address: '',
    latitude: '', longitude: '',
    invoiceDate: '', invoiceNumber: '', invoiceAmount: ''
  });
  const [machineryList, setMachineryList] = useState([{
    type: 'Tractor' as MachineryType,
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiry: '',
    nextServiceDueDate: '',
    status: 'Operational' as MachineryStatus
  }]);
  const [loading, setLoading] = useState(false);

  const addMachineryRow = () => {
    setMachineryList([...machineryList, {
      type: 'Tractor' as MachineryType,
      model: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyExpiry: '',
      nextServiceDueDate: '',
      status: 'Operational' as MachineryStatus
    }]);
  };

  const removeMachineryRow = (index: number) => {
    if (machineryList.length === 1) return;
    setMachineryList(machineryList.filter((_, i) => i !== index));
  };

  const updateMachineryRow = (index: number, field: string, value: any) => {
    const newList = [...machineryList];
    newList[index] = { ...newList[index], [field]: value };
    setMachineryList(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          invoice_date: formData.invoiceDate || null,
          invoice_number: formData.invoiceNumber || null,
          invoice_amount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (customerError) throw customerError;

      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'Customer', customerData.id, `Created customer: ${formData.name}`);
      }

      // 2. Create Machinery items
      for (const m of machineryList) {
        // Only create if model and serial are provided
        if (m.model && m.serialNumber) {
          const { data: machineryData, error: machineryError } = await supabase
            .from('machinery')
            .insert({
              customer_id: customerData.id,
              type: m.type,
              model: m.model,
              serial_number: m.serialNumber,
              purchase_date: m.purchaseDate || formData.invoiceDate || null,
              warranty_expiry: m.warrantyExpiry || null,
              next_service_due_date: m.nextServiceDueDate || null,
              status: m.status
            })
            .select()
            .single();

          if (machineryError) throw machineryError;

          if (profile) {
            await logAudit(profile.uid, profile.name, 'CREATE', 'Machinery', machineryData.id, `Created machinery: ${m.model} for new customer ${formData.name}`);
          }
        }
      }

      addToast(`Customer ${formData.name} and ${machineryList.filter(m => m.model && m.serialNumber).length} machinery items registered successfully`, "success");
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast("Failed to register customer", "error");
      handleSupabaseError(err, OperationType.CREATE, 'customers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] p-8 max-w-6xl w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6 border-b-2 border-[#141414] pb-2">
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">New Customer & Machinery Registration</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 border border-[#141414]">
            <Plus className="rotate-45" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Customer Section */}
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-widest text-[#141414] uppercase italic flex items-center gap-2">
                  <UserIcon size={14} /> Customer Information
                </h3>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Latitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="-1.286389"
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.latitude}
                      onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Longitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="36.817223"
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.longitude}
                      onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-[10px] font-bold tracking-widest text-[#141414] mb-3 uppercase italic">Purchase Invoice Details</h3>
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
            </div>

            {/* Machinery Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold tracking-widest text-[#141414] uppercase italic flex items-center gap-2">
                  <Construction size={14} /> Machinery Purchased ({machineryList.length})
                </h3>
                <button 
                  type="button"
                  onClick={addMachineryRow}
                  className="px-3 py-1 bg-[#141414] text-white text-[10px] font-bold tracking-widest hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Plus size={12} /> ADD ANOTHER MACHINE
                </button>
              </div>

              <div className="space-y-6">
                {machineryList.map((m, index) => (
                  <div key={index} className="relative p-6 bg-gray-50 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,0.1)]">
                    {machineryList.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeMachineryRow(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white flex items-center justify-center border border-[#141414] hover:bg-red-700 transition-colors"
                        title="Remove Machine"
                      >
                        <Plus size={14} className="rotate-45" />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Machine Type *</label>
                        <select 
                          required={!!m.model || !!m.serialNumber}
                          className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
                          value={m.type}
                          onChange={e => updateMachineryRow(index, 'type', e.target.value as MachineryType)}
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
                          required={!!m.serialNumber || index === 0}
                          type="text" 
                          placeholder="e.g. John Deere 5050D"
                          className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                          value={m.model}
                          onChange={e => updateMachineryRow(index, 'model', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Serial Number *</label>
                        <input 
                          required={!!m.model || index === 0}
                          type="text" 
                          placeholder="Unique ID / VIN"
                          className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                          value={m.serialNumber}
                          onChange={e => updateMachineryRow(index, 'serialNumber', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Purchase Date</label>
                          <input 
                            type="date" 
                            className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                            value={m.purchaseDate}
                            onChange={e => updateMachineryRow(index, 'purchaseDate', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Warranty Expiry *</label>
                          <input 
                            required={!!m.model || !!m.serialNumber || index === 0}
                            type="date" 
                            className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                            value={m.warrantyExpiry}
                            onChange={e => updateMachineryRow(index, 'warrantyExpiry', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Next Service Due</label>
                        <input 
                          type="date" 
                          className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                          value={m.nextServiceDueDate}
                          onChange={e => updateMachineryRow(index, 'nextServiceDueDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Initial Status</label>
                        <select 
                          className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
                          value={m.status}
                          onChange={e => updateMachineryRow(index, 'status', e.target.value as MachineryStatus)}
                        >
                          <option value="Operational">Operational</option>
                          <option value="Due for Service">Due for Service</option>
                          <option value="Under Repair">Under Repair</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t-2 border-[#141414]">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-[#141414] text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {loading ? 'SAVING...' : 'REGISTER CUSTOMER & ALL MACHINERY'}
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
  const [editingMachine, setEditingMachine] = useState<Machinery | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machinery | null>(null);
  const [formData, setFormData] = useState({ 
    name: customer.name, 
    email: customer.email || '', 
    phone: customer.phone, 
    address: customer.address || '',
    latitude: customer.latitude?.toString() || '',
    longitude: customer.longitude?.toString() || '',
    invoiceDate: customer.invoiceDate || '',
    invoiceNumber: customer.invoiceNumber || '',
    invoiceAmount: customer.invoiceAmount?.toString() || ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMachinery = async () => {
      const { data, error } = await supabase
        .from('machinery')
        .select('*')
        .eq('customer_id', customer.id);
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'machinery');
      } else {
        const mappedMachinery = (data as any[]).map(m => ({
          ...m,
          customerId: m.customer_id,
          serialNumber: m.serial_number,
          purchaseDate: m.purchase_date,
          warrantyExpiry: m.warranty_expiry,
          lastServiceDate: m.last_service_date,
          nextServiceDueDate: m.next_service_due_date
        })) as Machinery[];
        setMachinery(mappedMachinery);
      }
    };

    fetchMachinery();

    const subscription = supabase
      .channel(`machinery_customer_${customer.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machinery', filter: `customer_id=eq.${customer.id}` }, () => fetchMachinery())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [customer.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          invoice_date: formData.invoiceDate || null,
          invoice_number: formData.invoiceNumber || null,
          invoice_amount: formData.invoiceAmount ? parseFloat(formData.invoiceAmount) : 0
        })
        .eq('id', customer.id);
      
      if (error) throw error;

      if (profile) {
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Customer', customer.id, `Updated customer details: ${customer.name}`);
      }
      addToast("Customer information updated", "success");
      setIsEditing(false);
    } catch (err) {
      addToast("Failed to update customer", "error");
      handleSupabaseError(err, OperationType.UPDATE, `customers/${customer.id}`);
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Latitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.latitude}
                      onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Longitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                      value={formData.longitude}
                      onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    />
                  </div>
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
                      <div className="space-y-3 flex-1">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Physical Address</p>
                          <p className="text-sm font-mono leading-relaxed">{customer.address || 'NO ADDRESS RECORDED'}</p>
                        </div>
                        {customer.latitude && customer.longitude && (
                          <div className="pt-3 border-t border-gray-100">
                             <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">GPS Coordinates</p>
                             <p className="text-sm font-mono leading-relaxed">{customer.latitude}, {customer.longitude}</p>
                          </div>
                        )}
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
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setEditingMachine(m)}
                        className="p-1.5 border border-[#141414] hover:bg-gray-100"
                        title="Edit"
                      >
                        <Settings size={12} />
                      </button>
                      <button 
                        onClick={() => setDeletingMachine(m)}
                        className="p-1.5 border border-[#141414] hover:bg-red-50 text-red-600"
                        title="Delete"
                      >
                        <Hammer size={12} className="rotate-45" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {editingMachine && <EditMachineryModal machine={editingMachine} onClose={() => setEditingMachine(null)} />}
        {deletingMachine && (
          <DeleteMachineryModal 
            machine={deletingMachine} 
            onClose={() => setDeletingMachine(null)} 
            onConfirm={async () => {
              try {
                const { error } = await supabase
                  .from('machinery')
                  .delete()
                  .eq('id', deletingMachine.id);
                
                if (error) throw error;
                if (profile) {
                  await logAudit(profile.uid, profile.name, 'DELETE', 'Machinery', deletingMachine.id, `Deleted machinery: ${deletingMachine.model} (${deletingMachine.serialNumber})`);
                }
                addToast(`Machinery ${deletingMachine.model} deleted successfully`, "success");
                setDeletingMachine(null);
              } catch (err) {
                addToast("Failed to delete machinery", "error");
                handleSupabaseError(err, OperationType.DELETE, `machinery/${deletingMachine.id}`);
              }
            }} 
          />
        )}
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
  const [editingMachine, setEditingMachine] = useState<Machinery | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machinery | null>(null);
  const [filter, setFilter] = useState<MachineryStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<MachineryType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    const fetchData = async () => {
      // Fetch machinery
      const { data: machData, error: machError } = await supabase
        .from('machinery')
        .select('*');
      
      if (machError) {
        handleSupabaseError(machError, OperationType.LIST, 'machinery');
      } else {
        // Map snake_case to camelCase if necessary, or assume schema matches interface
        // For now, let's assume we use the interface names in DB or map them
        setMachinery(machData.map(m => ({
          ...m,
          customerId: m.customer_id || m.customerId,
          serialNumber: m.serial_number || m.serialNumber,
          purchaseDate: m.purchase_date || m.purchaseDate,
          warrantyExpiry: m.warranty_expiry || m.warrantyExpiry,
          lastServiceDate: m.last_service_date || m.lastServiceDate,
          nextServiceDueDate: m.next_service_due_date || m.nextServiceDueDate
        })) as Machinery[]);
      }

      // Fetch customers for the map
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('id, name');
      
      if (custError) {
        handleSupabaseError(custError, OperationType.LIST, 'customers');
      } else {
        const map: Record<string, string> = {};
        custData.forEach(d => map[d.id] = d.name);
        setCustomers(map);
      }
    };

    fetchData();

    const machSub = supabase
      .channel('machinery_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machinery' }, () => fetchData())
      .subscribe();

    const custSub = supabase
      .channel('customers_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData())
      .subscribe();

    return () => {
      machSub.unsubscribe();
      custSub.unsubscribe();
    };
  }, [profile]);

  const handleDownloadReport = async (m: Machinery) => {
    setLoadingReport(m.id);
    try {
      // 1. Get Customer
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', m.customerId)
        .single();
      
      if (custError) throw custError;

      // 2. Get all Tickets for this machine
      const { data: tickets, error: ticketsError } = await supabase
        .from('service_tickets')
        .select('*')
        .eq('machinery_id', m.id)
        .order('opened_at', { ascending: false });
      
      if (ticketsError) throw ticketsError;

      const mappedTickets = (tickets as any[]).map(t => ({
        ...t,
        machineryId: t.machinery_id,
        customerId: t.customer_id,
        mechanicId: t.mechanic_id,
        openedAt: t.opened_at,
        closedAt: t.closed_at,
        satisfactionScore: t.satisfaction_score
      })) as ServiceTicket[];

      // 3. Get logs for all tickets
      const allLogs: Record<string, ServiceLog[]> = {};
      for (const t of mappedTickets) {
        const { data: logs, error: logsError } = await supabase
          .from('service_logs')
          .select('*')
          .eq('ticket_id', t.id)
          .order('timestamp', { ascending: true });
        
        if (logsError) throw logsError;
        
        allLogs[t.id] = (logs as any[]).map(l => ({
          ...l,
          ticketId: l.ticket_id,
          mechanicId: l.mechanic_id,
          mechanicName: l.mechanic_name,
          partsReplaced: l.parts_replaced,
          usedParts: l.used_parts
        })) as ServiceLog[];
      }

      generateMachineryFullReport(m, customer as Customer, mappedTickets, allLogs);
      
      if (profile) {
        await logAudit(profile.uid, profile.name, 'DOWNLOAD', 'MachineryReport', m.id, `Generated full report for ${m.model} (${m.serialNumber})`);
      }
    } catch (err) {
      handleSupabaseError(err, OperationType.LIST, 'machinery_report');
    } finally {
      setLoadingReport(null);
    }
  };

  const filtered = machinery.filter(m => {
    const matchesStatus = filter === 'ALL' || m.status === filter;
    const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
    
    const today = new Date();
    const expiry = new Date(m.warrantyExpiry);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpiringSoon = diffDays <= 30 && diffDays >= 0;

    const matchesExpiring = !showExpiringOnly || isExpiringSoon;
    
    const customerName = customers[m.customerId] || '';
    const matchesSearch = 
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      customerName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch && matchesExpiring;
  }).sort((a, b) => {
    if (sortOrder === 'none') return 0;
    const dateA = new Date(a.warrantyExpiry).getTime();
    const dateB = new Date(b.warrantyExpiry).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const handleBulkStatusUpdate = async (status: MachineryStatus) => {
    if (selectedIds.size === 0 || !profile) return;
    setIsBulkUpdating(true);
    try {
      const selectedMachinery = machinery.filter(m => selectedIds.has(m.id));
      
      for (const m of selectedMachinery) {
        const { error } = await supabase
          .from('machinery')
          .update({ status })
          .eq('id', m.id);
        
        if (error) throw error;
        
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', m.id, `Bulk status update to ${status}`);
      }
      
      const count = selectedIds.size;
      setSelectedIds(new Set());
      addToast(`Successfully updated ${count} machines to ${status}`, "success");
    } catch (err) {
      addToast("Bulk update failed", "error");
      handleSupabaseError(err, OperationType.UPDATE, 'machinery_bulk');
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

  const handleDeleteMachinery = async (m: Machinery) => {
    try {
      const { error } = await supabase
        .from('machinery')
        .delete()
        .eq('id', m.id);
      
      if (error) throw error;

      if (profile) {
        await logAudit(profile.uid, profile.name, 'DELETE', 'Machinery', m.id, `Deleted machinery: ${m.model} (${m.serialNumber})`);
      }
      addToast(`Machinery ${m.model} deleted successfully`, "success");
      setDeletingMachine(null);
    } catch (err) {
      addToast("Failed to delete machinery", "error");
      handleSupabaseError(err, OperationType.DELETE, `machinery/${m.id}`);
    }
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
                <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="ALL" status="ALL" />
                <FilterButton active={filter === 'Operational'} onClick={() => setFilter('Operational')} label="OPERATIONAL" status="Operational" />
                <FilterButton active={filter === 'Due for Service'} onClick={() => setFilter('Due for Service')} label="DUE" status="Due for Service" />
                <FilterButton active={filter === 'Under Repair'} onClick={() => setFilter('Under Repair')} label="REPAIR" status="Under Repair" />
              </div>
              <FilterButton 
                active={showExpiringOnly} 
                onClick={() => setShowExpiringOnly(!showExpiringOnly)} 
                label="EXPIRING" 
                status="EXPIRING" 
              />
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
            <select 
              className="px-3 py-1.5 text-[10px] font-bold tracking-widest border border-[#141414] bg-white focus:outline-none uppercase"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="none">SORT BY WARRANTY</option>
              <option value="asc">WARRANTY (ASC)</option>
              <option value="desc">WARRANTY (DESC)</option>
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
        {filtered.map(m => {
          const today = new Date();
          const expiry = new Date(m.warrantyExpiry);
          const diffTime = expiry.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isExpiringSoon = diffDays <= 30 && diffDays >= 0;

          return (
            <div 
              key={m.id} 
              className={`bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-6 group hover:-translate-y-1 transition-all relative ${
                selectedIds.has(m.id) ? 'ring-2 ring-[#141414] bg-gray-50' : ''
              } ${isExpiringSoon ? 'border-l-4 border-l-red-600' : ''}`}
            >
              {isExpiringSoon && (
                <div className="absolute -top-2 -left-2 z-20 bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest">
                  Warranty Expiring
                </div>
              )}
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
                <span className={`text-[9px] font-bold px-2 py-1 border uppercase flex items-center gap-1.5 shadow-sm ${
                  m.status === 'Operational' ? 'bg-green-50 text-green-700 border-green-200' : 
                  m.status === 'Due for Service' ? 'bg-red-50 text-red-700 border-red-200' : 
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {m.status === 'Operational' && <CheckCircle2 size={12} className="shrink-0" />}
                  {m.status === 'Due for Service' && <AlertCircle size={12} className="shrink-0" />}
                  {m.status === 'Under Repair' && <Wrench size={12} className="shrink-0" />}
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
              {canEditMachinery && (
                <button 
                  onClick={() => setEditingMachine(m)}
                  className="px-3 py-2 border border-[#141414] text-[10px] font-bold tracking-widest hover:bg-gray-50 transition-all"
                  title="Edit Machinery"
                >
                  <Settings2 size={14} />
                </button>
              )}
              {canEditMachinery && (
                <button 
                  onClick={() => setDeletingMachine(m)}
                  className="px-3 py-2 border border-[#141414] text-[10px] font-bold tracking-widest hover:bg-red-50 text-red-600 transition-all"
                  title="Delete Machinery"
                >
                  <Hammer size={14} className="rotate-45" />
                </button>
              )}
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
        );
      })}
    </div>

      {isAdding && <AddMachineryModal onClose={() => setIsAdding(false)} />}
      {editingMachine && <EditMachineryModal machine={editingMachine} onClose={() => setEditingMachine(null)} />}
      {deletingMachine && (
        <DeleteMachineryModal 
          machine={deletingMachine} 
          onClose={() => setDeletingMachine(null)} 
          onConfirm={() => handleDeleteMachinery(deletingMachine)} 
        />
      )}
    </motion.div>
  );
}

function FilterButton({ active, onClick, label, status }: { active: boolean, onClick: () => void, label: string, status?: MachineryStatus | 'ALL' | 'EXPIRING' }) {
  const getColors = () => {
    if (!active) return 'bg-white text-gray-500 hover:bg-gray-50 border-[#141414]';
    if (status === 'Operational') return 'bg-green-600 text-white border-green-700';
    if (status === 'Due for Service') return 'bg-red-600 text-white border-red-700';
    if (status === 'Under Repair') return 'bg-amber-600 text-white border-amber-700';
    if (status === 'EXPIRING') return 'bg-red-600 text-white border-red-700 animate-pulse';
    return 'bg-[#141414] text-white border-[#141414]';
  };

  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] font-bold tracking-widest border transition-all ${getColors()}`}
    >
      {label}
    </button>
  );
}

function EditMachineryModal({ machine, onClose }: { machine: Machinery, onClose: () => void }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ ...machine });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'customers');
      } else {
        const mappedCustomers = (data as any[]).map(c => ({
          ...c,
          invoiceDate: c.invoice_date,
          invoiceNumber: c.invoice_number,
          invoiceAmount: c.invoice_amount,
          createdAt: c.created_at
        })) as Customer[];
        setCustomers(mappedCustomers);
      }
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('machinery')
        .update({
          customer_id: formData.customerId,
          type: formData.type,
          model: formData.model,
          serial_number: formData.serialNumber,
          purchase_date: formData.purchaseDate || null,
          warranty_expiry: formData.warrantyExpiry || null,
          last_service_date: formData.lastServiceDate || null,
          next_service_due_date: formData.nextServiceDueDate || null,
          status: formData.status
        })
        .eq('id', machine.id);
      
      if (error) throw error;
      
      if (profile) {
        const changes = [];
        if (machine.model !== formData.model) changes.push(`model: ${machine.model} -> ${formData.model}`);
        if (machine.serialNumber !== formData.serialNumber) changes.push(`serial: ${machine.serialNumber} -> ${formData.serialNumber}`);
        if (machine.status !== formData.status) changes.push(`status: ${machine.status} -> ${formData.status}`);
        if (machine.type !== formData.type) changes.push(`type: ${machine.type} -> ${formData.type}`);
        if (machine.customerId !== formData.customerId) {
          const oldCust = customers.find(c => c.id === machine.customerId)?.name || machine.customerId;
          const newCust = customers.find(c => c.id === formData.customerId)?.name || formData.customerId;
          changes.push(`owner: ${oldCust} -> ${newCust}`);
        }
        if (machine.purchaseDate !== formData.purchaseDate) changes.push(`purchaseDate: ${machine.purchaseDate} -> ${formData.purchaseDate}`);
        if (machine.warrantyExpiry !== formData.warrantyExpiry) changes.push(`warrantyExpiry: ${machine.warrantyExpiry} -> ${formData.warrantyExpiry}`);
        
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', machine.id, `Updated machinery details. ${changes.join(', ')}`);
      }
      
      addToast(`Machinery ${formData.model} updated successfully`, "success");
      onClose();
    } catch (err) {
      addToast("Failed to update machinery", "error");
      handleSupabaseError(err, OperationType.UPDATE, `machinery/${machine.id}`);
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
        <h2 className="text-xl font-bold mb-6 tracking-tighter uppercase italic">Edit Machinery</h2>
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
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Status *</label>
              <select 
                required
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none bg-white"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as MachineryStatus })}
              >
                <option value="Operational">Operational</option>
                <option value="Due for Service">Due for Service</option>
                <option value="Under Repair">Under Repair</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-gray-500 mb-1 uppercase">Purchase Date</label>
              <input 
                type="date" 
                className="w-full p-2 border border-[#141414] text-sm font-mono focus:outline-none"
                value={formData.purchaseDate}
                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
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
              {loading ? 'SAVING...' : 'UPDATE MACHINERY'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DeleteMachineryModal({ machine, onClose, onConfirm }: { machine: Machinery, onClose: () => void, onConfirm: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border-2 border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle size={24} />
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">Confirm Deletion</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Are you sure you want to delete <span className="font-bold text-[#141414]">{machine.model}</span> (Serial: <span className="font-mono">{machine.serialNumber}</span>)?
          <br /><br />
          This action is <span className="font-bold text-red-600 uppercase">permanent</span> and will also remove all associated service history and logs.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-3 border border-[#141414] text-xs font-bold hover:bg-gray-50 transition-colors"
          >
            CANCEL
          </button>
          <button 
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 shadow-[4px_4px_0px_0px_rgba(153,27,27,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {loading ? 'DELETING...' : 'DELETE PERMANENTLY'}
          </button>
        </div>
      </motion.div>
    </div>
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
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'customers');
      } else {
        const mappedCustomers = (data as any[]).map(c => ({
          ...c,
          invoiceDate: c.invoice_date,
          invoiceNumber: c.invoice_number,
          invoiceAmount: c.invoice_amount,
          createdAt: c.created_at
        })) as Customer[];
        setCustomers(mappedCustomers);
      }
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('machinery')
        .insert({
          customer_id: formData.customerId,
          type: formData.type,
          model: formData.model,
          serial_number: formData.serialNumber,
          purchase_date: formData.purchaseDate || null,
          warranty_expiry: formData.warrantyExpiry || null,
          next_service_due_date: formData.nextServiceDueDate || null,
          status: formData.status
        })
        .select()
        .single();

      if (error) throw error;

      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'Machinery', data.id, `Created machinery: ${formData.model} (${formData.serialNumber})`);
      }
      addToast(`Machinery ${formData.model} registered successfully`, "success");
      onClose();
    } catch (err) {
      addToast("Failed to register machinery", "error");
      handleSupabaseError(err, OperationType.CREATE, 'machinery');
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

    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from('service_tickets')
        .select('*')
        .order('opened_at', { ascending: false });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'service_tickets');
      } else {
        const mappedTickets = (data as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[];
        setTickets(mappedTickets);
      }
    };

    const fetchMachinery = async () => {
      const { data, error } = await supabase.from('machinery').select('*');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'machinery');
      } else {
        const map: Record<string, Machinery> = {};
        data.forEach(d => {
          map[d.id] = {
            ...d,
            customerId: d.customer_id,
            serialNumber: d.serial_number,
            purchaseDate: d.purchase_date,
            warrantyExpiry: d.warranty_expiry,
            lastServiceDate: d.last_service_date,
            nextServiceDueDate: d.next_service_due_date
          } as Machinery;
        });
        setMachinery(map);
      }
    };

    const fetchCustomers = async () => {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'customers');
      } else {
        const map: Record<string, Customer> = {};
        data.forEach(d => {
          map[d.id] = {
            ...d,
            invoiceDate: d.invoice_date,
            invoiceNumber: d.invoice_number,
            invoiceAmount: d.invoice_amount,
            createdAt: d.created_at
          } as Customer;
        });
        setCustomers(map);
      }
    };

    const fetchMechanics = async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'users');
      } else {
        const map: Record<string, UserProfile> = {};
        data.forEach(d => {
          map[d.uid] = { 
            uid: d.uid, 
            name: d.name,
            email: d.email,
            role: d.role,
            createdAt: d.created_at 
          } as UserProfile;
        });
        setMechanics(map);
      }
    };

    fetchTickets();
    fetchMachinery();
    fetchCustomers();
    fetchMechanics();

    const ticketSub = supabase
      .channel('service_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => fetchTickets())
      .subscribe();

    const machSub = supabase
      .channel('machinery_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machinery' }, () => fetchMachinery())
      .subscribe();

    const custSub = supabase
      .channel('customers_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchCustomers())
      .subscribe();

    const mechSub = supabase
      .channel('users_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMechanics())
      .subscribe();

    return () => {
      ticketSub.unsubscribe();
      machSub.unsubscribe();
      custSub.unsubscribe();
      mechSub.unsubscribe();
    };
  }, [profile]);

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
                    <span className="text-[10px] font-mono text-gray-400">ID: {t.id?.slice(0, 8)}</span>
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
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<UsedPart[]>([]);
  const [manualPart, setManualPart] = useState({ name: '', sku: '' });
  const [initialWorkDone, setInitialWorkDone] = useState('');
  const [initialPartsReplaced, setInitialPartsReplaced] = useState('');
  const [showLogSection, setShowLogSection] = useState(false);
  const [activeTickets, setActiveTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  useEffect(() => {
    if (profile?.uid && profile.role === 'Field Technician' && !formData.mechanicId) {
      setFormData(prev => ({ ...prev, mechanicId: profile.uid }));
    }
  }, [profile?.uid, profile?.role]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [machRes, custRes, userRes, ticketRes, partsRes] = await Promise.all([
          supabase.from('machinery').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('users').select('*').in('role', ['Field Technician', 'Administrator', 'Manager']),
          supabase.from('service_tickets').select('*').in('status', ['Open', 'In Progress']),
          supabase.from('parts').select('*').order('name', { ascending: true })
        ]);

        if (machRes.error) throw machRes.error;
        if (custRes.error) throw custRes.error;
        if (userRes.error) throw userRes.error;
        if (ticketRes.error) throw ticketRes.error;
        if (partsRes.error) throw partsRes.error;

        setMachinery((machRes.data as any[]).map(m => ({
          ...m,
          customerId: m.customer_id,
          serialNumber: m.serial_number,
          purchaseDate: m.purchase_date,
          warrantyExpiry: m.warranty_expiry,
          lastServiceDate: m.last_service_date,
          nextServiceDueDate: m.next_service_due_date
        })) as Machinery[]);

        setCustomers((custRes.data as any[]).map(c => ({
          ...c,
          invoiceDate: c.invoice_date,
          invoiceNumber: c.invoice_number,
          invoiceAmount: c.invoice_amount,
          createdAt: c.created_at
        })) as Customer[]);

        setMechanics((userRes.data as any[]).map(u => ({ 
          uid: u.uid, 
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.created_at 
        } as UserProfile)));

        setActiveTickets((ticketRes.data as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[]);

        setAvailableParts((partsRes.data as any[]).map(p => ({
          ...p,
          minQuantity: p.min_quantity,
          unitPrice: p.unit_price,
          updatedAt: p.updated_at
        })) as Part[]);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'add-ticket-modal-init');
      }
    };

    fetchInitialData();
  }, []);

  // Calculate workload for each mechanic
  const mechanicWorkload = useMemo(() => {
    const workload: Record<string, number> = {};
    activeTickets.forEach(t => {
      if (t.mechanicId) {
        workload[t.mechanicId] = (workload[t.mechanicId] || 0) + 1;
      }
    });
    return workload;
  }, [activeTickets]);

  // Sort and filter mechanics
  const sortedMechanics = useMemo(() => {
    return mechanics
      .filter(m => m.role === 'Field Technician' || m.role === 'Administrator' || m.role === 'Manager')
      .sort((a, b) => (mechanicWorkload[a.uid] || 0) - (mechanicWorkload[b.uid] || 0));
  }, [mechanics, mechanicWorkload]);

  // Auto-select mechanic with lowest workload if none selected
  useEffect(() => {
    if (!formData.mechanicId && sortedMechanics.length > 0) {
      setFormData(prev => ({ ...prev, mechanicId: sortedMechanics[0].uid }));
    }
  }, [sortedMechanics]);

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
      const { data: ticketData, error: ticketError } = await supabase.from('service_tickets').insert({
        machinery_id: formData.machineryId,
        description: formData.description,
        customer_id: selectedCustomerId,
        mechanic_id: formData.mechanicId,
        status: initialWorkDone ? 'In Progress' : 'Open',
        opened_at: new Date().toISOString()
      }).select().single();

      if (ticketError) throw ticketError;

      // Update machinery status to Under Repair
      const { error: machError } = await supabase.from('machinery').update({ status: 'Under Repair' }).eq('id', machine.id);
      if (machError) throw machError;
      
      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'ServiceTicket', ticketData.id, `Created ticket: ${formData.description}`);
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', machine.id, 'Status changed to Under Repair');
      }

      // Add initial log if provided
      if (initialWorkDone) {
        const selectedMechanic = mechanics.find(m => m.uid === formData.mechanicId);
        const logData = {
          ticket_id: ticketData.id,
          mechanic_id: formData.mechanicId,
          mechanic_name: selectedMechanic?.name || profile?.name || 'Unknown Mechanic',
          work_done: initialWorkDone,
          parts_replaced: initialPartsReplaced,
          timestamp: new Date().toISOString(),
          used_parts: selectedParts
        };

        const { data: logRes, error: logError } = await supabase.from('service_logs').insert(logData).select().single();
        if (logError) throw logError;

        if (profile) {
          await logAudit(profile.uid, profile.name, 'CREATE', 'ServiceLog', logRes.id, `Added initial log: ${initialWorkDone}`);
        }

        // Deduct from inventory
        for (const sp of selectedParts) {
          if (sp.partId) {
            const part = availableParts.find(p => p.id === sp.partId);
            if (part) {
              const newQty = part.quantity - sp.quantity;
              const { error: partError } = await supabase
                .from('parts')
                .update({ 
                  quantity: newQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', sp.partId);
              
              if (partError) throw partError;

              if (profile) {
                await logAudit(profile.uid, profile.name, 'UPDATE', 'Part', sp.partId, `Deducted ${sp.quantity} units for ticket ${ticketData.id}`);
              }

              // Trigger low stock notification
              if (newQty <= (part.minQuantity || 5)) {
                await supabase.from('notifications').insert({
                  type: 'LOW_STOCK',
                  status: 'SYSTEM',
                  sent_at: new Date().toISOString(),
                  part_id: sp.partId,
                  part_name: part.name,
                  message: `LOW STOCK ALERT: ${part.name} (SKU: ${part.sku}) is down to ${newQty} units. Minimum required: ${part.minQuantity || 5}.`
                });
              }
            }
          }
        }
      }

      addToast("Service ticket opened successfully" + (initialWorkDone ? " with initial log" : ""), "success");
      onClose();
    } catch (err) {
      addToast("Failed to open ticket", "error");
      handleSupabaseError(err, OperationType.CREATE, 'service_tickets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] flex flex-col"
      >
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">Open Service Ticket</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 transition-colors border border-[#141414]">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col lg:grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold tracking-widest uppercase mb-4 italic text-gray-400">Basic Information</h3>
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
                {sortedMechanics.map((m, index) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name} ({m.role}) - {mechanicWorkload[m.uid] || 0} Active Tickets {index === 0 ? '★ SUGGESTED' : ''}
                  </option>
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
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold tracking-widest uppercase italic text-gray-400">Initial Service Log</h3>
              <button 
                type="button"
                onClick={() => setShowLogSection(!showLogSection)}
                className={`text-[9px] font-bold uppercase px-2 py-1 border border-[#141414] transition-colors ${showLogSection ? 'bg-[#141414] text-white' : 'bg-white text-[#141414]'}`}
              >
                {showLogSection ? 'REMOVE LOG' : 'ADD INITIAL LOG'}
              </button>
            </div>

            {showLogSection ? (
              <div className="space-y-4 bg-gray-50 p-4 border border-dashed border-gray-300">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Work Performed</label>
                  <textarea 
                    className="w-full p-2 border border-[#141414] text-[10px] font-mono focus:outline-none h-20"
                    placeholder="ENTER WORK ALREADY PERFORMED..."
                    value={initialWorkDone}
                    onChange={e => setInitialWorkDone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Other Parts (Non-Inventory)</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-[#141414] text-[10px] font-mono focus:outline-none"
                    placeholder="E.G. SEALS, BOLTS..."
                    value={initialPartsReplaced}
                    onChange={e => setInitialPartsReplaced(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Inventory Parts Usage</label>
                  <div className="space-y-2">
                    <select 
                      className="w-full p-2 border border-[#141414] text-[10px] font-mono focus:outline-none bg-white"
                      onChange={(e) => {
                        const partId = e.target.value;
                        if (!partId) return;
                        if (selectedParts.find(sp => sp.partId === partId)) return;
                        const part = availableParts.find(p => p.id === partId);
                        if (part) {
                          setSelectedParts([...selectedParts, { 
                            partId: part.id, 
                            partName: part.name, 
                            sku: part.sku, 
                            quantity: 1 
                          }]);
                        }
                        e.target.value = '';
                      }}
                    >
                      <option value="">SELECT FROM INVENTORY...</option>
                      {availableParts.filter(p => p.quantity > 0).map(p => (
                        <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) - Qty: {p.quantity}</option>
                      ))}
                    </select>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="MANUAL PART"
                        className="flex-1 p-2 border border-[#141414] text-[10px] font-mono focus:outline-none bg-white"
                        value={manualPart.name}
                        onChange={e => setManualPart({ ...manualPart, name: e.target.value })}
                      />
                      <input 
                        type="text" 
                        placeholder="SKU"
                        className="w-20 p-2 border border-[#141414] text-[10px] font-mono focus:outline-none bg-white"
                        value={manualPart.sku}
                        onChange={e => setManualPart({ ...manualPart, sku: e.target.value })}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (!manualPart.name || !manualPart.sku) return;
                          setSelectedParts([...selectedParts, { 
                            partName: manualPart.name, 
                            sku: manualPart.sku, 
                            quantity: 1 
                          }]);
                          setManualPart({ name: '', sku: '' });
                        }}
                        className="px-3 py-2 bg-[#141414] text-white text-[10px] font-bold uppercase transition-transform active:scale-95"
                      >
                        ADD
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedParts.map((sp, idx) => {
                        const part = sp.partId ? availableParts.find(p => p.id === sp.partId) : null;
                        return (
                          <div key={idx} className="flex items-center gap-1 bg-white border border-[#141414] px-1.5 py-1">
                            <span className="text-[8px] font-bold uppercase tracking-tighter truncate max-w-[80px]">
                              {sp.partName} <span className="text-gray-400">({sp.sku})</span>
                            </span>
                            <div className="flex items-center gap-1 ml-1 bg-gray-50 border border-gray-100">
                              <button 
                                type="button"
                                onClick={() => {
                                  const next = [...selectedParts];
                                  next[idx].quantity = Math.max(1, next[idx].quantity - 1);
                                  setSelectedParts(next);
                                }}
                                className="px-1 hover:bg-gray-200"
                              >-</button>
                              <span className="text-[8px] font-mono w-4 text-center">{sp.quantity}</span>
                              <button 
                                type="button"
                                onClick={() => {
                                  const next = [...selectedParts];
                                  const max = part?.quantity || 999;
                                  next[idx].quantity = Math.min(max, next[idx].quantity + 1);
                                  setSelectedParts(next);
                                }}
                                className="px-1 hover:bg-gray-200"
                              >+</button>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setSelectedParts(selectedParts.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 ml-1"
                            >
                              <Plus className="rotate-45" size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-gray-200 p-12 text-center">
                <p className="text-[10px] font-mono text-gray-400 uppercase leading-relaxed">
                  Toggle initial log to record work performed<br/>immediately upon ticket creation.
                </p>
              </div>
            )}
            
            <div className="pt-6">
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4 bg-[#141414] text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-[6px_6px_0px_0px_rgba(20,20,20,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                {loading ? 'PROCESSING...' : (showLogSection ? 'OPEN TICKET & RECORD WORK' : 'OPEN SERVICE TICKET')}
              </button>
              <button type="button" onClick={onClose} className="w-full mt-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors">
                ABANDON REQUEST
              </button>
            </div>
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
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<UsedPart[]>([]);
  const [manualPart, setManualPart] = useState({ name: '', sku: '' });
  const [newLog, setNewLog] = useState({ workDone: '', partsReplaced: '' });
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>(profile?.uid || '');
  const [allMechanics, setAllMechanics] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmParts, setShowConfirmParts] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState<number>(5);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('service_logs')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('timestamp', { ascending: false });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'service_logs');
      } else {
        const mappedLogs = (data as any[]).map(l => ({
          ...l,
          ticketId: l.ticket_id,
          mechanicId: l.mechanic_id,
          mechanicName: l.mechanic_name,
          partsReplaced: l.parts_replaced,
          usedParts: l.used_parts
        })) as ServiceLog[];
        setLogs(mappedLogs);
      }
    };

    const fetchParts = async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'parts');
      } else {
        const mappedParts = (data as any[]).map(p => ({
          ...p,
          minQuantity: p.min_quantity,
          unitPrice: p.unit_price,
          updatedAt: p.updated_at
        })) as Part[];
        setAvailableParts(mappedParts);
      }
    };

    const fetchRelatedData = async () => {
      try {
        const [machRes, custRes] = await Promise.all([
          supabase.from('machinery').select('*').eq('id', ticket.machineryId).single(),
          supabase.from('customers').select('*').eq('id', ticket.customerId).single()
        ]);

        if (machRes.error) throw machRes.error;
        if (custRes.error) throw custRes.error;

        const mMach = machRes.data;
        const mappedMach = {
          ...mMach,
          customerId: mMach.customer_id,
          serialNumber: mMach.serial_number,
          purchaseDate: mMach.purchase_date,
          warrantyExpiry: mMach.warranty_expiry,
          lastServiceDate: mMach.last_service_date,
          nextServiceDueDate: mMach.next_service_due_date
        } as Machinery;

        const mCust = custRes.data;
        const mappedCust = {
          ...mCust,
          invoiceDate: mCust.invoice_date,
          invoiceNumber: mCust.invoice_number,
          invoiceAmount: mCust.invoice_amount,
          createdAt: mCust.created_at
        } as Customer;

        setMachinery(mappedMach);
        setCustomer(mappedCust);

        if (ticket.mechanicId) {
          const { data: mechData, error: mechError } = await supabase
            .from('users')
            .select('*')
            .eq('uid', ticket.mechanicId)
            .single();
          
          if (mechError) throw mechError;
          setMechanic({ 
            uid: mechData.uid, 
            name: mechData.name,
            email: mechData.email,
            role: mechData.role,
            createdAt: mechData.created_at 
          } as UserProfile);
        }
      } catch (err) {
        handleSupabaseError(err, OperationType.GET, 'ticket-related-data');
      }
    };

    const fetchAllMechanics = async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'users');
      } else {
        setAllMechanics(data.map(d => ({ 
          uid: d.uid, 
          name: d.name,
          email: d.email,
          role: d.role,
          createdAt: d.created_at 
        } as UserProfile)));
      }
    };

    fetchLogs();
    fetchParts();
    fetchRelatedData();
    fetchAllMechanics();

    const logsSub = supabase
      .channel(`ticket_logs_${ticket.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_logs', filter: `ticket_id=eq.${ticket.id}` }, () => fetchLogs())
      .subscribe();

    const partsSub = supabase
      .channel('parts_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => fetchParts())
      .subscribe();

    const mechanicsSub = supabase
      .channel('users_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchAllMechanics())
      .subscribe();

    return () => {
      logsSub.unsubscribe();
      partsSub.unsubscribe();
      mechanicsSub.unsubscribe();
    };
  }, [ticket.id, ticket.machineryId, ticket.customerId, ticket.mechanicId, profile]);

  useEffect(() => {
    if (profile && !selectedMechanicId) {
      setSelectedMechanicId(profile.uid);
    }
  }, [profile]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.workDone) return;

    if (selectedParts.length > 0 && !showConfirmParts) {
      setShowConfirmParts(true);
      return;
    }

    setLoading(true);
    try {
      const selectedMechanic = allMechanics.find(m => m.uid === selectedMechanicId);
      
      const logData = {
        ticket_id: ticket.id,
        mechanic_id: selectedMechanicId,
        mechanic_name: selectedMechanic?.name || profile?.name || 'Unknown Mechanic',
        work_done: newLog.workDone,
        parts_replaced: newLog.partsReplaced,
        timestamp: new Date().toISOString(),
        used_parts: selectedParts
      };

      const { data: logRes, error: logError } = await supabase.from('service_logs').insert(logData).select().single();
      if (logError) throw logError;

      // Deduct from inventory
      for (const sp of selectedParts) {
        if (sp.partId) {
          const part = availableParts.find(p => p.id === sp.partId);
          if (part) {
            const newQty = part.quantity - sp.quantity;
            const { error: partError } = await supabase
              .from('parts')
              .update({ 
                quantity: newQty,
                updated_at: new Date().toISOString()
              })
              .eq('id', sp.partId);
            
            if (partError) throw partError;

            // Trigger low stock notification if needed
            if (newQty <= (part.minQuantity || 5)) {
              await supabase.from('notifications').insert({
                type: 'LOW_STOCK',
                status: 'SYSTEM',
                sent_at: new Date().toISOString(),
                part_id: sp.partId,
                part_name: part.name,
                message: `LOW STOCK ALERT: ${part.name} (SKU: ${part.sku}) is down to ${newQty} units. Minimum required: ${part.minQuantity || 5}.`
              });
            }
          }
        }
      }

      // If ticket was "Open", move to "In Progress"
      if (ticket.status === 'Open') {
        const { error: ticketUpdateError } = await supabase
          .from('service_tickets')
          .update({ status: 'In Progress' })
          .eq('id', ticket.id);
        
        if (ticketUpdateError) throw ticketUpdateError;
      }

      // Check for low stock to show immediate toast
      for (const sp of selectedParts) {
        const part = availableParts.find(p => p.id === sp.partId);
        if (part && (part.quantity - sp.quantity) <= (part.minQuantity || 5)) {
          addToast(`LOW STOCK: ${part.name} is now at ${part.quantity - sp.quantity} units!`, "error");
        }
      }

      if (profile) {
        await logAudit(profile.uid, profile.name, 'CREATE', 'ServiceLog', logRes.id, `Added log to ticket ${ticket.id}: ${newLog.workDone}`);
        for (const sp of selectedParts) {
          await logAudit(profile.uid, profile.name, 'UPDATE', 'Part', sp.partId, `Deducted ${sp.quantity} units for ticket ${ticket.id}`);
        }
      }

      addToast("Service log added successfully", "success");
      setNewLog({ workDone: '', partsReplaced: '' });
      setSelectedParts([]);
      setShowConfirmParts(false);
    } catch (err) {
      addToast("Failed to add service log", "error");
      handleSupabaseError(err, OperationType.WRITE, 'service_logs');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTicket = async () => {
    if (!showSatisfactionModal) {
      setShowSatisfactionModal(true);
      return;
    }

    setLoading(true);
    try {
      const { error: ticketError } = await supabase
        .from('service_tickets')
        .update({ 
          status: 'Completed',
          closed_at: new Date().toISOString(),
          satisfaction_score: satisfactionScore
        })
        .eq('id', ticket.id);
      
      if (ticketError) throw ticketError;

      // Update machinery status back to Operational
      const { error: machError } = await supabase
        .from('machinery')
        .update({ 
          status: 'Operational',
          last_service_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', ticket.machineryId);
      
      if (machError) throw machError;

      if (profile) {
        await logAudit(profile.uid, profile.name, 'UPDATE', 'ServiceTicket', ticket.id, `Status changed to Completed with satisfaction score ${satisfactionScore}`);
        await logAudit(profile.uid, profile.name, 'UPDATE', 'Machinery', ticket.machineryId, 'Status changed to Operational');
      }
      addToast("Service ticket completed successfully", "success");
      onClose();
    } catch (err) {
      addToast("Failed to complete ticket", "error");
      handleSupabaseError(err, OperationType.UPDATE, 'service_tickets');
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
                <span className="text-[10px] font-mono text-gray-400 uppercase">TICKET #{ticket.id?.slice(0, 8)}</span>
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
                  {(profile?.role === 'Administrator' || profile?.role === 'Manager') && (
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Mechanic Performing Work</label>
                      <select 
                        className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none bg-white"
                        value={selectedMechanicId}
                        onChange={e => setSelectedMechanicId(e.target.value)}
                      >
                        {allMechanics.map(m => (
                          <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Other Parts (Non-Inventory)</label>
                      <input 
                        type="text" 
                        className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                        placeholder="E.G. OIL FILTER, SPARK PLUG..."
                        value={newLog.partsReplaced}
                        onChange={e => setNewLog({ ...newLog, partsReplaced: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase">Inventory & Manual Parts</label>
                      <div className="space-y-2">
                        <select 
                          className="w-full p-2 border border-[#141414] text-[10px] font-mono focus:outline-none bg-white"
                          onChange={(e) => {
                            const partId = e.target.value;
                            if (!partId) return;
                            if (selectedParts.find(sp => sp.partId === partId)) return;
                            const part = availableParts.find(p => p.id === partId);
                            if (part) {
                              setSelectedParts([...selectedParts, { 
                                partId: part.id, 
                                partName: part.name, 
                                sku: part.sku, 
                                quantity: 1 
                              }]);
                            }
                            setShowConfirmParts(false);
                            e.target.value = '';
                          }}
                        >
                          <option value="">SELECT FROM INVENTORY...</option>
                          {availableParts.filter(p => p.quantity > 0).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) - Qty: {p.quantity}</option>
                          ))}
                        </select>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="MANUAL PART NAME"
                            className="flex-1 p-2 border border-[#141414] text-[10px] font-mono focus:outline-none"
                            value={manualPart.name}
                            onChange={e => setManualPart({ ...manualPart, name: e.target.value })}
                          />
                          <input 
                            type="text" 
                            placeholder="SKU"
                            className="w-24 p-2 border border-[#141414] text-[10px] font-mono focus:outline-none"
                            value={manualPart.sku}
                            onChange={e => setManualPart({ ...manualPart, sku: e.target.value })}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (!manualPart.name || !manualPart.sku) return;
                              setSelectedParts([...selectedParts, { 
                                partName: manualPart.name, 
                                sku: manualPart.sku, 
                                quantity: 1 
                              }]);
                              setManualPart({ name: '', sku: '' });
                            }}
                            className="px-3 py-2 bg-[#141414] text-white text-[10px] font-bold uppercase"
                          >
                            ADD
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {selectedParts.map((sp, idx) => {
                            const part = sp.partId ? availableParts.find(p => p.id === sp.partId) : null;
                            return (
                              <div key={idx} className="flex items-center gap-1 bg-white border border-[#141414] px-1.5 py-1 shadow-[2px_2px_0px_0px_rgba(20,20,20,0.05)]">
                                <span className="text-[8px] font-bold uppercase tracking-tighter max-w-[100px] truncate">
                                  {sp.partName} <span className="text-gray-400">({sp.sku})</span>
                                </span>
                                <div className="flex items-center gap-1 ml-1 bg-gray-50 border border-gray-100">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const next = [...selectedParts];
                                      next[idx].quantity = Math.max(1, next[idx].quantity - 1);
                                      setSelectedParts(next);
                                    }}
                                    className="px-1 hover:bg-gray-200 text-[10px] font-bold"
                                  >-</button>
                                  <span className="text-[8px] font-mono w-4 text-center">{sp.quantity}</span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const next = [...selectedParts];
                                      const max = part?.quantity || 999;
                                      next[idx].quantity = Math.min(max, next[idx].quantity + 1);
                                      setSelectedParts(next);
                                    }}
                                    className="px-1 hover:bg-gray-200 text-[10px] font-bold"
                                  >+</button>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setSelectedParts(selectedParts.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 ml-1"
                                >
                                  <Plus className="rotate-45" size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  {showConfirmParts && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>Confirm: Deduct {selectedParts.reduce((acc, p) => acc + p.quantity, 0)} parts from inventory?</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmParts(false)}
                        className="text-gray-500 hover:text-gray-800"
                      >
                        CANCEL
                      </button>
                    </div>
                  )}
                  <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full py-2 text-white text-xs font-bold transition-colors disabled:opacity-50 ${showConfirmParts ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#141414] hover:bg-gray-800'}`}
                  >
                    {loading ? 'LOGGING...' : (showConfirmParts ? 'CONFIRM & ADD LOG ENTRY' : 'ADD LOG ENTRY')}
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
                    <div key={log.id} className="p-4 border border-[#141414] bg-white relative shadow-[4px_4px_0px_0px_rgba(20,20,20,0.05)]">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#141414] bg-gray-100 px-2 py-0.5 border border-gray-200">
                          {log.mechanicName || `ID: ${log.mechanicId?.slice(0, 5)}`}
                        </span>
                      </div>
                      <p className="text-sm mb-3 font-medium">{log.workDone}</p>
                      {log.partsReplaced && (
                        <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold bg-blue-50 p-1.5 border border-blue-100 mb-2">
                          <Settings size={10} /> PARTS: {log.partsReplaced}
                        </div>
                      )}
                      {log.usedParts && log.usedParts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {log.usedParts.map((up, idx) => (
                            <span key={idx} className="text-[9px] font-bold bg-gray-50 text-gray-600 border border-gray-200 px-1.5 py-0.5 uppercase">
                              {up.partName} <span className="text-gray-400">({up.sku})</span> x{up.quantity}
                            </span>
                          ))}
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
                <InfoItem label="Machine ID" value={ticket.machineryId?.slice(0, 8) || ''} />
                <InfoItem label="Customer ID" value={ticket.customerId?.slice(0, 8) || ''} />
                {mechanic && <InfoItem label="Assigned To" value={mechanic.name} />}
              </div>
            </div>

            {machinery && (
              <div className="bg-white border border-[#141414] p-6 space-y-4">
                <h3 className="text-xs font-bold tracking-widest uppercase italic border-b border-[#141414] pb-2">Machinery History</h3>
                <div className="space-y-3">
                  <InfoItem label="Purchase Date" value={machinery.purchaseDate ? new Date(machinery.purchaseDate).toLocaleDateString() : 'N/A'} />
                  <InfoItem label="Last Service" value={machinery.lastServiceDate ? new Date(machinery.lastServiceDate).toLocaleDateString() : 'N/A'} />
                  <InfoItem label="Warranty Expiry" value={new Date(machinery.warrantyExpiry).toLocaleDateString()} />
                </div>
              </div>
            )}

            {ticket.status === 'Completed' && machinery && customer && (
              <button 
                onClick={() => generatePDFReport(ticket, machinery, customer, logs)}
                className="w-full py-4 border border-[#141414] bg-white text-[#141414] font-bold text-sm tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={18} /> DOWNLOAD PDF REPORT
              </button>
            )}

            {ticket.status !== 'Completed' && (
              <div className="space-y-4">
                {showSatisfactionModal && (
                  <div className="bg-amber-50 border border-amber-200 p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(217,119,6,0.1)]">
                    <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={14} /> Rate Customer Satisfaction (1-5)
                    </p>
                    <div className="flex justify-between gap-2">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          onClick={() => setSatisfactionScore(score)}
                          className={`flex-1 py-2 text-xs font-bold border border-[#141414] transition-all ${
                            satisfactionScore === score 
                              ? 'bg-[#141414] text-white' 
                              : 'bg-white text-[#141414] hover:bg-gray-100'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleCompleteTicket}
                        disabled={loading}
                        className="flex-1 py-2 bg-green-600 text-white font-bold text-[10px] tracking-widest hover:bg-green-700 transition-all uppercase"
                      >
                        {loading ? 'COMPLETING...' : 'CONFIRM COMPLETION'}
                      </button>
                      <button 
                        onClick={() => setShowSatisfactionModal(false)}
                        className="px-4 py-2 border border-gray-300 text-gray-500 text-[10px] font-bold uppercase hover:bg-gray-50"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}
                
                {!showSatisfactionModal && (
                  <button 
                    onClick={handleCompleteTicket}
                    disabled={loading}
                    className="w-full py-4 bg-green-600 text-white font-bold text-sm tracking-widest hover:bg-green-700 transition-all shadow-[4px_4px_0px_0px_rgba(22,101,52,1)] disabled:opacity-50"
                  >
                    COMPLETE SERVICE
                  </button>
                )}
              </div>
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
    if (ticket.satisfactionScore) {
      doc.text(`Customer Satisfaction: ${ticket.satisfactionScore} / 5`, 20, 181);
    }
  }

  // Work Logs Table
  const tableData = logs.map(log => {
    const partsText = [
      log.partsReplaced,
      ...(log.usedParts || []).map(up => `${up.partName} [${up.sku}] (x${up.quantity})`)
    ].filter(Boolean).join(', ');

    return [
      new Date(log.timestamp).toLocaleDateString(),
      log.workDone,
      partsText || '-'
    ];
  });

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

  doc.save(`Service_Report_${ticket.id?.slice(0, 8) || 'unknown'}.pdf`);
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
          const partsText = [
            log.partsReplaced,
            ...(log.usedParts || []).map(up => `${up.partName} [${up.sku}] (x${up.quantity})`)
          ].filter(Boolean).join(', ');

          const logText = `- ${new Date(log.timestamp).toLocaleDateString()}: ${log.workDone}${partsText ? ` (Parts: ${partsText})` : ''}`;
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
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchMachine, setSearchMachine] = useState('');

  useEffect(() => {
    if (!profile) return;
    
    const fetchHistoryData = async () => {
      try {
        const [machRes, custRes] = await Promise.all([
          supabase.from('machinery').select('*'),
          supabase.from('customers').select('*')
        ]);

        if (machRes.error) throw machRes.error;
        if (custRes.error) throw custRes.error;

        setMachinery((machRes.data as any[]).map(m => ({
          ...m,
          customerId: m.customer_id,
          serialNumber: m.serial_number,
          purchaseDate: m.purchase_date,
          warrantyExpiry: m.warranty_expiry,
          lastServiceDate: m.last_service_date,
          nextServiceDueDate: m.next_service_due_date
        })) as Machinery[]);

        const custMap: Record<string, Customer> = {};
        (custRes.data as any[]).forEach(c => {
          custMap[c.id] = {
            ...c,
            invoiceDate: c.invoice_date,
            invoiceNumber: c.invoice_number,
            invoiceAmount: c.invoice_amount,
            createdAt: c.created_at
          } as Customer;
        });
        setCustomers(custMap);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'history-view-init');
      }
    };

    fetchHistoryData();
  }, [profile]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    
    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from('service_tickets')
        .select('*')
        .eq('machinery_id', selectedId)
        .order('opened_at', { ascending: false });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'history-tickets');
      } else {
        const mappedTickets = (data as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[];
        setTickets(mappedTickets);
      }
      setLoading(false);
    };

    fetchTickets();
  }, [selectedId]);

  const handleDownloadFullReport = async () => {
    if (!selectedId || !profile) return;
    setLoadingReport(true);
    try {
      const m = machinery.find(m => m.id === selectedId);
      if (!m) throw new Error("Machinery not found");
      
      const customer = customers[m.customerId];
      if (!customer) throw new Error("Customer not found");

      // Fetch all logs for all tickets
      const allLogs: Record<string, ServiceLog[]> = {};
      for (const t of tickets) {
        const { data: logsData, error: logsError } = await supabase
          .from('service_logs')
          .select('*')
          .eq('ticket_id', t.id)
          .order('timestamp', { ascending: true });
        
        if (logsError) throw logsError;

        allLogs[t.id] = (logsData as any[]).map(l => ({
          ...l,
          ticketId: l.ticket_id,
          mechanicId: l.mechanic_id,
          mechanicName: l.mechanic_name,
          partsReplaced: l.parts_replaced,
          usedParts: l.used_parts
        })) as ServiceLog[];
      }

      generateMachineryFullReport(m, customer, tickets, allLogs);
      
      await logAudit(profile.uid, profile.name, 'DOWNLOAD', 'MachineryReport', m.id, `Generated full report for ${m.model} from History View`);
    } catch (err) {
      handleSupabaseError(err, OperationType.LIST, 'machinery_report');
    } finally {
      setLoadingReport(false);
    }
  };

  const filteredMachinery = machinery.filter(m => 
    m.model.toLowerCase().includes(searchMachine.toLowerCase()) || 
    m.serialNumber.toLowerCase().includes(searchMachine.toLowerCase()) ||
    customers[m.customerId]?.name.toLowerCase().includes(searchMachine.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-180px)]">
      {/* Left Sidebar: Machine List */}
      <div className="w-full lg:w-80 flex flex-col bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <div className="p-4 border-b border-[#141414] bg-gray-50">
          <h3 className="text-xs font-bold tracking-widest uppercase italic mb-3">Select Machinery</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="SEARCH MACHINE..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#141414] text-[10px] font-mono focus:outline-none"
              value={searchMachine}
              onChange={e => setSearchMachine(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredMachinery.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-[10px] font-mono uppercase italic">No machines found</div>
          ) : (
            filteredMachinery.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full p-4 text-left border-b border-gray-100 transition-all hover:bg-gray-50 flex items-center gap-3 ${selectedId === m.id ? 'bg-gray-100 border-l-4 border-l-[#141414]' : ''}`}
              >
                <div className={`w-8 h-8 flex items-center justify-center border border-[#141414] ${selectedId === m.id ? 'bg-[#141414] text-white' : 'bg-white text-[#141414]'}`}>
                  {getMachineryIcon(m.type, 16)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-[11px] font-bold uppercase truncate">{m.model}</p>
                  <p className="text-[9px] font-mono text-gray-400 truncate">#{m.serialNumber}</p>
                  <p className="text-[9px] font-bold text-gray-500 truncate mt-0.5">{customers[m.customerId]?.name}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: History Details */}
      <div className="flex-1 flex flex-col bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <History size={64} className="mx-auto mb-6 text-gray-200" />
              <h2 className="text-xl font-bold tracking-tighter uppercase italic mb-2">Service History</h2>
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase italic">Select a machine from the list to view its full service history.</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[#141414] bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center border-2 border-[#141414] bg-[#141414] text-white shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                  {(() => {
                    const m = machinery.find(m => m.id === selectedId);
                    return m ? getMachineryIcon(m.type, 28) : <Construction size={28} />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold tracking-tighter uppercase">{machinery.find(m => m.id === selectedId)?.model}</h3>
                    <span className="text-[10px] font-mono bg-gray-200 px-2 py-0.5 rounded uppercase">#{machinery.find(m => m.id === selectedId)?.serialNumber}</span>
                  </div>
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
              <button 
                onClick={handleDownloadFullReport}
                disabled={loadingReport}
                className="px-6 py-3 bg-[#141414] text-white text-xs font-bold tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
              >
                {loadingReport ? <Clock size={16} className="animate-spin" /> : <Download size={16} />}
                DOWNLOAD FULL REPORT
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p className="text-xs font-bold tracking-widest uppercase italic">No service history found for this machine.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {tickets.map(t => (
                    <div key={t.id} className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
                      <div className="p-4 bg-gray-100 border-b border-[#141414] flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[9px] font-bold border ${
                            t.status === 'Completed' ? 'bg-green-100 text-green-800 border-green-200' : 
                            t.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'
                          } uppercase`}>
                            {t.status}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-tight">{t.description}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Opened</p>
                            <p className="text-[10px] font-mono">{new Date(t.openedAt).toLocaleDateString()}</p>
                          </div>
                          {t.closedAt && (
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Closed</p>
                              <p className="text-[10px] font-mono">{new Date(t.closedAt).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>
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
          </div>
        )}
      </div>
    </motion.div>
  );
}

function InventoryView() {
  const { profile, canEditInventory } = useAuth();
  const { addToast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [viewingPart, setViewingPart] = useState<Part | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    const fetchParts = async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'parts');
      } else {
        const mappedParts = (data as any[]).map(p => ({
          ...p,
          minQuantity: p.min_quantity,
          unitPrice: p.unit_price,
          updatedAt: p.updated_at
        })) as Part[];
        setParts(mappedParts);
        setLoading(false);
      }
    };

    fetchParts();

    const partsSub = supabase
      .channel('parts_inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parts' }, () => fetchParts())
      .subscribe();

    return () => {
      partsSub.unsubscribe();
    };
  }, [profile]);

  const filtered = parts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="SEARCH INVENTORY..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#141414] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#141414] text-xs font-mono focus:outline-none appearance-none cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">ALL CATEGORIES</option>
              <option value="General">GENERAL</option>
              <option value="Engine">ENGINE</option>
              <option value="Hydraulics">HYDRAULICS</option>
              <option value="Electrical">ELECTRICAL</option>
              <option value="Tires">TIRES</option>
              <option value="Filters">FILTERS</option>
              <option value="Fluids">FLUIDS</option>
            </select>
          </div>
        </div>
        {canEditInventory && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
          >
            <Plus size={16} /> ADD NEW PART
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(p => (
          <div 
            key={p.id} 
            onClick={() => setViewingPart(p)}
            className={`bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer group relative ${p.quantity <= (p.minQuantity || 0) ? 'border-amber-500 bg-amber-50/30' : ''}`}
          >
            {p.quantity <= (p.minQuantity || 0) && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 border border-amber-200 uppercase tracking-widest">
                <AlertCircle size={10} /> Low Stock
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 flex items-center justify-center border border-[#141414] bg-gray-50 group-hover:bg-[#141414] group-hover:text-white transition-colors">
                <Box size={20} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{p.category}</p>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest">{p.sku}</p>
              </div>
            </div>
            <h3 className="text-sm font-bold uppercase mb-2 line-clamp-1">{p.name}</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Quantity</p>
                <p className={`text-2xl font-bold tracking-tighter ${p.quantity <= (p.minQuantity || 0) ? 'text-red-600' : ''}`}>{p.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Unit Price</p>
                <p className="text-sm font-bold font-mono">${p.unitPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewingPart && (
        <PartDetailModal 
          part={viewingPart} 
          onClose={() => setViewingPart(null)} 
          onEdit={() => {
            setSelectedPart(viewingPart);
            setViewingPart(null);
          }}
        />
      )}

      {(isAdding || selectedPart) && (
        <PartModal 
          part={selectedPart} 
          onClose={() => { setSelectedPart(null); setIsAdding(false); }} 
        />
      )}
    </motion.div>
  );
}

function PartDetailModal({ part, onClose, onEdit }: { part: Part, onClose: () => void, onEdit: () => void }) {
  const { canEditInventory } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] max-w-lg w-full shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] overflow-hidden"
      >
        <div className="p-6 border-b border-[#141414] bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center border border-[#141414] bg-[#141414] text-white">
              <Box size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tighter uppercase italic leading-none">{part.name}</h2>
              <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mt-1">{part.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 transition-colors border border-[#141414]">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</p>
              <p className="text-sm font-bold uppercase">{part.category || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unit Price</p>
              <p className="text-sm font-bold font-mono">${part.unitPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Stock</p>
              <p className={`text-2xl font-bold tracking-tighter ${part.quantity <= (part.minQuantity || 0) ? 'text-red-600' : ''}`}>
                {part.quantity}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Min. Threshold</p>
              <p className="text-sm font-bold">{part.minQuantity || 0} UNITS</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</p>
            <div className="p-4 bg-gray-50 border border-[#141414] text-xs font-mono leading-relaxed min-h-[80px]">
              {part.description || 'NO DESCRIPTION PROVIDED.'}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <div className="text-[9px] font-mono text-gray-400 uppercase">
              Last Updated: {part.updatedAt ? new Date(part.updatedAt).toLocaleString() : 'N/A'}
            </div>
            {canEditInventory && (
              <button 
                onClick={onEdit}
                className="px-6 py-2 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
              >
                Edit Details
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PartModal({ part, onClose }: { part: Part | null, onClose: () => void }) {
  const { profile, canEditInventory } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<Part, 'id' | 'updatedAt'>>({
    name: part?.name || '',
    sku: part?.sku || '',
    description: part?.description || '',
    quantity: part?.quantity || 0,
    minQuantity: part?.minQuantity || 5,
    unitPrice: part?.unitPrice || 0,
    category: part?.category || 'General'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInventory) return;
    setLoading(true);
    try {
      if (part) {
        const { error: partError } = await supabase
          .from('parts')
          .update({
            name: formData.name,
            sku: formData.sku,
            description: formData.description,
            quantity: formData.quantity,
            min_quantity: formData.minQuantity,
            unit_price: formData.unitPrice,
            category: formData.category,
            updated_at: new Date().toISOString()
          })
          .eq('id', part.id);
        
        if (partError) throw partError;
        
        // Trigger low stock notification if needed during update
        if (formData.quantity <= (formData.minQuantity || 0)) {
          await supabase.from('notifications').insert({
            type: 'LOW_STOCK',
            status: 'SYSTEM',
            sent_at: new Date().toISOString(),
            part_id: part.id,
            part_name: formData.name,
            message: `LOW STOCK ALERT: ${formData.name} (SKU: ${formData.sku}) is at ${formData.quantity} units. Minimum required: ${formData.minQuantity}.`
          });
        }

        if (profile) {
          await logAudit(profile.uid, profile.name, 'UPDATE', 'Part', part.id, `Updated part: ${formData.name}`);
        }
        addToast("Part updated successfully", "success");
      } else {
        const { data: newPart, error: partError } = await supabase
          .from('parts')
          .insert({
            name: formData.name,
            sku: formData.sku,
            description: formData.description,
            quantity: formData.quantity,
            min_quantity: formData.minQuantity,
            unit_price: formData.unitPrice,
            category: formData.category,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (partError) throw partError;

        // Trigger low stock notification if needed for new part
        if (formData.quantity <= (formData.minQuantity || 0)) {
          await supabase.from('notifications').insert({
            type: 'LOW_STOCK',
            status: 'SYSTEM',
            sent_at: new Date().toISOString(),
            part_id: newPart.id,
            part_name: formData.name,
            message: `LOW STOCK ALERT: ${formData.name} (SKU: ${formData.sku}) is at ${formData.quantity} units. Minimum required: ${formData.minQuantity}.`
          });
        }

        if (profile) {
          await logAudit(profile.uid, profile.name, 'CREATE', 'Part', newPart.id, `Created part: ${formData.name}`);
        }
        addToast("Part added successfully", "success");
      }
      onClose();
    } catch (err) {
      handleSupabaseError(err, OperationType.WRITE, 'parts');
      addToast("Failed to save part", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!part || !canEditInventory || profile?.role !== 'Administrator') return;
    if (!window.confirm("ARE YOU ABSOLUTELY SURE? THIS CANNOT BE UNDONE.")) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', part.id);
      
      if (error) throw error;
      if (profile) {
        await logAudit(profile.uid, profile.name, 'DELETE', 'Part', part.id, `Deleted part: ${part.name}`);
      }
      addToast("Part deleted successfully", "success");
      onClose();
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, 'parts');
      addToast("Failed to delete part", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] max-w-md w-full shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] overflow-hidden"
      >
        <div className="p-6 border-b border-[#141414] bg-gray-50 flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tighter uppercase italic">{part ? 'Edit Part' : 'Add New Part'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 transition-colors border border-[#141414]">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Part Name *</label>
              <input 
                required
                type="text"
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">SKU / Part Number *</label>
              <input 
                required
                type="text"
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Category</label>
              <select 
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none bg-white"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="General">General</option>
                <option value="Engine">Engine</option>
                <option value="Hydraulics">Hydraulics</option>
                <option value="Electrical">Electrical</option>
                <option value="Tires">Tires</option>
                <option value="Filters">Filters</option>
                <option value="Fluids">Fluids</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Quantity *</label>
              <input 
                required
                type="number"
                min="0"
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                value={formData.quantity}
                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Min Quantity *</label>
              <input 
                required
                type="number"
                min="0"
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                value={formData.minQuantity}
                onChange={e => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Unit Price ($) *</label>
              <input 
                required
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none"
                value={formData.unitPrice}
                onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">Description</label>
              <textarea 
                className="w-full p-2 border border-[#141414] text-xs font-mono focus:outline-none h-20"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-[#141414] text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {loading ? 'SAVING...' : (part ? 'UPDATE PART' : 'ADD PART')}
            </button>
            {part && profile?.role === 'Administrator' && (
              <button 
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-3 border border-red-600 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TicketLogs({ ticketId, ticket, machinery, customer }: { ticketId: string, ticket?: ServiceTicket, machinery?: Machinery, customer?: Customer }) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ServiceLog[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('service_logs')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'ticket-logs');
      } else {
        const mappedLogs = (data as any[]).map(l => ({
          ...l,
          ticketId: l.ticket_id,
          mechanicId: l.mechanic_id,
          mechanicName: l.mechanic_name,
          partsReplaced: l.parts_replaced,
          usedParts: l.used_parts
        })) as ServiceLog[];
        setLogs(mappedLogs);
      }
    };

    fetchLogs();
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
            <span className="text-[9px] font-mono text-gray-300">MECH: {log.mechanicId?.slice(0, 5)}</span>
          </div>
          <p className="text-xs">{log.workDone}</p>
          {log.partsReplaced && <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase">Parts: {log.partsReplaced}</p>}
          {log.usedParts && log.usedParts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {log.usedParts.map((up, idx) => (
                <span key={idx} className="text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 uppercase">
                  {up.partName} <span className="text-blue-400">({up.sku})</span> x{up.quantity}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MechanicsView() {
  const { profile, canEditMechanics } = useAuth();
  const { addToast } = useToast();
  const [mechanics, setMechanics] = useState<UserProfile[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<UserProfile | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!profile) return;
    
    const fetchMechanics = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'users');
      } else {
        setMechanics(data.map(d => ({ 
          uid: d.uid, 
          name: d.name,
          email: d.email,
          role: d.role,
          createdAt: d.created_at 
        } as UserProfile)));
      }
    };

    const fetchTickets = async () => {
      const { data, error } = await supabase
        .from('service_tickets')
        .select('*');
      
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'service_tickets');
      } else {
        const mappedTickets = (data as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[];
        setTickets(mappedTickets);
        setLoading(false);
      }
    };

    fetchMechanics();
    fetchTickets();

    const usersSub = supabase
      .channel('mechanics_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMechanics())
      .subscribe();

    const ticketsSub = supabase
      .channel('mechanics_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => fetchTickets())
      .subscribe();

    return () => {
      usersSub.unsubscribe();
      ticketsSub.unsubscribe();
    };
  }, [profile]);

  const getMechanicKPIs = (uid: string) => {
    const mechTickets = tickets.filter(t => t.mechanicId === uid);
    const completed = mechTickets.filter(t => t.status === 'Completed');
    
    let avgCompletionTime = 0;
    if (completed.length > 0) {
      const totalTime = completed.reduce((acc, t) => {
        if (t.closedAt) {
          return acc + (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime());
        }
        return acc;
      }, 0);
      avgCompletionTime = totalTime / completed.length;
    }

    const scores = completed.filter(t => t.satisfactionScore !== undefined).map(t => t.satisfactionScore!);
    const avgSatisfaction = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return {
      completedCount: completed.length,
      avgCompletionTime: avgCompletionTime > 0 ? Math.round(avgCompletionTime / (1000 * 60 * 60 * 24)) : null, // in days
      avgSatisfaction
    };
  };

  const handleDelete = async (uid: string) => {
    if (uid === profile?.uid) {
      addToast("You cannot delete your own account", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this team member?")) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('uid', uid);
      
      if (error) throw error;
      if (profile) {
        await logAudit(profile.uid, profile.name, 'DELETE', 'User', uid, 'Removed team member');
      }
      addToast("Team member removed successfully", "success");
    } catch (err) {
      addToast("Failed to remove team member", "error");
      handleSupabaseError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase italic">Team & Personnel Management</h2>
        {canEditMechanics && (
          <button 
            onClick={() => { setEditingMechanic(null); setIsModalOpen(true); }}
            className="px-4 py-2 bg-[#141414] text-white text-xs font-bold flex items-center gap-2 hover:bg-gray-800 transition-all"
          >
            <Plus size={16} /> ADD TEAM MEMBER
          </button>
        )}
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
                {(() => {
                  const kpis = getMechanicKPIs(m.uid);
                  return (
                    <>
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                        <span>Completed Tickets</span>
                        <span className="font-mono text-[#141414]">{kpis.completedCount}</span>
                      </div>
                      {kpis.avgCompletionTime !== null && (
                        <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                          <span>Avg Completion</span>
                          <span className="font-mono text-[#141414]">{kpis.avgCompletionTime} DAYS</span>
                        </div>
                      )}
                      {kpis.avgSatisfaction !== null && (
                        <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                          <span>Satisfaction</span>
                          <span className="font-mono text-[#141414]">{kpis.avgSatisfaction.toFixed(1)} / 5.0</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-400">
                  <span>ID</span>
                  <span className="font-mono text-[#141414]">{m.uid?.slice(0, 8)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
              <button 
                onClick={() => setSelectedMechanic(m)}
                className="w-full py-2 bg-[#141414] text-white text-[10px] font-bold hover:bg-gray-800 transition-colors uppercase flex items-center justify-center gap-2"
              >
                <Wrench size={12} /> View Performance
              </button>
              {canEditMechanics && (
                <div className="flex gap-2">
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
              )}
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

      {selectedMechanic && (
        <MechanicDetailModal 
          mechanic={selectedMechanic} 
          onClose={() => setSelectedMechanic(null)} 
        />
      )}
    </motion.div>
  );
}

function MechanicDetailModal({ mechanic, onClose }: { mechanic: UserProfile, onClose: () => void }) {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [machinery, setMachinery] = useState<Record<string, Machinery>>({});

  useEffect(() => {
    const fetchMechanicData = async () => {
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('service_tickets')
          .select('*')
          .eq('mechanic_id', mechanic.uid);
        
        if (ticketError) throw ticketError;

        const mappedTickets = (ticketData as any[]).map(t => ({
          ...t,
          machineryId: t.machinery_id,
          customerId: t.customer_id,
          mechanicId: t.mechanic_id,
          openedAt: t.opened_at,
          closedAt: t.closed_at,
          satisfactionScore: t.satisfaction_score
        })) as ServiceTicket[];
        
        setTickets(mappedTickets);
        
        // Fetch unique machinery info
        const machineIds = [...new Set(mappedTickets.map(t => t.machineryId))];
        const machineMap: Record<string, Machinery> = {};
        
        await Promise.all(machineIds.map(async (id) => {
          const { data: machData, error: machError } = await supabase
            .from('machinery')
            .select('*')
            .eq('id', id)
            .single();
          
          if (!machError && machData) {
            machineMap[id] = {
              ...machData,
              customerId: machData.customer_id,
              serialNumber: machData.serial_number,
              purchaseDate: machData.purchase_date,
              warrantyExpiry: machData.warranty_expiry,
              lastServiceDate: machData.last_service_date,
              nextServiceDueDate: machData.next_service_due_date
            } as Machinery;
          }
        }));
        
        setMachinery(machineMap);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'mechanic-detail');
      } finally {
        setLoading(false);
      }
    };

    fetchMechanicData();

    const ticketsSub = supabase
      .channel(`mechanic_tickets_${mechanic.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `mechanic_id=eq.${mechanic.uid}` }, () => fetchMechanicData())
      .subscribe();

    return () => {
      ticketsSub.unsubscribe();
    };
  }, [mechanic.uid]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const completed = tickets.filter(t => t.status === 'Completed');
    const completedCount = completed.length;
    const open = tickets.filter(t => t.status === 'Open').length;
    const inProgress = tickets.filter(t => t.status === 'In Progress').length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    let avgCompletionTime = 0;
    if (completedCount > 0) {
      const totalTime = completed.reduce((acc, t) => {
        if (t.closedAt) {
          return acc + (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime());
        }
        return acc;
      }, 0);
      avgCompletionTime = totalTime / completedCount;
    }

    const scores = completed.filter(t => t.satisfactionScore !== undefined).map(t => t.satisfactionScore!);
    const avgSatisfaction = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return { 
      total, 
      completed: completedCount, 
      open, 
      inProgress, 
      completionRate,
      avgCompletionTime: avgCompletionTime > 0 ? (avgCompletionTime / (1000 * 60 * 60 * 24)).toFixed(1) : null,
      avgSatisfaction: avgSatisfaction !== null ? avgSatisfaction.toFixed(1) : null
    };
  }, [tickets]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] max-w-4xl w-full h-[85vh] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] flex flex-col"
      >
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#141414] text-white rounded-full flex items-center justify-center text-xl font-bold">
              {mechanic.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tighter uppercase italic">{mechanic.name}</h2>
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{mechanic.role} • Joined {new Date(mechanic.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 transition-colors border border-[#141414]">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex justify-center p-12"><LoadingSpinner /></div>
          ) : (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Assigned</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Open Tickets</p>
                  <p className="text-2xl font-bold">{stats.open}</p>
                </div>
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Completion Rate</p>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                </div>
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Avg Completion</p>
                  <p className="text-2xl font-bold">{stats.avgCompletionTime || 'N/A'}<span className="text-[10px] ml-1">DAYS</span></p>
                </div>
                <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Satisfaction</p>
                  <p className="text-2xl font-bold">{stats.avgSatisfaction || 'N/A'}<span className="text-[10px] ml-1">/ 5.0</span></p>
                </div>
              </div>

              {/* Tickets List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold tracking-widest uppercase italic border-b border-[#141414] pb-2">Assigned Service Tickets</h3>
                <div className="space-y-3">
                  {tickets.length === 0 ? (
                    <p className="text-center py-12 text-gray-400 text-xs font-mono border border-dashed border-gray-300">NO TICKETS ASSIGNED TO THIS MECHANIC</p>
                  ) : (
                    tickets.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 border border-[#141414] bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 flex items-center justify-center border border-[#141414] ${
                            t.status === 'Open' ? 'bg-red-50 text-red-600' : 
                            t.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {machinery[t.machineryId] ? getMachineryIcon(machinery[t.machineryId].type, 16) : <Ticket size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-tight">{t.description}</p>
                            <p className="text-[9px] font-mono text-gray-400 uppercase">{machinery[t.machineryId]?.model || 'Unknown Machine'} • {new Date(t.openedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 border border-[#141414] uppercase ${
                          t.status === 'Open' ? 'bg-red-50 text-red-600' : 
                          t.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
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
        const { error } = await supabase
          .from('users')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role
          })
          .eq('uid', mechanic.uid);
        
        if (error) throw error;

        if (profile) {
          await logAudit(profile.uid, profile.name, 'UPDATE', 'User', mechanic.uid, `Updated team member: ${formData.name} (${formData.role})`);
        }
        addToast("Team member updated successfully", "success");
      } else {
        // Create (Pre-initialize profile)
        const uid = `invited_${Math.random().toString(36).slice(2, 11)}`;
        const newProfile = {
          uid: uid,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase
          .from('users')
          .insert(newProfile);
        
        if (error) throw error;
        if (profile) {
          await logAudit(profile.uid, profile.name, 'CREATE', 'User', uid, `Added new team member: ${formData.name} (${formData.role})`);
        }
        addToast("Team member added successfully", "success");
      }
      onClose();
    } catch (err) {
      addToast("Failed to save team member", "error");
      handleSupabaseError(err, mechanic ? OperationType.UPDATE : OperationType.CREATE, 'users');
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
