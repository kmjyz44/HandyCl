import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/apiClient';
import { ChatPanel } from '../components/ChatPanel';
import { NotificationPanel, NotificationBell } from '../components/NotificationPanel';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { ServiceZonesPanel } from '../components/ServiceZonesPanel';
import { ProviderInvoiceList, InvoiceCreateModal } from '../components/InvoiceComponents';
import { MultiStepBookingModal } from '../components/MultiStepBookingModal';
import { AdvancedSettingsPanel } from '../components/AdvancedSettingsPanel';
import { PaymentModal } from '../components/PaymentModal';
import { LanguageSelector, useLanguage } from '../i18n/LanguageContext';
import { 
  Users, Calendar, ClipboardList, Settings, LogOut, 
  Star, MapPin, Clock, ChevronRight, Menu, X,
  Home, MessageSquare, User, BarChart3, Plus, Trash2, Edit, 
  Ban, Check, Percent, Send, Phone, DollarSign, Key, Camera, Eye,
  Gift, HelpCircle, Sparkles, CreditCard, Award, TrendingUp,
  FileText, Briefcase, Target, Zap, ChevronLeft, Search, Bell,
  Image, AlertCircle, CheckCircle, Map, Globe, Wrench,
  EyeOff, SlidersHorizontal, ArrowUpDown, Filter, Star
} from 'lucide-react';

// ==================== ADMIN DASHBOARD ====================
function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, usersRes, bookingsRes, servicesRes] = await Promise.all([
        api.getDashboard().catch((e) => { console.log('Dashboard error:', e); return {}; }),
        api.getUsers().catch((e) => { console.log('Users error:', e); return { data: [] }; }),
        api.getBookings().catch((e) => { console.log('Bookings error:', e); return { data: [] }; }),
        api.getServices().catch((e) => { console.log('Services error:', e); return { data: [] }; })
      ]);
      setStats(dashRes.data || dashRes);
      // Handle both axios response format and direct array
      const usersData = usersRes?.data || usersRes;
      setUsers(Array.isArray(usersData) ? usersData : []);
      const bookingsData = bookingsRes?.data || bookingsRes;
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      const servicesData = servicesRes?.data || servicesRes;
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'executors', icon: Briefcase, label: 'Executors' },
    { id: 'bookings', icon: ClipboardList, label: 'Bookings' },
    { id: 'services', icon: Briefcase, label: 'Services' },
    { id: 'zones', icon: Map, label: 'Zones' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r fixed h-full">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            HandyHub Admin
          </h1>
        </div>
        
        <nav className="p-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                activeTab === item.id 
                  ? 'bg-green-50 text-green-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              data-testid={`admin-nav-${item.id}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Top Header */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-end gap-4">
          <LanguageSelector />
          <button
            onClick={() => setShowChat(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
            data-testid="open-chat-btn"
          >
            <MessageSquare className="w-5 h-5 text-gray-600" />
          </button>
          <NotificationBell onClick={() => setShowNotifications(true)} />
        </header>
        
        <div className="p-8">
          {activeTab === 'dashboard' && <AdminDashboardContent stats={stats} />}
          {activeTab === 'users' && <AdminUsersPanel users={users} onRefresh={loadData} />}
          {activeTab === 'executors' && <AdminExecutorsPanel />}
          {activeTab === 'bookings' && <AdminBookingsPanel bookings={bookings} onRefresh={loadData} />}
          {activeTab === 'services' && <AdminServicesPanel services={services} onRefresh={loadData} />}
          {activeTab === 'zones' && <ServiceZonesPanel />}
          {activeTab === 'analytics' && <AdminAnalyticsPanel />}
          {activeTab === 'settings' && <AdminSettingsPanel />}
        </div>
      </main>

      {/* Panels */}
      <NotificationPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
      <ChatPanel 
        isOpen={showChat} 
        onClose={() => setShowChat(false)}
        currentUser={user}
      />
    </div>
  );
}

// Admin Dashboard Content
function AdminDashboardContent({ stats }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_users || 0}</p>
              <p className="text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_bookings || 0}</p>
              <p className="text-gray-500">Total Bookings</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_services || 0}</p>
              <p className="text-gray-500">Services</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats?.pending_bookings || 0}</p>
              <p className="text-gray-500">Pending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== PROVIDER DASHBOARD ====================
function ProviderDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, tasksRes, profileRes] = await Promise.all([
        api.getMyProviderStats().catch(() => ({})),
        api.getProviderTasks().catch(() => ({ data: [] })),
        api.getExecutorProfile(user?.user_id).catch(() => ({}))
      ]);
      setStats(statsRes.data || statsRes);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : (Array.isArray(tasksRes) ? tasksRes : []));
      setProfile(profileRes.data || profileRes);
    } catch (error) {
      console.error('Error loading provider data:', error);
    }
  };

  // Menu items matching TaskRabbit Tasker app
  const menuItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'tasks', icon: ClipboardList, label: 'Tasks' },
    { id: 'invoices', icon: FileText, label: 'Invoices' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'performance', icon: BarChart3, label: 'Performance' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          HandyHub
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowChat(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
            data-testid="provider-chat-btn"
          >
            <MessageSquare className="w-5 h-5 text-gray-600" />
          </button>
          <NotificationBell onClick={() => setShowNotifications(true)} />
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-gray-100 rounded-full text-red-600"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-24">
        {activeTab === 'home' && <ProviderHomeContent stats={stats} user={user} onTaskSelect={(t) => { setSelectedTask(t); setActiveTab('tasks'); }} />}
        {activeTab === 'tasks' && <ProviderTasksContent tasks={tasks} onRefresh={loadData} onTaskSelect={setSelectedTask} />}
        {activeTab === 'invoices' && <ProviderInvoicesContent tasks={tasks} />}
        {activeTab === 'calendar' && <ProviderCalendarContent />}
        {activeTab === 'performance' && <ProviderPerformanceContent stats={stats} />}
        {activeTab === 'profile' && <ProviderProfileContent user={user} profile={profile} onRefresh={loadData} />}
      </main>

      {/* Bottom Navigation - TaskRabbit style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
              activeTab === item.id 
                ? 'text-green-600' 
                : 'text-gray-500'
            }`}
            data-testid={`provider-nav-${item.id}`}
          >
            <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'text-green-600' : ''}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Panels */}
      <NotificationPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
      <ChatPanel 
        isOpen={showChat} 
        onClose={() => setShowChat(false)}
        currentUser={user}
      />
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        userRole="provider"
        onUpdate={loadData}
      />
    </div>
  );
}

// Provider Home Content
function ProviderHomeContent({ stats, user, onTaskSelect, onOpenInvoice }) {
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'short' });
  const completedThisMonth = stats?.stats?.total_completed_tasks || 0;
  const earningsThisMonth = stats?.stats?.total_earnings || 0;
  const upcomingTasks = (stats?.tasks || []).filter(t =>
    ['assigned','accepted','in_progress'].includes(t.status)
  ).sort((a,b) => new Date(a.date||0) - new Date(b.date||0));

  return (
    <div className="space-y-0 max-w-lg mx-auto">
      {/* Green header banner */}
      <div className="bg-green-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {user?.picture
              ? <img src={user.picture} className="w-full h-full object-cover" alt=""/>
              : (user?.name||'T').charAt(0)}
          </div>
          <span className="text-white text-xl font-bold">Hello, {user?.name?.split(' ')[0] || 'Tasker'}!</span>
        </div>
        {/* Same-day tasks banner */}
        <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-white/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">Same day tasks</span>
              <span className="bg-white/30 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {upcomingTasks.filter(t => t.date === now.toISOString().split('T')[0]).length > 0 ? 'AVAILABLE' : 'NOT RECEIVING'}
              </span>
            </div>
            <p className="text-white/70 text-xs mt-0.5">Get tasks that need to be done today.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </div>
      </div>

      {/* Upcoming tasks */}
      {upcomingTasks.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden mb-4">
          <div className="px-4 pt-4 pb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">LATER</span>
          </div>
          <div className="divide-y">
            {upcomingTasks.slice(0,5).map(task => {
              const clientName = task.client_name || task.client_info?.name || 'Client';
              const initials = clientName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
              const taskDate = task.date
                ? new Date(task.date).toLocaleString('en-US',{weekday:'short',month:'short',day:'2-digit'})
                : '—';
              return (
                <button
                  key={task.task_id||task.booking_id}
                  onClick={() => onTaskSelect(task)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {task.title||task.description||'Task'}: {clientName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {taskDate}{task.time ? `, ${task.time}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly earnings summary */}
      <button
        onClick={() => {}}
        className="w-full bg-white rounded-2xl border p-4 flex items-center justify-between hover:bg-gray-50 mb-4"
      >
        <div className="text-left">
          <p className="font-bold text-gray-900">{completedThisMonth} completed tasks this {monthName}</p>
          <p className="text-sm text-gray-500 mt-0.5">You've earned ${earningsThisMonth.toFixed(2)} this month.</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </button>

      {/* No tasks state */}
      {upcomingTasks.length === 0 && (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-7 h-7 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900 mb-1">No upcoming tasks</p>
          <p className="text-sm text-gray-500">Check the Tasks tab for available work</p>
        </div>
      )}
    </div>
  );
}

  const [selectedTask, setSelectedTask] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'available') return t.status === 'posted' || t.status === 'offering';
    if (filter === 'active') return ['assigned','accepted','in_progress'].includes(t.status);
    if (filter === 'past') return ['completed','paid','completed_pending_payment','cancelled_by_tasker','cancelled_by_client'].includes(t.status);
    return true;
  });

  const handleAccept = async (taskId, e) => {
    e?.stopPropagation();
    try { await api.acceptTask(taskId); onRefresh(); }
    catch { alert('Could not accept task'); }
  };

  const openTaskDetail = (task) => { setSelectedTask(task); };

  if (selectedTask && !showInvoice && !showReschedule && !showCancel) {
    return (
      <TaskDetailView
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
        onAccept={() => { handleAccept(selectedTask.task_id||selectedTask.booking_id); setSelectedTask(null); }}
        onCreateInvoice={() => setShowInvoice(true)}
        onReschedule={() => setShowReschedule(true)}
        onCancel={() => setShowCancel(true)}
        onRefresh={onRefresh}
      />
    );
  }

  if (showInvoice && selectedTask) {
    return (
      <CreateInvoiceScreen
        task={selectedTask}
        onBack={() => setShowInvoice(false)}
        onSubmitted={() => { setShowInvoice(false); setSelectedTask(null); onRefresh(); }}
      />
    );
  }

  if (showReschedule && selectedTask) {
    return (
      <RescheduleScreen
        task={selectedTask}
        onBack={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); setSelectedTask(null); onRefresh(); }}
      />
    );
  }

  if (showCancel && selectedTask) {
    return (
      <CancelTaskScreen
        task={selectedTask}
        onBack={() => setShowCancel(false)}
        onDone={() => { setShowCancel(false); setSelectedTask(null); onRefresh(); }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex gap-2 bg-white rounded-xl p-1.5 border">
        {[
          { id: 'available', label: 'Available' },
          { id: 'active', label: 'Active' },
          { id: 'past', label: 'Past' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >{f.label}</button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border text-center text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No {filter} tasks</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const id = task.task_id || task.booking_id;
            const clientName = task.client_name || task.client_info?.name || 'Client';
            const initials = clientName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
            const dateStr = task.date
              ? new Date(task.date).toLocaleString('en-US',{weekday:'short',month:'short',day:'2-digit'})
              : '';
            const isPendingInvoice = task.status === 'completed_pending_payment';
            return (
              <button key={id} onClick={() => openTaskDetail(task)}
                className="w-full bg-white rounded-2xl border p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {task.title||task.description||'Task'}: {clientName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {dateStr}{task.time ? `, ${task.time}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isPendingInvoice && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                        Invoice sent
                      </span>
                    )}
                    {filter === 'available' && (
                      <button onClick={e => handleAccept(id, e)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium"
                      >Accept</button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Task Detail View (TaskRabbit style) ─────────────────────────────────────
function TaskDetailView({ task, onBack, onAccept, onCreateInvoice, onReschedule, onCancel, onRefresh }) {
  const [activeTab, setActiveTab] = useState('details');
  const dateStr = task.date
    ? new Date(task.date).toLocaleString('en-US',{weekday:'short',month:'long',day:'2-digit'})
    : '';
  const timeStr = task.time || '';
  const canInvoice = ['in_progress','assigned','accepted','completed'].includes(task.status);
  const canCancel = ['assigned','accepted','in_progress'].includes(task.status);
  const rate = task.provider_hourly_rate || task.total_price || 0;

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 mb-4 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      {dateStr && (
        <h2 className="text-xl font-bold text-gray-900 text-center mb-4">
          {dateStr}{timeStr ? ` at ${timeStr}` : ''}
        </h2>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {['details','chat'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
              activeTab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'
            }`}
          >{t === 'details' ? 'Task Details' : 'Chat'}</button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-white rounded-2xl border p-4 flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
              {(task.client_name||task.client_info?.name||'C').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-900">{task.title || task.description || 'Task'}</p>
              <p className="text-sm text-gray-500">for {task.client_name||task.client_info?.name||'Client'}</p>
              <button className="text-sm text-green-600 font-semibold mt-1">View task history</button>
            </div>
          </div>

          {/* Date */}
          {dateStr && (
            <div className="bg-white rounded-2xl border p-4">
              <p className="font-medium text-gray-900">
                {task.date} • {timeStr}
                {task.estimated_hours ? ` - ${timeStr} (+${task.estimated_hours}h)` : ''}
              </p>
            </div>
          )}

          {/* Map placeholder + Address */}
          {task.address && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="h-28 bg-gray-100 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-gray-300" />
              </div>
              <div className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{task.address}</p>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          )}

          {/* Rate */}
          <div className="bg-white rounded-2xl border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Self-Set Hourly</p>
              </div>
              <button className="ml-auto p-1">
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Hourly task earnings:</span>
              <span className="font-bold text-gray-900 text-lg">${rate}/hr</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="bg-white rounded-2xl border p-4">
              <p className="font-bold text-gray-900 mb-2">Details:</p>
              <p className="text-sm text-gray-600">{task.description}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3 pt-2">
            {canInvoice && (
              <button onClick={onCreateInvoice}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 transition-colors"
              >
                Create Invoice
              </button>
            )}
            {task.status === 'posted' && (
              <button onClick={onAccept}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700"
              >Accept Task</button>
            )}
            {canCancel && (
              <div className="flex gap-3">
                <button onClick={onReschedule}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-2xl font-medium hover:bg-gray-50"
                >Reschedule</button>
                <button onClick={onCancel}
                  className="flex-1 py-3 border border-red-200 text-red-600 rounded-2xl font-medium hover:bg-red-50"
                >Cancel Task</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p>Chat with {task.client_name||'client'}</p>
        </div>
      )}
    </div>
  );
}

// ─── Create Invoice Screen ────────────────────────────────────────────────────
function CreateInvoiceScreen({ task, onBack, onSubmitted }) {
  const [form, setForm] = useState({
    hours: Math.floor(task.estimated_hours || 1),
    minutes: 0,
    materials: 0,
    materialsDesc: '',
    closingMessage: "Thanks for hiring me for your task! If you enjoyed my work, please leave a review.",
    ongoingJob: false,
    clientRating: 0,
    clientComment: '',
    taskComment: '',
  });
  const [step, setStep] = useState('form'); // 'form' | 'preview'
  const [submitting, setSubmitting] = useState(false);

  const rate = task.provider_hourly_rate || task.total_price / Math.max(task.estimated_hours||1,1) || 0;
  const hoursWorked = form.hours + form.minutes / 60;
  const laborCost = Math.round(rate * hoursWorked * 100) / 100;
  const totalEarnings = laborCost + (form.materials || 0);

  const formatTime = () => {
    const h = form.hours;
    const m = form.minutes;
    return `${h}:${m.toString().padStart(2,'0')}`;
  };

  const minuteOptions = [0, 15, 30, 45];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const taskId = task.task_id || task.booking_id;
      await api.createProviderInvoice({
        booking_id: taskId,
        hours_worked: hoursWorked,
        materials_cost: form.materials || 0,
        materials_description: form.materialsDesc,
        closing_message: form.closingMessage,
        ongoing_job: form.ongoingJob,
        notes: form.taskComment,
        client_review_rating: form.clientRating > 0 ? form.clientRating : null,
        client_review_comment: form.clientComment,
      });
      onSubmitted();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const clientName = task.client_name || task.client_info?.name || 'Client';
  const clientInitials = clientName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

  if (step === 'preview') {
    return (
      <div className="max-w-lg mx-auto space-y-0">
        <button onClick={() => setStep('form')} className="flex items-center gap-2 text-gray-600 mb-4 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Invoice Preview</h2>
        <div className="bg-white rounded-2xl border divide-y">
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600">Client</span>
            <span className="font-bold text-gray-900">{clientName.split(' ')[0]} {(clientName.split(' ')[1]||'').charAt(0)}.</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600">Hours Worked</span>
            <span className="font-bold text-green-600">{formatTime()}</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600">Materials/Expenses</span>
            <span className="font-bold text-green-600">${(form.materials||0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600">Hourly Task Earnings:</span>
            <span className="font-bold text-gray-900">${laborCost.toFixed(2)}</span>
          </div>
          {form.closingMessage && (
            <button className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
              <div>
                <p className="text-gray-600">Closing Message</p>
                <p className="text-sm text-gray-400 truncate max-w-xs">{form.closingMessage}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          )}
          <div className="flex justify-between items-center p-4">
            <span className="text-gray-600">Ongoing job</span>
            <div className={`w-11 h-6 rounded-full ${form.ongoingJob ? 'bg-green-500' : 'bg-gray-300'} relative cursor-pointer`}
              onClick={() => setForm(f=>({...f, ongoingJob:!f.ongoingJob}))}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ongoingJob?'translate-x-5':'translate-x-0.5'}`}/>
            </div>
          </div>
          <div className="p-4 bg-gray-50">
            <div className="flex justify-between">
              <span className="font-bold text-gray-900">Total (your earnings)</span>
              <span className="font-bold text-green-600 text-lg">${totalEarnings.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Platform fee is not included — this is what you earn</p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full mt-4 py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : 'Submit Invoice'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <h2 className="text-xl font-bold text-gray-900 text-center">Submit Invoice</h2>

      <div className="bg-white rounded-2xl border divide-y">
        {/* Client */}
        <div className="flex justify-between items-center p-4">
          <span className="text-gray-600">Client</span>
          <span className="font-bold text-gray-900">
            {clientName.split(' ')[0]} {(clientName.split(' ')[1]||'').charAt(0)}.
          </span>
        </div>

        {/* Hours */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600">Hours Worked</span>
            <span className="font-bold text-green-600 text-xl">{formatTime()}</span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Hours</label>
              <input type="number" min="0" max="24" value={form.hours}
                onChange={e => setForm(f=>({...f, hours:parseInt(e.target.value)||0}))}
                className="w-full px-3 py-2.5 border rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Minutes</label>
              <select value={form.minutes} onChange={e => setForm(f=>({...f, minutes:parseInt(e.target.value)}))}
                className="w-full px-3 py-2.5 border rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                {minuteOptions.map(m => <option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2 bg-gray-50 rounded-xl p-2 text-center">
            <span className="text-xs text-gray-500">At ${rate}/hr → </span>
            <span className="text-sm font-bold text-green-600">${laborCost.toFixed(2)} labor</span>
          </div>
        </div>

        {/* Materials */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600">Expenses / Materials</span>
            <span className="font-bold text-green-600">${(form.materials||0).toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <input type="number" min="0" step="0.01" placeholder="0.00"
              value={form.materials||''} onChange={e => setForm(f=>({...f, materials:parseFloat(e.target.value)||0}))}
              className="w-28 px-3 py-2 border rounded-xl text-right font-bold focus:ring-2 focus:ring-green-500 outline-none"
            />
            <input type="text" placeholder="Description (optional)"
              value={form.materialsDesc} onChange={e => setForm(f=>({...f, materialsDesc:e.target.value}))}
              className="flex-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
        </div>

        {/* Closing message */}
        <div className="p-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Closing Message</label>
          <textarea value={form.closingMessage} onChange={e => setForm(f=>({...f, closingMessage:e.target.value}))}
            className="w-full px-3 py-2 border rounded-xl text-sm h-20 resize-none focus:ring-2 focus:ring-green-500 outline-none"
            placeholder="Thank your client..."
          />
        </div>

        {/* Task comment */}
        <div className="p-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Comment on Task</label>
          <textarea value={form.taskComment} onChange={e => setForm(f=>({...f, taskComment:e.target.value}))}
            className="w-full px-3 py-2 border rounded-xl text-sm h-16 resize-none focus:ring-2 focus:ring-green-500 outline-none"
            placeholder="Notes about this task..."
          />
        </div>

        {/* Rate client */}
        <div className="p-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Rate this Client</label>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setForm(f=>({...f, clientRating:s}))}
                className="text-2xl transition-transform hover:scale-110"
              >
                <Star className={`w-7 h-7 ${s<=form.clientRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}/>
              </button>
            ))}
          </div>
          {form.clientRating > 0 && (
            <textarea value={form.clientComment} onChange={e => setForm(f=>({...f,clientComment:e.target.value}))}
              className="w-full mt-2 px-3 py-2 border rounded-xl text-sm h-16 resize-none focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Leave a comment about this client..."
            />
          )}
        </div>

        {/* Ongoing */}
        <div className="flex justify-between items-center p-4">
          <div>
            <p className="font-medium text-gray-900">Ongoing job</p>
            <p className="text-xs text-gray-400">This task will continue in future sessions</p>
          </div>
          <button onClick={() => setForm(f=>({...f, ongoingJob:!f.ongoingJob}))}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.ongoingJob ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ongoingJob?'translate-x-5':'translate-x-0.5'}`}/>
          </button>
        </div>
      </div>

      <div className="bg-green-50 rounded-2xl p-4 flex justify-between items-center">
        <span className="font-bold text-gray-900">Your earnings</span>
        <span className="font-bold text-green-600 text-xl">${totalEarnings.toFixed(2)}</span>
      </div>

      <button onClick={() => setStep('preview')}
        className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700"
      >Preview</button>
    </div>
  );
}

// ─── Reschedule Screen ────────────────────────────────────────────────────────
function RescheduleScreen({ task, onBack, onDone }) {
  const [newDate, setNewDate] = useState(task.date || '');
  const [newTime, setNewTime] = useState(task.time || '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newDate || !newTime) return alert('Please select date and time');
    setSaving(true);
    try {
      await api.rescheduleTask(task.task_id||task.booking_id, { new_date: newDate, new_time: newTime, reason });
      onDone();
    } catch { alert('Could not reschedule task'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <h2 className="text-xl font-bold text-gray-900">Propose New Time</h2>
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">New Date</label>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">New Time</label>
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Reason (optional)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl h-20 resize-none focus:ring-2 focus:ring-green-500 outline-none text-sm"
            placeholder="Explain why you need to reschedule..."
          />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Sending...' : 'Send Reschedule Request'}
        </button>
      </div>
    </div>
  );
}

// ─── Cancel Task Screen ───────────────────────────────────────────────────────
function CancelTaskScreen({ task, onBack, onDone }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const reasons = [
    'Emergency came up', 'Client unresponsive', 'Scheduling conflict',
    'Health issue', 'Equipment problem', 'Task beyond my skills', 'Other',
  ];

  const handleCancel = async () => {
    if (!reason) return alert('Please select a reason');
    setSaving(true);
    try {
      await api.cancelTaskByProvider(task.task_id||task.booking_id, { reason, details });
      onDone();
    } catch { alert('Could not cancel task'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <h2 className="text-xl font-bold text-gray-900">Cancel Task</h2>
      <p className="text-sm text-gray-500">Please let the client know why you're cancelling.</p>
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        {reasons.map(r => (
          <button key={r} onClick={() => setReason(r)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              reason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >{r}</button>
        ))}
        <textarea value={details} onChange={e => setDetails(e.target.value)}
          className="w-full px-4 py-3 border rounded-xl text-sm h-20 resize-none focus:ring-2 focus:ring-red-400 outline-none"
          placeholder="Additional details (optional)..."
        />
        <button onClick={handleCancel} disabled={saving || !reason}
          className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Cancelling...' : 'Confirm Cancellation'}
        </button>
      </div>
    </div>
  );
}

// Provider Invoices Content
function ProviderInvoicesContent({ tasks }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Get completed tasks for invoice creation
  const completedTasks = tasks.filter(t => 
    t.status === 'completed' || t.status === 'completed_pending_payment'
  );

  return (
    <div className="max-w-2xl mx-auto">
      <ProviderInvoiceList 
        onCreateNew={() => setShowCreateModal(true)} 
      />
      
      <InvoiceCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        bookings={completedTasks}
        onCreated={() => setShowCreateModal(false)}
      />
    </div>
  );
}

// Provider Calendar Content
function ProviderCalendarContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);
  const [addForm, setAddForm] = useState({ start_time: '09:00', end_time: '17:00', day_of_week: new Date().getDay() });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { loadSlots(); }, []);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const res = await api.getAvailability();
      const data = res?.data || res;
      setSlots(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading availability:', e);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8AM–8PM

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };
  const weekDates = getWeekDates();

  const formatHour = (h) => `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;

  const isSlotActive = (dayOfWeek, hour) => {
    return slots.some(s => {
      if (s.day_of_week !== dayOfWeek) return false;
      const sh = parseInt(s.start_time?.split(':')[0] || '0');
      const eh = parseInt(s.end_time?.split(':')[0] || '0');
      return hour >= sh && hour < eh;
    });
  };

  const getSlotForTime = (dayOfWeek, hour) => {
    return slots.find(s => {
      if (s.day_of_week !== dayOfWeek) return false;
      const sh = parseInt(s.start_time?.split(':')[0] || '0');
      const eh = parseInt(s.end_time?.split(':')[0] || '0');
      return hour >= sh && hour < eh;
    });
  };

  const handleTimeClick = (date, hour) => {
    const dow = date.getDay();
    const existing = getSlotForTime(dow, hour);
    if (existing) return; // already booked
    const endH = Math.min(hour + 4, 20);
    setAddForm({
      day_of_week: dow,
      start_time: `${String(hour).padStart(2,'0')}:00`,
      end_time: `${String(endH).padStart(2,'0')}:00`,
    });
    setSelectedHour(hour);
    setShowAddModal(true);
  };

  const handleDeleteSlot = async (slot) => {
    setDeletingId(slot.slot_id);
    try {
      await api.deleteAvailabilitySlot(slot.slot_id);
      await loadSlots();
    } catch (e) {
      alert('Could not delete slot');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveSlot = async () => {
    setSaving(true);
    try {
      await api.addAvailability(addForm);
      setShowAddModal(false);
      await loadSlots();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not save availability');
    } finally {
      setSaving(false);
    }
  };

  const selectedDow = selectedDate.getDay();

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Set Availability</h3>
          <button className="p-2 hover:bg-gray-100 rounded-full" title="Tap a time slot to add availability">
            <HelpCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Week Selector */}
        <div className="flex border-b">
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const isSel = date.toDateString() === selectedDate.toDateString();
            const hasSlotsDay = slots.some(s => s.day_of_week === date.getDay());
            return (
              <button key={idx} onClick={() => setSelectedDate(date)}
                className={`flex-1 py-3 text-center transition-colors relative ${
                  isSel ? 'bg-green-600 text-white'
                    : isToday ? 'bg-green-50 text-green-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <p className="text-xs font-medium">{days[date.getDay()]}</p>
                <p className={`text-base font-bold ${isSel ? 'text-white' : ''}`}>{date.getDate()}</p>
                {hasSlotsDay && !isSel && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Time slots grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {hours.map(hour => {
              const active = isSlotActive(selectedDow, hour);
              const slot = getSlotForTime(selectedDow, hour);
              return (
                <div key={hour}
                  onClick={() => active ? handleDeleteSlot(slot) : handleTimeClick(selectedDate, hour)}
                  className={`flex items-center px-4 py-3 cursor-pointer transition-colors group ${
                    active ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-16 text-sm font-medium ${active ? 'text-green-700' : 'text-gray-500'}`}>
                    {formatHour(hour)}
                  </span>
                  {active ? (
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex-1 h-6 bg-green-200 rounded-full mx-3 flex items-center px-3">
                        <span className="text-xs text-green-700 font-medium">Available</span>
                      </div>
                      {deletingId === slot?.slot_id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 h-px bg-gray-100 mx-3" />
                  )}
                  {!active && (
                    <Plus className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Existing slots summary */}
      {slots.length > 0 && (
        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Your Weekly Schedule</h4>
          <div className="space-y-2">
            {days.map((day, dow) => {
              const daySlots = slots.filter(s => s.day_of_week === dow);
              if (daySlots.length === 0) return null;
              return (
                <div key={dow} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-medium text-gray-500">{day}</span>
                  <div className="flex flex-wrap gap-1">
                    {daySlots.map(s => (
                      <div key={s.slot_id} className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        <span>{s.start_time} – {s.end_time}</span>
                        <button onClick={() => handleDeleteSlot(s)} className="hover:text-red-600 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Availability Button */}
      <button onClick={() => { setAddForm({ day_of_week: selectedDate.getDay(), start_time: '09:00', end_time: '17:00' }); setShowAddModal(true); }}
        className="w-full py-4 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Availability
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Add Availability</h3>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Day of Week</label>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => (
                  <button key={i} onClick={() => setAddForm(f => ({ ...f, day_of_week: i }))}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      addForm.day_of_week === i ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Start Time</label>
                <input type="time" value={addForm.start_time}
                  onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">End Time</label>
                <input type="time" value={addForm.end_time}
                  onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
              >Cancel</button>
              <button onClick={handleSaveSlot} disabled={saving}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Provider Performance Content
function ProviderPerformanceContent({ stats }) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Performance</h2>

      {/* Earnings */}
      <div className="bg-white rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Earnings</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">March total</p>
            <p className="text-2xl font-bold text-green-600">${stats?.stats?.total_earnings || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Task count</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.stats?.total_completed_tasks || 0}</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Reviews</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-center gap-4">
          <p className="text-3xl font-bold text-gray-900">{stats?.stats?.average_rating || '5.0'}/5</p>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(i => (
              <Star 
                key={i} 
                className={`w-5 h-5 ${i <= Math.floor(stats?.stats?.average_rating || 5) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
              />
            ))}
          </div>
          <span className="text-gray-500">({stats?.stats?.total_reviews || 0} reviews)</span>
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-white rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Analytics</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 mb-4">Insights on your performance and how you stack up to other Taskers in your city.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Average search position</p>
            <p className="text-2xl font-bold text-green-600">{stats?.analytics?.search_position || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">You've shown more than</p>
            <p className="text-2xl font-bold text-green-600">{stats?.analytics?.visibility || '0'}%</p>
          </div>
        </div>
      </div>

      {/* Skills & Rates */}
      <div className="bg-white rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Skills & rates</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Activated skills:</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.profile?.skills?.length || 0}</p>
        </div>
      </div>

      {/* Elite Status */}
      <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600" />
            Elite status
          </h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 mb-3">Unlock higher earnings and priority access to tasks.</p>
        <div className="bg-white rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Elite progress</span>
            <span className="text-sm font-medium text-green-600">2/4 milestones</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-green-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Provider Profile Content
// ─── Tasker Profile Editor ────────────────────────────────────────────────────

// ─── Location Screen ─────────────────────────────────────────────────────────
function LocationScreen({ profile, onBack, onSaved }) {
  const [tab, setTab] = useState('map'); // 'map' | 'cities' | 'radius'
  const [radius, setRadius] = useState(profile?.service_radius_km || 25);
  const [cities, setCities] = useState(profile?.service_cities || []);
  const [zipCodes, setZipCodes] = useState(profile?.service_zip_codes || []);
  const [cityInput, setCityInput] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const [mapCenter, setMapCenter] = useState(
    profile?.latitude && profile?.longitude
      ? { lat: profile.latitude, lng: profile.longitude }
      : { lat: 41.8781, lng: -87.6298 } // Chicago default
  );

  // Load Google Maps
  React.useEffect(() => {
    if (tab !== 'map') return;
    if (window.google && window.google.maps) { initMap(); return; }

    const existingScript = document.getElementById('gmaps-script');
    if (existingScript) {
      existingScript.addEventListener('load', initMap);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmaps-script';
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyD-dummy&libraries=drawing';
    script.async = true;
    script.onerror = () => setMapLoaded(false);
    script.onload = initMap;
    document.head.appendChild(script);
  }, [tab]);

  const initMap = () => {
    if (!mapRef.current || !window.google) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 11,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
    });
    mapInstanceRef.current = map;

    // Draggable marker for home base
    const marker = new window.google.maps.Marker({
      position: mapCenter,
      map,
      draggable: true,
      title: 'Your location',
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#1a6b3c', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    });
    markerRef.current = marker;

    // Circle showing service radius
    const circle = new window.google.maps.Circle({
      strokeColor: '#1a6b3c',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#1a6b3c',
      fillOpacity: 0.15,
      map,
      center: mapCenter,
      radius: radius * 1000,
    });
    circleRef.current = circle;

    marker.addListener('dragend', (e) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMapCenter(pos);
      circle.setCenter(pos);
    });

    setMapLoaded(true);
  };

  // Update circle radius when slider changes
  React.useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius * 1000);
    }
  }, [radius]);

  const addCity = () => {
    const t = cityInput.trim();
    if (!t || cities.includes(t)) return;
    setCities(prev => [...prev, t]);
    setCityInput('');
  };

  const addZip = () => {
    const t = zipInput.trim();
    if (!t || zipCodes.includes(t)) return;
    setZipCodes(prev => [...prev, t]);
    setZipInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        service_radius_km: radius,
        service_cities: cities,
        service_zip_codes: zipCodes,
      };
      if (mapCenter) {
        updates.latitude = mapCenter.lat;
        updates.longitude = mapCenter.lng;
      }
      await api.updateProfile(updates);
      setSavedOk(true);
      setTimeout(() => { setSavedOk(false); onSaved(); }, 1200);
    } catch (e) {
      alert('Could not save location');
    } finally {
      setSaving(false);
    }
  };

  const POPULAR_CITIES = [
    'Chicago', 'Evanston', 'Oak Park', 'Naperville', 'Schaumburg',
    'Arlington Heights', 'Des Plaines', 'Northbrook', 'Glenview',
    'Wheeling', 'Buffalo Grove', 'Highland Park', 'Skokie',
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 flex-1">My location</h2>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '...' : savedOk ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white flex-shrink-0">
        {[
          { id: 'map', label: '🗺 Map' },
          { id: 'cities', label: '🏙 Cities' },
          { id: 'radius', label: '📍 Radius' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* MAP TAB */}
      {tab === 'map' && (
        <div className="flex-1 flex flex-col">
          {/* Location permission banner */}
          <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-700">
              Tap here to enable location services and see how far you are from your task
            </p>
          </div>

          {/* Map container */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full min-h-64" />

            {/* Fallback if no Google Maps key */}
            {!window.google && (
              <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-10 h-10 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-1">Set your service area</p>
                  <p className="text-sm text-gray-500">Interactive map requires Google Maps API key. Use Cities or Radius tabs below.</p>
                </div>
                {mapCenter && (
                  <div className="bg-white rounded-xl p-3 text-sm text-gray-600 border">
                    📍 Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Radius slider at bottom */}
          <div className="bg-white border-t p-4 flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-gray-900">Service radius</span>
              <span className="font-bold text-green-600 text-lg">{radius} km</span>
            </div>
            <input type="range" min="5" max="100" step="5" value={radius}
              onChange={e => setRadius(parseInt(e.target.value))}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 km</span><span>25 km</span><span>50 km</span><span>100 km</span>
            </div>
          </div>
        </div>
      )}

      {/* CITIES TAB */}
      {tab === 'cities' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Selected cities */}
          {cities.length > 0 && (
            <div className="bg-white rounded-2xl border p-4">
              <p className="font-semibold text-gray-900 mb-3">Your service cities</p>
              <div className="flex flex-wrap gap-2">
                {cities.map(city => (
                  <div key={city} className="flex items-center gap-1.5 bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    {city}
                    <button onClick={() => setCities(c => c.filter(x => x !== city))}
                      className="ml-0.5 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add city */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <p className="font-semibold text-gray-900">Add a city</p>
            <div className="flex gap-2">
              <input type="text" value={cityInput} onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCity()}
                placeholder="e.g. Chicago"
                className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
              <button onClick={addCity}
                className="px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 text-sm"
              >Add</button>
            </div>

            {/* Popular cities */}
            <p className="text-xs text-gray-400 font-medium">Popular nearby cities:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_CITIES.filter(c => !cities.includes(c)).map(city => (
                <button key={city} onClick={() => { if (!cities.includes(city)) setCities(c => [...c, city]); }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-green-100 hover:text-green-700 transition-colors"
                >{city}</button>
              ))}
            </div>
          </div>

          {/* ZIP codes */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <p className="font-semibold text-gray-900">ZIP codes <span className="text-gray-400 font-normal">(optional)</span></p>
            {zipCodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {zipCodes.map(z => (
                  <div key={z} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {z}
                    <button onClick={() => setZipCodes(zs => zs.filter(x => x !== z))}>
                      <X className="w-3 h-3 ml-0.5 hover:text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={zipInput} onChange={e => setZipInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addZip()}
                placeholder="e.g. 60601"
                maxLength={10}
                className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
              <button onClick={addZip}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 text-sm"
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* RADIUS TAB */}
      {tab === 'radius' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="bg-white rounded-2xl border p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-lg">Service Radius</p>
                <p className="text-sm text-gray-500">How far you're willing to travel</p>
              </div>
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{radius}</p>
                  <p className="text-xs text-gray-500">km</p>
                </div>
              </div>
            </div>

            <input type="range" min="5" max="100" step="5" value={radius}
              onChange={e => setRadius(parseInt(e.target.value))}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>5 km</span><span>25 km</span><span>50 km</span><span>100 km</span>
            </div>

            {/* Preset radius options */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 75].map(r => (
                <button key={r} onClick={() => setRadius(r)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    radius === r ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >{r} km</button>
              ))}
            </div>

            {/* Visual estimate */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">What this covers:</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {radius <= 10 && 'Your immediate neighborhood'}
                {radius > 10 && radius <= 25 && 'Your city and nearby suburbs'}
                {radius > 25 && radius <= 50 && 'Multiple cities and surrounding area'}
                {radius > 50 && 'Wide metro area coverage'}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4 text-green-600" />
                ~{Math.round(radius * 0.621)} mile radius
              </div>
            </div>
          </div>

          {/* Current location indicator */}
          {mapCenter && (
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Home base</p>
                  <p className="text-xs text-gray-500">
                    {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                  </p>
                </div>
                <button onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos => {
                      setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    });
                  }
                }} className="ml-auto text-xs text-green-600 font-medium hover:underline">
                  Use my location
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skills Categories (TaskRabbit-style) ─────────────────────────────────────
const SKILL_CATEGORIES = [
  {
    id: 'assembly', label: 'Assembly', icon: '🔧',
    skills: [
      { id: 'furniture_assembly', label: 'Furniture Assembly', desc: 'Assemble flat-pack and ready-to-assemble furniture.' },
      { id: 'ikea_assembly', label: 'IKEA Assembly', desc: 'Specialized IKEA furniture assembly.' },
      { id: 'shelving', label: 'Shelving & Storage', desc: 'Install shelves, racks, and storage solutions.' },
    ]
  },
  {
    id: 'cleaning', label: 'Cleaning', icon: '🧹',
    skills: [
      { id: 'home_cleaning', label: 'Home Cleaning', desc: 'General house cleaning and tidying.' },
      { id: 'deep_cleaning', label: 'Deep Cleaning', desc: 'Thorough deep cleaning of all areas.' },
      { id: 'carpet_cleaning', label: 'Carpet Cleaning', desc: 'Professional carpet and rug cleaning.' },
    ]
  },
  {
    id: 'home_improvements', label: 'Home Improvements', icon: '🏠',
    skills: [
      { id: 'tv_mounting', label: 'TV Mounting', desc: 'Mount TVs on any wall type.' },
      { id: 'appliance_installation', label: 'Appliance Installation & Repairs', desc: 'Install and repair home appliances.' },
      { id: 'door_repair', label: 'Door, Cabinet & Furniture Repair', desc: 'Fix doors, cabinets, and furniture.' },
      { id: 'plumbing', label: 'Plumbing', desc: 'Fix leaks, install fixtures, and more.' },
      { id: 'electrical', label: 'Electrical', desc: 'Light fixtures, outlets, switches.' },
      { id: 'smart_home', label: 'Smart Home Setup', desc: 'Install and configure smart devices.' },
    ]
  },
  {
    id: 'moving', label: 'Moving', icon: '📦',
    skills: [
      { id: 'moving_help', label: 'Moving Help', desc: 'Help with local moves and heavy lifting.' },
      { id: 'packing', label: 'Packing & Unpacking', desc: 'Pack belongings safely for moving.' },
    ]
  },
  {
    id: 'outdoor', label: 'Outdoor Maintenance', icon: '🌳',
    skills: [
      { id: 'landscaping', label: 'Landscaping', desc: 'Lawn care, planting, and yard work.' },
      { id: 'pressure_washing', label: 'Pressure Washing', desc: 'Clean driveways, decks, and siding.' },
      { id: 'snow_removal', label: 'Snow Removal', desc: 'Shovel and clear snow.' },
    ]
  },
  {
    id: 'painting', label: 'Painting', icon: '🎨',
    skills: [
      { id: 'interior_painting', label: 'Interior Painting', desc: 'Paint walls, ceilings, and trim.' },
      { id: 'exterior_painting', label: 'Exterior Painting', desc: 'Paint siding, trim, and doors.' },
      { id: 'wallpapering', label: 'Wallpapering', desc: 'Apply wallpaper to living spaces.' },
    ]
  },
  {
    id: 'personal_assistance', label: 'Personal Assistance', icon: '🤝',
    skills: [
      { id: 'errands', label: 'Errands & Shopping', desc: 'Run errands and pick up groceries.' },
      { id: 'event_help', label: 'Event Help', desc: 'Help with setup and cleanup for events.' },
    ]
  },
];

// ─── Skill Detail Modal ────────────────────────────────────────────────────────
function SkillDetailModal({ skill, profile, onClose, onSaved }) {
  const existingSkill = (profile?.skills || []).find(s => s.id === skill.id || s === skill.id || s === skill.label);
  const [rate, setRate] = useState(existingSkill?.hourly_rate || profile?.hourly_rate || 37);
  const [bio, setBio] = useState(existingSkill?.bio || profile?.bio || '');
  const [twoHourMin, setTwoHourMin] = useState(existingSkill?.two_hour_minimum || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update profile with this skill's hourly rate and bio
      const currentSkills = (profile?.skills || []).filter(s => {
        if (typeof s === 'object') return s.id !== skill.id;
        return s !== skill.id && s !== skill.label;
      });
      const newSkillObj = { id: skill.id, label: skill.label, hourly_rate: rate, bio, two_hour_minimum: twoHourMin };
      await api.updateProfile({
        skills: [...currentSkills, newSkillObj],
        hourly_rate: rate,
        bio: bio || profile?.bio,
      });
      onSaved();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b sticky top-0 bg-white">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 flex-1">{skill.label}</h2>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Skills & Experience */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Skills & Experience</h3>
          <p className="text-sm text-gray-500 mb-3">Let clients know what skills and tools you have and why you're the best Tasker for the job.</p>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl h-32 resize-none focus:ring-2 focus:ring-green-500 outline-none text-sm"
            placeholder={`Hi! I specialize in ${skill.label}. Fast, reliable, and professional service.`}
            maxLength={500}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Tip: Mention your tools, experience level, and specialties</span>
            <span>{bio.length}/500</span>
          </div>
        </div>

        {/* Earning Structure */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Earning Structures</h3>
          <p className="text-sm text-gray-500 mb-4">For this skill your earnings will be structured at a Self-Set rate, determined by you.</p>

          <div className="border-2 border-yellow-400 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">Self-Set Hourly</span>
                  <HelpCircle className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xs text-gray-500">This structure offers an hourly rate determined by you.</p>
              </div>
            </div>

            {/* Rate selector */}
            <div className="border rounded-xl px-4 py-3 flex items-center justify-between bg-white mt-3">
              <span className="text-xl font-bold text-gray-900">${rate} per hour</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            {/* Rate slider */}
            <div className="mt-3 space-y-2">
              <input
                type="range" min="15" max="200" step="1"
                value={rate}
                onChange={e => setRate(parseInt(e.target.value))}
                className="w-full accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>$15</span><span>$50</span><span>$100</span><span>$150</span><span>$200</span>
              </div>
            </div>
          </div>
        </div>

        {/* Earning Preferences */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Earning Preferences</h3>
          <p className="text-sm text-gray-500 mb-4">Tell us more about your strengths and preferences related to this skill.</p>
          <div className="border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Two Hour Minimum</span>
              <span className="text-xs text-gray-400">(Optional)</span>
              <HelpCircle className="w-4 h-4 text-green-600" />
            </div>
            <button
              onClick={() => setTwoHourMin(!twoHourMin)}
              className={`relative w-12 h-6 rounded-full transition-colors ${twoHourMin ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoHourMin ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 border-t bg-white sticky bottom-0">
        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Add Skills Modal ──────────────────────────────────────────────────────────
function AddSkillsModal({ profile, onClose, onSaved }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);

  const currentSkillIds = (profile?.skills || []).map(s => typeof s === 'object' ? s.id : s);

  if (selectedSkill) {
    return (
      <SkillDetailModal
        skill={selectedSkill}
        profile={profile}
        onClose={() => setSelectedSkill(null)}
        onSaved={() => { setSelectedSkill(null); onSaved(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold text-gray-900">Add skills</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <X className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {SKILL_CATEGORIES.map(cat => (
          <div key={cat.id} className="border-b">
            <button
              onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 text-left"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="font-semibold text-gray-900 flex-1">{cat.label}</span>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedCat === cat.id ? 'rotate-90' : ''}`} />
            </button>

            {expandedCat === cat.id && (
              <div className="px-4 pb-4 space-y-3">
                {cat.skills.map(skill => {
                  const hasSkill = currentSkillIds.includes(skill.id) || currentSkillIds.includes(skill.label);
                  return (
                    <div key={skill.id}
                      onClick={() => !hasSkill && setSelectedSkill(skill)}
                      className={`rounded-2xl p-4 flex items-start justify-between gap-3 ${
                        hasSkill ? 'bg-green-50 border border-green-200' : 'bg-gray-100 cursor-pointer hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{skill.label}</p>
                        <p className="text-sm text-gray-600 mt-1">{skill.desc}</p>
                      </div>
                      {hasSkill ? (
                        <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Plus className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── My Skills Screen ──────────────────────────────────────────────────────────
function MySkillsScreen({ profile, onBack, onRefresh }) {
  const [showAddSkills, setShowAddSkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);

  // Normalize skills to objects
  const normalizedSkills = (profile?.skills || []).map(s => {
    if (typeof s === 'object' && s.id) return s;
    // Find in categories
    for (const cat of SKILL_CATEGORIES) {
      const found = cat.skills.find(sk => sk.id === s || sk.label === s);
      if (found) return { ...found, hourly_rate: profile?.hourly_rate || 37 };
    }
    return { id: s, label: s, hourly_rate: profile?.hourly_rate || 37 };
  });

  // Group by category
  const grouped = SKILL_CATEGORIES.map(cat => ({
    ...cat,
    mySkills: normalizedSkills.filter(s =>
      cat.skills.some(cs => cs.id === s.id || cs.label === s.label)
    )
  })).filter(cat => cat.mySkills.length > 0);

  if (selectedSkill) {
    return (
      <SkillDetailModal
        skill={selectedSkill}
        profile={profile}
        onClose={() => setSelectedSkill(null)}
        onSaved={() => { setSelectedSkill(null); onRefresh(); }}
      />
    );
  }

  if (showAddSkills) {
    return (
      <AddSkillsModal
        profile={profile}
        onClose={() => setShowAddSkills(false)}
        onSaved={() => { setShowAddSkills(false); onRefresh(); }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My skills</h2>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900 mb-1">No skills yet</p>
          <p className="text-sm text-gray-500 mb-5">Add your skills to start receiving tasks from clients.</p>
          <button onClick={() => setShowAddSkills(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700"
          >Add skills</button>
        </div>
      ) : (
        <>
          {grouped.map(cat => (
            <div key={cat.id} className="rounded-2xl overflow-hidden" style={{background: 'rgba(219,234,254,0.3)'}}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{cat.icon}</span>
                <span className="font-bold text-gray-900">{cat.label}</span>
              </div>
              <div className="space-y-2 px-3 pb-3">
                {cat.mySkills.map(skill => (
                  <button key={skill.id} onClick={() => setSelectedSkill(skill)}
                    className="w-full bg-white rounded-2xl p-4 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{skill.label}</p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <span className="bg-blue-700 text-white text-xs px-3 py-1 rounded font-medium">
                            ${skill.hourly_rate || profile?.hourly_rate || 37} PER HOUR
                          </span>
                          <span className="bg-blue-700 text-white text-xs px-3 py-1 rounded font-medium">
                            PARTNERS ON
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={() => setShowAddSkills(true)}
              className="flex items-center gap-2 text-green-600 font-semibold hover:underline"
            >
              <div className="w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              Add skills
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tasker Profile Editor (bio + rate + tools) ───────────────────────────────
function TaskerProfileEditor({ profile, onBack, onSaved }) {
  const [form, setForm] = useState({
    bio: profile?.bio || '',
    hourly_rate: profile?.hourly_rate || 37,
    experience_years: profile?.experience_years || 0,
    service_radius_km: profile?.service_radius_km || 25,
    tools_equipment: profile?.tools_equipment || [],
  });
  const [customTool, setCustomTool] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const TOOLS = ['Power drill','Ladder','Stud finder','Level','Vacuum','Pressure washer','Power saw','Soldering torch','Pipe wrench','Multimeter'];

  const toggleTool = (tool) => {
    setForm(f => ({
      ...f,
      tools_equipment: f.tools_equipment.includes(tool)
        ? f.tools_equipment.filter(t => t !== tool)
        : [...f.tools_equipment, tool]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile(form);
      setSavedOk(true);
      setTimeout(() => { setSavedOk(false); onSaved(); }, 1000);
    } catch (e) {
      alert('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <h2 className="text-xl font-bold text-gray-900">Tasker Profile</h2>

      {/* Bio */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Skills & Experience</h3>
        <p className="text-sm text-gray-500">Let clients know what skills and tools you have and why you're the best Tasker for the job.</p>
        <textarea
          value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          className="w-full px-4 py-3 border rounded-xl h-28 resize-none focus:ring-2 focus:ring-green-500 outline-none text-sm"
          placeholder="Describe your experience..."
          maxLength={500}
        />
        <p className="text-xs text-gray-400 text-right">{form.bio.length}/500</p>
      </div>

      {/* Rate */}
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Default Hourly Rate</h3>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl font-bold text-gray-900">${form.hourly_rate}</span>
          <span className="text-gray-500">per hour</span>
        </div>
        <input type="range" min="15" max="200" step="1"
          value={form.hourly_rate}
          onChange={e => setForm(f => ({ ...f, hourly_rate: parseInt(e.target.value) }))}
          className="w-full accent-green-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>$15</span><span>$50</span><span>$100</span><span>$150</span><span>$200</span>
        </div>
      </div>

      {/* Tools */}
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Tools & Equipment</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {TOOLS.map(tool => (
            <button key={tool} onClick={() => toggleTool(tool)}
              className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                form.tools_equipment.includes(tool)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-gray-200 text-gray-600 hover:border-green-400'
              }`}
            >{tool}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={customTool} onChange={e => setCustomTool(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customTool.trim()) { toggleTool(customTool.trim()); setCustomTool(''); } }}
            placeholder="Add custom tool..."
            className="flex-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
          <button onClick={() => { if (customTool.trim()) { toggleTool(customTool.trim()); setCustomTool(''); } }}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
          >Add</button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> 
          : savedOk ? <><Check className="w-5 h-5" /> Saved!</>
          : 'Save'}
      </button>
    </div>
  );
}

function ProviderProfileContent({ user, profile, onRefresh }) {
  const [activeSection, setActiveSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [myDocuments, setMyDocuments] = useState([]);
  const [payoutAccounts, setPayoutAccounts] = useState([]);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const [docsRes, payoutsRes] = await Promise.all([
        api.getMyDocuments().catch(() => ({ data: [] })),
        api.getPayoutAccounts().catch(() => ({ data: [] }))
      ]);
      setMyDocuments(Array.isArray(docsRes?.data) ? docsRes.data : []);
      setPayoutAccounts(Array.isArray(payoutsRes?.data) ? payoutsRes.data : []);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  const handleUpdateProfile = async (data) => {
    try {
      await api.updateProfile(data);
      onRefresh();
      setActiveSection(null);
      alert('Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Could not update profile');
    }
  };

  const handleUploadDocument = async (type, file) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await api.uploadDocument({
          document_type: type,
          file_data: reader.result
        });
        loadProfileData();
        alert('Document uploaded for verification!');
      } catch (error) {
        console.error('Error uploading document:', error);
        alert('Could not upload document');
      }
    };
    reader.readAsDataURL(file);
  };

  const menuItems = [
    { id: 'account', icon: User, label: 'Account details', description: 'Name, email, phone' },
    { id: 'my-skills', icon: Briefcase, label: 'My skills', description: 'Manage skills, rates & experience' },
    { id: 'location', icon: MapPin, label: 'My location', description: 'Service area & work zones' },
    { id: 'tasker-profile', icon: FileText, label: 'Tasker profile', description: 'Bio, tools, profile details' },
    { id: 'documents', icon: FileText, label: 'Verification documents', description: 'ID, certificates' },
    { id: 'calendar', icon: Calendar, label: 'Sync calendar', description: 'Google, Apple calendar' },
    { id: 'templates', icon: MessageSquare, label: 'Chat templates', description: 'Quick responses' },
    { id: 'promote', icon: Sparkles, label: 'Promote yourself', description: 'Boost your visibility' },
    { id: 'payments', icon: CreditCard, label: 'Payments', description: 'Payout accounts' },
    { id: 'invite', icon: Gift, label: 'Invite friends, earn cash', highlight: true, description: 'Share your code' },
    { id: 'support', icon: HelpCircle, label: 'Support', description: 'Get help' },
  ];

  // Account Details Section
  if (activeSection === 'account') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Account Details</h2>
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              defaultValue={user?.name}
              onChange={(e) => setEditData({...editData, name: e.target.value})}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full px-4 py-3 border rounded-xl bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              defaultValue={user?.phone}
              onChange={(e) => setEditData({...editData, phone: e.target.value})}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <button
            onClick={() => handleUpdateProfile(editData)}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // My Skills Section
  // Location Section
  if (activeSection === 'location') {
    return (
      <LocationScreen
        profile={profile}
        onBack={() => setActiveSection(null)}
        onSaved={() => { onRefresh(); setActiveSection(null); }}
      />
    );
  }

  // My Skills Section
  if (activeSection === 'my-skills') {
    return (
      <MySkillsScreen
        profile={profile}
        onBack={() => setActiveSection(null)}
        onRefresh={() => { onRefresh(); }}
      />
    );
  }

  // Tasker Profile Section
  if (activeSection === 'tasker-profile') {
    return (
      <TaskerProfileEditor
        profile={profile}
        onBack={() => setActiveSection(null)}
        onSaved={() => { onRefresh(); setActiveSection(null); }}
      />
    );
  }

  // Documents Section
  if (activeSection === 'documents') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Verification Documents</h2>
        
        {/* Upload New */}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Document</h3>
          <div className="grid grid-cols-2 gap-4">
            {['id_card', 'passport', 'drivers_license', 'insurance', 'certificate'].map(type => (
              <label key={type} className="flex flex-col items-center p-4 border-2 border-dashed rounded-xl hover:border-green-500 cursor-pointer">
                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleUploadDocument(type, e.target.files[0])}
                />
              </label>
            ))}
          </div>
        </div>

        {/* My Documents */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">My Documents</h3>
          </div>
          {myDocuments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No documents uploaded yet
            </div>
          ) : (
            <div className="divide-y">
              {myDocuments.map(doc => (
                <div key={doc.document_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{doc.document_type.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                    doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Payments Section
  if (activeSection === 'payments') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Payment Settings</h2>
        
        {/* Payout Accounts */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Payout Accounts</h3>
            <button className="text-sm text-green-600 font-medium">+ Add Account</button>
          </div>
          {payoutAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No payout accounts</p>
              <p className="text-sm mt-1">Add a bank account to receive payments</p>
            </div>
          ) : (
            <div className="divide-y">
              {payoutAccounts.map(acc => (
                <div key={acc.account_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{acc.bank_name || 'Bank Account'}</p>
                      <p className="text-sm text-gray-500">****{acc.account_number_last4}</p>
                    </div>
                  </div>
                  {acc.is_default && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Default</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout History Link */}
        <div className="bg-white rounded-2xl border p-4">
          <button className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Payout History</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  // Notifications Settings Section
  if (activeSection === 'notifications') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
        <div className="bg-white rounded-2xl border divide-y">
          {[
            { key: 'new_task', label: 'New task available', desc: 'When a new task matches your skills' },
            { key: 'task_update', label: 'Task status updates', desc: 'When your task status changes' },
            { key: 'new_message', label: 'New messages', desc: 'When a client sends you a message' },
            { key: 'payment', label: 'Payment received', desc: 'When you receive a payout' },
            { key: 'review', label: 'New review', desc: 'When a client leaves a review' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>
        <button
          onClick={() => setActiveSection(null)}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700"
        >
          Save Preferences
        </button>
      </div>
    );
  }

  // App Settings Section
  if (activeSection === 'app-settings') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">App Settings</h2>

        {/* Language */}
        <div className="bg-white rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Language</p>
                <p className="text-xs text-gray-500">Choose your preferred language</p>
              </div>
            </div>
            <LanguageSelector />
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-2xl border divide-y">
          {[
            { key: 'dark_mode', label: 'Dark mode', desc: 'Switch to dark theme', defaultOn: false },
            { key: 'location', label: 'Share location', desc: 'Required for nearby task matching', defaultOn: true },
            { key: 'sound', label: 'Sound effects', desc: 'Play sounds for notifications', defaultOn: true },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={item.defaultOn} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>

        {/* App Version */}
        <div className="bg-white rounded-2xl border p-4 text-center text-sm text-gray-500">
          HandyHub v1.0.0 · <span className="text-green-600 cursor-pointer">Check for updates</span>
        </div>
      </div>
    );
  }

  // Invite Section
  if (activeSection === 'invite') {
    const refCode = user?.user_id?.slice(-6).toUpperCase() || 'HANDY1';
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Invite Friends, Earn Cash</h2>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <Gift className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-900 mb-1">Earn $20 per referral</p>
          <p className="text-sm text-gray-600">Share your code. When your friend completes their first task, you both earn $20.</p>
        </div>
        <div className="bg-white rounded-2xl border p-6">
          <p className="text-sm text-gray-500 mb-2">Your referral code</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono text-xl font-bold text-green-600 tracking-widest text-center">
              {refCode}
            </div>
            <button
              onClick={() => { navigator.clipboard?.writeText(refCode); alert('Code copied!'); }}
              className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium"
            >
              Copy
            </button>
          </div>
        </div>
        <button
          onClick={() => { navigator.share?.({ title: 'Join HandyHub', text: `Use my code ${refCode} to get started on HandyHub!` }); }}
          className="w-full py-3 border-2 border-green-600 text-green-600 rounded-xl font-medium hover:bg-green-50"
        >
          Share Invite Link
        </button>
      </div>
    );
  }

  // Support Section
  if (activeSection === 'support') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Support</h2>
        <div className="bg-white rounded-2xl border divide-y">
          <a href="mailto:support@handyhub.com" className="flex items-center justify-between px-4 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Email Support</p>
                <p className="text-xs text-gray-500">support@handyhub.com</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </a>
          <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Live Chat</p>
                <p className="text-xs text-gray-500">Available Mon–Fri 9AM–6PM</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-gray-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">FAQ & Help Center</p>
                <p className="text-xs text-gray-500">Browse common questions</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-center">
          <p className="text-sm text-gray-500">Response time: usually within 2 hours</p>
        </div>
      </div>
    );
  }

  // Calendar Sync Section
  if (activeSection === 'calendar') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Sync Calendar</h2>
        <div className="bg-white rounded-2xl border divide-y">
          {[
            { name: 'Google Calendar', icon: '📅', desc: 'Sync with your Google account' },
            { name: 'Apple Calendar', icon: '🍎', desc: 'Sync with iCal / Apple Calendar' },
            { name: 'Outlook', icon: '📧', desc: 'Sync with Microsoft Outlook' },
          ].map(cal => (
            <div key={cal.name} className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cal.icon}</span>
                <div>
                  <p className="font-medium text-gray-900">{cal.name}</p>
                  <p className="text-xs text-gray-500">{cal.desc}</p>
                </div>
              </div>
              <button className="px-3 py-1.5 border rounded-lg text-sm text-green-600 font-medium hover:bg-green-50">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Chat Templates Section
  if (activeSection === 'templates') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Chat Templates</h2>
        <div className="bg-white rounded-2xl border divide-y">
          {[
            { title: 'On my way', text: 'Hi! I\'m on my way and will arrive in about 15 minutes.' },
            { title: 'Running late', text: 'Hi, I\'m running about 15–20 minutes late. Sorry for the inconvenience!' },
            { title: 'Completed', text: 'Hi! I\'ve completed the work. Please let me know if everything looks good.' },
            { title: 'Need access', text: 'Hi, I\'m at the location — could you open the door / provide access?' },
          ].map((tmpl, i) => (
            <div key={i} className="px-4 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-gray-900">{tmpl.title}</p>
                <button className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">{tmpl.text}</p>
            </div>
          ))}
        </div>
        <button className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" />
          Add Template
        </button>
      </div>
    );
  }

  // Promote Section
  if (activeSection === 'promote') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Promote Yourself</h2>
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 text-white">
          <Sparkles className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-xl font-bold mb-2">Boost Your Profile</h3>
          <p className="text-green-100 text-sm">Appear at the top of search results and get more bookings.</p>
        </div>
        <div className="bg-white rounded-2xl border divide-y">
          {[
            { name: 'Basic Boost', price: '$9.99/week', desc: 'Show in top 10 results in your area' },
            { name: 'Pro Boost', price: '$19.99/week', desc: 'Featured badge + top 3 results' },
            { name: 'Elite Boost', price: '$39.99/week', desc: 'Homepage feature + push to all nearby clients' },
          ].map(plan => (
            <div key={plan.name} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-medium text-gray-900">{plan.name}</p>
                <p className="text-xs text-gray-500">{plan.desc}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">{plan.price}</p>
                <button className="text-xs text-green-600 font-medium hover:underline mt-0.5">Activate</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Main Profile Menu
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Profile</h2>

      {/* User Info Card */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{user?.name}</h3>
            <p className="text-gray-500">{user?.email}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full mt-1">
                <Check className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
          Account Information
        </p>
        <div className="divide-y">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                item.highlight ? 'bg-green-50' : ''
              }`}
              data-testid={`profile-menu-${item.id}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${item.highlight ? 'text-green-600' : 'text-gray-600'}`} />
                <div className="text-left">
                  <span className={`font-medium block ${item.highlight ? 'text-green-700' : 'text-gray-900'}`}>
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="text-xs text-gray-500">{item.description}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
          Settings
        </p>
        <div className="divide-y">
          <button
            onClick={() => setActiveSection('notifications')}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Notifications</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => setActiveSection('app-settings')}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">App settings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== CLIENT DASHBOARD ====================
function ClientDashboard({ user, onLogout }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('home');
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, bookingsRes] = await Promise.all([
        api.getServices().catch(() => ({ data: [] })),
        api.getBookings().catch(() => ({ data: [] }))
      ]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : (Array.isArray(servicesRes) ? servicesRes : []));
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : (Array.isArray(bookingsRes) ? bookingsRes : []));
    } catch (error) {
      console.error('Error loading client data:', error);
    }
  };

  const menuItems = [
    { id: 'home', icon: Home, labelKey: 'nav_home' },
    { id: 'tasks', icon: ClipboardList, labelKey: 'nav_tasks' },
    { id: 'profile', icon: User, labelKey: 'nav_profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            HandyHub
          </h1>
          <div className="flex items-center gap-2">
            <LanguageSelector className="mr-1" />
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Search className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={() => setShowChat(true)}
              className="p-2 hover:bg-gray-100 rounded-full"
              data-testid="client-chat-btn"
            >
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </button>
            <NotificationBell onClick={() => setShowNotifications(true)} />
          </div>
        </div>
        
        {/* Location */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-600" />
          <span className="text-gray-700">{t('your_location')}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-24">
        {activeTab === 'home' && <ClientHomeContent services={services} onBookingCreated={loadData} />}
        {activeTab === 'tasks' && <ClientTasksContent bookings={bookings} onBookingSelect={setSelectedBooking} />}
        {activeTab === 'profile' && <ClientProfileContent user={user} onLogout={onLogout} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 py-2 px-6 rounded-xl transition-colors ${
              activeTab === item.id 
                ? 'text-green-600' 
                : 'text-gray-500'
            }`}
            data-testid={`client-nav-${item.id}`}
          >
            <item.icon className={`w-6 h-6`} />
            <span className="text-xs font-medium">{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* Panels */}
      <NotificationPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
      <ChatPanel 
        isOpen={showChat} 
        onClose={() => setShowChat(false)}
        currentUser={user}
      />
      <TaskDetailModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        userRole="client"
        onUpdate={loadData}
      />
    </div>
  );
}

// Client Home Content
function ClientHomeContent({ services, onBookingCreated }) {
  const { t } = useLanguage();
  const [selectedService, setSelectedService] = useState(null);
  const [showMultiStepBooking, setShowMultiStepBooking] = useState(false);

  // Group services by category
  const categories = [
    { id: 'moving', nameKey: 'category_moving', icon: '📦' },
    { id: 'home', nameKey: 'category_home', icon: '🔧' },
    { id: 'outdoor', nameKey: 'category_outdoor', icon: '🌳' },
    { id: 'cleaning', nameKey: 'category_cleaning', icon: '✨' },
  ];

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setShowMultiStepBooking(true);
  };

  const handleBookingComplete = () => {
    setShowMultiStepBooking(false);
    setSelectedService(null);
    if (onBookingCreated) onBookingCreated();
  };

  // Show all services if no category match
  const getServicesForCategory = (categoryId) => {
    const filtered = services.filter(s => 
      s.category === categoryId || 
      s.category?.includes(categoryId)
    );
    return filtered.length > 0 ? filtered : services.slice(0, 4);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* All Services Section */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('all_services')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map(service => (
            <div 
              key={service.service_id}
              onClick={() => handleServiceSelect(service)}
              className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              data-testid={`service-card-${service.service_id}`}
            >
              <div className="h-32 bg-gray-100 flex items-center justify-center">
                {service.main_photo ? (
                  <img src={service.main_photo} alt={service.name} className="w-full h-full object-cover" />
                ) : (
                  <Briefcase className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-1">{service.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-600">${service.base_price || 50}{t('per_hour')}</span>
                  <button className="text-sm text-green-600 font-medium">{t('book')}</button>
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="col-span-4 bg-white rounded-2xl p-8 border text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">{t('no_tasks')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.map(category => {
        const categoryServices = getServicesForCategory(category.id);
        if (categoryServices.length === 0) return null;
        
        return (
          <div key={category.id}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t(category.nameKey) || category.id}</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
              {categoryServices.slice(0, 4).map(service => (
                <div 
                  key={`${category.id}-${service.service_id}`}
                  onClick={() => handleServiceSelect(service)}
                  className="flex-shrink-0 w-40 bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="h-24 bg-gray-100 flex items-center justify-center">
                    {service.main_photo ? (
                      <img src={service.main_photo} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{category.icon}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-2">{service.name}</p>
                    <p className="text-sm text-green-600 font-medium mt-1">${service.base_price || 50}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Multi-Step Booking Modal */}
      <MultiStepBookingModal
        isOpen={showMultiStepBooking}
        onClose={() => {
          setShowMultiStepBooking(false);
          setSelectedService(null);
        }}
        service={selectedService}
        onBooked={handleBookingComplete}
      />
    </div>
  );
}

// Client Tasks Content
function ClientTasksContent({ bookings, onBookingSelect }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState('all');
  const [invoices, setInvoices] = useState([]);
  const [payStats, setPayStats] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks | invoices

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    try {
      const res = await api.getClientPaymentStats();
      const data = res?.data || res;
      setPayStats(data);
      setInvoices(data?.invoices || []);
    } catch { setInvoices([]); }
  };

  const pendingInvoices = invoices.filter(i => i.payment_status === 'pending');
  const filteredBookings = bookings.filter(b => {
    if (filter === 'active') return ['posted','assigned','accepted','in_progress'].includes(b.status);
    if (filter === 'completed') return ['completed','paid','completed_pending_payment'].includes(b.status);
    return true;
  });

  if (selectedInvoice) {
    return (
      <ClientInvoiceScreen
        invoice={selectedInvoice}
        onBack={() => { setSelectedInvoice(null); loadInvoices(); }}
        onPaid={() => { setSelectedInvoice(null); loadInvoices(); }}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Payment stats banner */}
      {payStats && (
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" /> Payment Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">${(payStats.total_paid||0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{payStats.paid_count||0} paid</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-orange-500">${(payStats.total_pending||0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{payStats.pending_count||0} pending</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending invoices alert */}
      {pendingInvoices.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-orange-700">{pendingInvoices.length} invoice{pendingInvoices.length>1?'s':''} awaiting payment</span>
          </div>
          {pendingInvoices.slice(0,3).map(inv => (
            <button key={inv.invoice_id} onClick={() => setSelectedInvoice(inv)}
              className="w-full flex items-center justify-between bg-white rounded-xl p-3 mt-2 hover:shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">Invoice #{inv.invoice_number?.slice(-6)}</p>
                <p className="text-xs text-gray-500">${inv.total_amount?.toFixed(2)}</p>
              </div>
              <span className="text-sm font-semibold text-green-600">Pay now →</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 bg-white rounded-xl p-1.5 border">
        {[
          { id:'tasks', label:'Tasks' },
          { id:'invoices', label:`Invoices${invoices.length>0?' ('+invoices.length+')':''}` }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab===tab.id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tasks tab */}
      {activeTab === 'tasks' && (
        <>
          <div className="flex gap-2">
            {['all','active','completed'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  filter===f ? 'bg-green-600 text-white' : 'bg-white border text-gray-600'
                }`}
              >{f}</button>
            ))}
          </div>
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border text-center text-gray-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p>No {filter} tasks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map(b => {
                const isPending = b.status === 'completed_pending_payment';
                return (
                  <button key={b.booking_id}
                    onClick={() => {
                      if (isPending) {
                        const inv = invoices.find(i => i.booking_id === b.booking_id);
                        if (inv) setSelectedInvoice(inv);
                        else if (onBookingSelect) onBookingSelect(b);
                      } else if (onBookingSelect) onBookingSelect(b);
                    }}
                    className="w-full bg-white rounded-2xl p-4 border text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 truncate flex-1">{b.title || 'Service'}</h4>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        b.status==='paid' ? 'bg-green-100 text-green-700' :
                        isPending ? 'bg-orange-100 text-orange-600' :
                        b.status==='cancelled_by_tasker'||b.status==='cancelled_by_client' ? 'bg-red-100 text-red-700' :
                        b.status==='in_progress' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {isPending ? '⚠ Pay Invoice' : b.status?.replace(/_/g,' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {b.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{b.date}</span>}
                      {b.address && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3"/>{b.address}</span>}
                    </div>
                    {b.total_price && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <span className="font-bold text-green-600">${b.total_price}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Invoices tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p>No invoices yet</p>
            </div>
          ) : invoices.map(inv => (
            <button key={inv.invoice_id} onClick={() => setSelectedInvoice(inv)}
              className="w-full bg-white rounded-2xl p-4 border text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Invoice #{inv.invoice_number?.slice(-8)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  inv.payment_status==='paid' ? 'bg-green-100 text-green-700' :
                  inv.payment_status==='pending_admin_charge' ? 'bg-red-100 text-red-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {inv.payment_status==='paid' ? '✓ Paid' :
                   inv.payment_status==='pending_admin_charge' ? 'Overdue' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}
                </span>
                <span className="font-bold text-gray-900">${inv.total_amount?.toFixed(2)}</span>
              </div>
              {inv.payment_status==='paid' && inv.paid_at && (
                <p className="text-xs text-green-600 mt-1">
                  Paid {new Date(inv.paid_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  {inv.payment_method ? ` via ${inv.payment_method}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Client Invoice Payment Screen ───────────────────────────────────────────
function ClientInvoiceScreen({ invoice, onBack, onPaid }) {
  const [step, setStep] = useState('view'); // view | pay | review | done
  const [payMethod, setPayMethod] = useState('card');
  const [tip, setTip] = useState(0);
  const [providerRating, setProviderRating] = useState(0);
  const [providerComment, setProviderComment] = useState('');
  const [taskComment, setTaskComment] = useState('');
  const [addFavorite, setAddFavorite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tipOptions = [0, 5, 10, 15, 20];
  const payMethods = [
    { id:'card', label:'💳 Credit / Debit Card' },
    { id:'stripe', label:'💳 Stripe' },
    { id:'zelle', label:'🏦 Zelle' },
    { id:'venmo', label:'📱 Venmo' },
    { id:'cash', label:'💵 Cash' },
  ];

  const total = (invoice.total_amount||0) + tip;
  const providerName = invoice.provider_info?.name || 'Tasker';
  const providerInitial = providerName.charAt(0);

  const handleConfirmPay = async () => {
    setSubmitting(true);
    try {
      await api.confirmClientInvoice(invoice.invoice_id, {
        payment_method: payMethod,
        tip_amount: tip,
        provider_review_rating: providerRating > 0 ? providerRating : null,
        provider_review_comment: providerComment,
        task_comment: taskComment,
        add_to_favorites: addFavorite,
      });
      setStep('done');
    } catch (err) {
      alert(err?.response?.data?.detail || 'Payment failed');
    } finally { setSubmitting(false); }
  };

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-64 text-center space-y-4 py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Confirmed!</h2>
        <p className="text-gray-500">You paid <strong>${total.toFixed(2)}</strong> to {providerName}</p>
        {addFavorite && <p className="text-sm text-green-600">⭐ Added {providerName} to favorites!</p>}
        <button onClick={onPaid} className="mt-4 px-8 py-3 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700">
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>

      {/* Invoice header */}
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-lg">
          {providerInitial}
        </div>
        <div>
          <p className="font-bold text-gray-900">Invoice #{invoice.invoice_number?.slice(-8)}</p>
          <p className="text-sm text-gray-500">from {providerName}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-gray-900">${invoice.total_amount?.toFixed(2)}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            invoice.payment_status==='paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
          }`}>
            {invoice.payment_status==='paid' ? 'Paid' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-white rounded-2xl border divide-y">
        {invoice.hours_worked && (
          <div className="flex justify-between p-3 text-sm">
            <span className="text-gray-600">Labor ({invoice.hours_worked}h × ${invoice.hourly_rate}/hr)</span>
            <span className="font-medium">${invoice.base_price?.toFixed(2)}</span>
          </div>
        )}
        {invoice.materials_cost > 0 && (
          <div className="flex justify-between p-3 text-sm">
            <span className="text-gray-600">{invoice.materials_description||'Materials'}</span>
            <span className="font-medium">${invoice.materials_cost?.toFixed(2)}</span>
          </div>
        )}
        {invoice.service_fee > 0 && (
          <div className="flex justify-between p-3 text-sm">
            <span className="text-gray-600">Service fee</span>
            <span className="font-medium">${invoice.service_fee?.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between p-3 font-bold">
          <span>Total</span><span className="text-green-600">${invoice.total_amount?.toFixed(2)}</span>
        </div>
      </div>

      {invoice.closing_message && (
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-sm text-gray-500 italic">"{invoice.closing_message}"</p>
          <p className="text-xs text-gray-400 mt-1">— {providerName}</p>
        </div>
      )}

      {invoice.payment_status !== 'paid' && (
        <>
          {/* Payment method */}
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Payment Method</h3>
            {payMethods.map(pm => (
              <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                  payMethod===pm.id ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="text-sm font-medium text-gray-900">{pm.label}</span>
                {payMethod===pm.id && <Check className="w-4 h-4 text-green-600 ml-auto"/>}
              </button>
            ))}
          </div>

          {/* Tip */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Add a Tip</h3>
            <div className="flex gap-2">
              {tipOptions.map(t => (
                <button key={t} onClick={() => setTip(t===tip ? 0 : t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    tip===t && t>0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                  }`}
                >{t===0 ? 'None' : `$${t}`}</button>
              ))}
            </div>
          </div>

          {/* Rate provider */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Rate {providerName}</h3>
            <div className="flex gap-2 mb-3">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setProviderRating(s)}>
                  <Star className={`w-8 h-8 transition-colors ${s<=providerRating?'fill-yellow-400 text-yellow-400':'text-gray-200'}`}/>
                </button>
              ))}
            </div>
            {providerRating > 0 && (
              <textarea value={providerComment} onChange={e => setProviderComment(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm h-16 resize-none focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="Share your experience..."
              />
            )}
          </div>

          {/* Task comment */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Comment on Task</h3>
            <textarea value={taskComment} onChange={e => setTaskComment(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm h-16 resize-none focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Any notes about this job..."
            />
          </div>

          {/* Add to favorites */}
          <div className="bg-white rounded-2xl border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-gray-900">Add {providerName} to Favorites</p>
                <p className="text-xs text-gray-500">Book them again easily next time</p>
              </div>
            </div>
            <button onClick={() => setAddFavorite(!addFavorite)}
              className={`relative w-12 h-6 rounded-full transition-colors ${addFavorite?'bg-green-600':'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${addFavorite?'translate-x-6':'translate-x-0.5'}`}/>
            </button>
          </div>

          {/* Pay button */}
          <div className="bg-white rounded-2xl border p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Invoice total</span>
              <span>${invoice.total_amount?.toFixed(2)}</span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Tip</span><span>${tip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total charge</span><span className="text-green-600">${total.toFixed(2)}</span>
            </div>
          </div>

          <button onClick={handleConfirmPay} disabled={submitting}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : `Confirm & Pay $${total.toFixed(2)}`}
          </button>
        </>
      )}

      {invoice.payment_status === 'paid' && (
        <div className="bg-green-50 rounded-2xl p-5 text-center">
          <Check className="w-10 h-10 text-green-600 mx-auto mb-2" />
          <p className="font-bold text-green-700">Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'}</p>
          {invoice.payment_method && <p className="text-sm text-green-600 mt-1">via {invoice.payment_method}</p>}
        </div>
      )}
    </div>
  );
}

// Client Profile Content
function ClientProfileContent({ user, onLogout }) {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [newPayment, setNewPayment] = useState({ card_number: '', expiry: '', cvv: '', name: '' });
  const [newAddress, setNewAddress] = useState({ label: '', street: '', city: '', zip: '' });
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || ''
  });

  // Load payment methods and addresses from backend on mount
  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const [pmRes, addrRes] = await Promise.all([
          api.getPaymentMethods(),
          api.getSavedAddresses()
        ]);
        setPaymentMethods(pmRes.data || []);
        setSavedAddresses(addrRes.data || []);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  const menuItems = [
    { id: 'account', icon: User, label: t('account_details') },
    { id: 'payments', icon: CreditCard, label: t('payment_methods') },
    { id: 'addresses', icon: MapPin, label: t('addresses') },
    { id: 'invite', icon: Gift, label: t('invite_friends'), highlight: true },
    { id: 'support', icon: HelpCircle, label: t('support') },
    { id: 'logout', icon: LogOut, label: t('logout'), danger: true },
  ];

  const handleMenuClick = (id) => {
    if (id === 'logout') {
      if (onLogout) onLogout();
      return;
    }
    setActiveSection(activeSection === id ? null : id);
  };

  const handleSaveProfile = async () => {
    try {
      await api.updateProfile(profileData);
      setEditingProfile(false);
      alert(t('settings_saved'));
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(t('error_saving'));
    }
  };

  const handleAddPayment = async () => {
    if (newPayment.card_number && newPayment.expiry && newPayment.cvv) {
      try {
        const res = await api.addPaymentMethod({
          last4: newPayment.card_number.slice(-4),
          type: 'Visa',
          name: newPayment.name
        });
        setPaymentMethods([...paymentMethods, res.data]);
        setNewPayment({ card_number: '', expiry: '', cvv: '', name: '' });
        setShowAddPayment(false);
        alert(t('settings_saved'));
      } catch (error) {
        console.error('Error saving payment method:', error);
        alert(t('error_saving') || 'Error saving');
      }
    }
  };

  const handleDeletePayment = async (id) => {
    try {
      await api.deletePaymentMethod(id);
      setPaymentMethods(paymentMethods.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
  };

  const handleAddAddress = async () => {
    if (newAddress.street && newAddress.city) {
      try {
        const res = await api.addSavedAddress(newAddress);
        setSavedAddresses([...savedAddresses, res.data]);
        setNewAddress({ label: '', street: '', city: '', zip: '' });
        setShowAddAddress(false);
        alert(t('settings_saved'));
      } catch (error) {
        console.error('Error saving address:', error);
        alert(t('error_saving') || 'Error saving');
      }
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await api.deleteSavedAddress(id);
      setSavedAddresses(savedAddresses.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting address:', error);
    }
  };

  const copyReferralCode = () => {
    const code = user?.referral_code || 'FRIEND20';
    navigator.clipboard.writeText(code);
    alert(t('copied') || 'Copied!');
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 border">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-green-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
          <button 
            onClick={() => setEditingProfile(!editingProfile)}
            className="p-2 hover:bg-gray-100 rounded-full"
            data-testid="edit-profile-btn"
          >
            <Edit className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {editingProfile && (
          <div className="pt-4 border-t space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({...prev, name: e.target.value}))}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')}</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({...prev, phone: e.target.value}))}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('address')}</label>
              <input
                type="text"
                value={profileData.address}
                onChange={(e) => setProfileData(prev => ({...prev, address: e.target.value}))}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingProfile(false)} className="flex-1 py-2 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">
                {t('cancel')}
              </button>
              <button onClick={handleSaveProfile} className="flex-1 py-2 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700">
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {menuItems.map((item, index) => (
          <div key={item.id}>
            <button 
              onClick={() => handleMenuClick(item.id)}
              data-testid={`profile-menu-${item.id}`}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                index < menuItems.length - 1 ? 'border-b' : ''
              } ${item.highlight ? 'bg-green-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${item.highlight ? 'text-green-600' : item.danger ? 'text-red-600' : 'text-gray-600'}`} />
                <span className={`font-medium ${item.highlight ? 'text-green-700' : item.danger ? 'text-red-600' : 'text-gray-900'}`}>{item.label}</span>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${activeSection === item.id ? 'rotate-90' : ''} ${item.highlight ? 'text-green-600' : item.danger ? 'text-red-400' : 'text-gray-400'}`} />
            </button>

            {activeSection === item.id && item.id !== 'logout' && (
              <div className="px-4 py-4 bg-gray-50 border-b">
                {item.id === 'account' && (
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">{t('name')}:</span> {user?.name}</p>
                    <p><span className="text-gray-500">{t('email')}:</span> {user?.email}</p>
                    <p><span className="text-gray-500">{t('phone')}:</span> {user?.phone || '-'}</p>
                  </div>
                )}

                {item.id === 'payments' && (
                  <div className="space-y-3">
                    {paymentMethods.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('no_payment_methods')}</p>
                    ) : (
                      paymentMethods.map(pm => (
                        <div key={pm.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <span className="text-sm font-medium">{pm.type} •••• {pm.last4}</span>
                          </div>
                          <button onClick={() => handleDeletePayment(pm.id)} className="text-red-500 text-sm">{t('delete')}</button>
                        </div>
                      ))
                    )}

                    {showAddPayment ? (
                      <div className="bg-white p-4 rounded-xl border space-y-3">
                        <input type="text" placeholder={t('card_number')} value={newPayment.card_number} onChange={(e) => setNewPayment({...newPayment, card_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={16} />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder={t('expiry')} value={newPayment.expiry} onChange={(e) => setNewPayment({...newPayment, expiry: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" maxLength={5} />
                          <input type="text" placeholder={t('cvv')} value={newPayment.cvv} onChange={(e) => setNewPayment({...newPayment, cvv: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" maxLength={4} />
                        </div>
                        <input type="text" placeholder={t('name')} value={newPayment.name} onChange={(e) => setNewPayment({...newPayment, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddPayment(false)} className="flex-1 py-2 text-sm border rounded-lg">{t('cancel')}</button>
                          <button onClick={handleAddPayment} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg">{t('save')}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddPayment(true)} className="text-green-600 font-medium text-sm" data-testid="add-payment-btn">
                        + {t('add_payment_method')}
                      </button>
                    )}
                  </div>
                )}

                {item.id === 'addresses' && (
                  <div className="space-y-3">
                    {savedAddresses.length === 0 && !user?.address ? (
                      <p className="text-sm text-gray-500">{t('no_addresses')}</p>
                    ) : (
                      <>
                        {user?.address && (
                          <div className="bg-white p-3 rounded-lg border">
                            <p className="text-sm font-medium">{t('home') || 'Home'}</p>
                            <p className="text-sm text-gray-500">{user.address}</p>
                          </div>
                        )}
                        {savedAddresses.map(addr => (
                          <div key={addr.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                            <div>
                              <p className="text-sm font-medium">{addr.label || t('address')}</p>
                              <p className="text-sm text-gray-500">{addr.street}, {addr.city} {addr.zip}</p>
                            </div>
                            <button onClick={() => handleDeleteAddress(addr.id)} className="text-red-500 text-sm">{t('delete')}</button>
                          </div>
                        ))}
                      </>
                    )}

                    {showAddAddress ? (
                      <div className="bg-white p-4 rounded-xl border space-y-3">
                        <input type="text" placeholder={t('label') || 'Label (Home, Work...)'} value={newAddress.label} onChange={(e) => setNewAddress({...newAddress, label: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <input type="text" placeholder={t('street_address')} value={newAddress.street} onChange={(e) => setNewAddress({...newAddress, street: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder={t('city')} value={newAddress.city} onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" />
                          <input type="text" placeholder={t('zip') || 'ZIP'} value={newAddress.zip} onChange={(e) => setNewAddress({...newAddress, zip: e.target.value})} className="px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddAddress(false)} className="flex-1 py-2 text-sm border rounded-lg">{t('cancel')}</button>
                          <button onClick={handleAddAddress} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg">{t('save')}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddAddress(true)} className="text-green-600 font-medium text-sm" data-testid="add-address-btn">
                        + {t('add_address')}
                      </button>
                    )}
                  </div>
                )}

                {item.id === 'invite' && (
                  <div className="text-sm">
                    <p className="text-gray-600 mb-3">{t('invite_description') || 'Share your code and earn $20 for each friend!'}</p>
                    <div className="bg-white rounded-lg p-3 border flex items-center justify-between">
                      <span className="font-mono font-medium text-green-600">{user?.referral_code || 'FRIEND20'}</span>
                      <button onClick={copyReferralCode} className="text-sm text-green-600 font-medium">{t('copy') || 'Copy'}</button>
                    </div>
                  </div>
                )}

                {item.id === 'support' && (
                  <div className="text-sm space-y-2">
                    <a href="mailto:support@handyhub.com" className="block py-2 text-gray-700 hover:text-green-600">📧 {t('email_support') || 'Email support'}</a>
                    <button className="w-full text-left py-2 text-gray-700 hover:text-green-600">💬 {t('live_chat') || 'Live chat'}</button>
                    <button className="w-full text-left py-2 text-gray-700 hover:text-green-600">❓ {t('faq') || 'FAQ'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== PLACEHOLDER PANELS ====================
// ─── Admin Executors Panel ────────────────────────────────────────────────────
function AdminExecutorsPanel() {
  const [executors, setExecutors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'filters'
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all'); // all | visible | hidden
  const [sortBy, setSortBy] = useState('rating');
  const [togglingId, setTogglingId] = useState(null);
  const [filterForm, setFilterForm] = useState(null);
  const [savingFilters, setSavingFilters] = useState(false);
  const [payoutModal, setPayoutModal] = useState(null); // executor object
  const [payoutForm, setPayoutForm] = useState({ amount: '', method: '', note: '' });
  const [payoutSending, setPayoutSending] = useState(false);
  const [payoutDone, setPayoutDone] = useState(false);
  const [savedFilters, setSavedFilters] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [exRes, stRes] = await Promise.all([
        api.getAdminExecutors().catch(() => ({ data: [] })),
        api.getAdminSettings().catch(() => ({})),
      ]);
      const exData = exRes?.data || exRes || [];
      setExecutors(Array.isArray(exData) ? exData : []);
      const stData = stRes?.data || stRes || {};
      setSettings(stData);
      setFilterForm({
        executor_listing_sort: stData.executor_listing_sort || 'recommended',
        executor_min_rating: stData.executor_min_rating ?? 0,
        executor_min_tasks: stData.executor_min_tasks ?? 0,
        executor_max_price: stData.executor_max_price ?? 0,
        executor_verified_only: stData.executor_verified_only ?? false,
        executor_show_new: stData.executor_show_new ?? true,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (executor) => {
    setTogglingId(executor.user_id);
    try {
      await api.toggleExecutorVisibility(executor.user_id);
      setExecutors(prev => prev.map(e =>
        e.user_id === executor.user_id
          ? { ...e, hidden_from_clients: !e.hidden_from_clients }
          : e
      ));
    } catch (err) {
      console.error(err);
      alert('Could not update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveFilters = async () => {
    setSavingFilters(true);
    try {
      await api.updateAdminSettings(filterForm);
      setSavedFilters(true);
      setTimeout(() => setSavedFilters(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Could not save filter settings');
    } finally {
      setSavingFilters(false);
    }
  };

  const updateFilter = (key, value) => setFilterForm(prev => ({ ...prev, [key]: value }));

  // local sort + filter for the list view
  const displayed = executors
    .filter(e => {
      const matchSearch = !search ||
        (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.email || '').toLowerCase().includes(search.toLowerCase());
      const matchVis = visibilityFilter === 'all' ||
        (visibilityFilter === 'hidden' && e.hidden_from_clients) ||
        (visibilityFilter === 'visible' && !e.hidden_from_clients);
      return matchSearch && matchVis;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.average_rating || 0) - (a.average_rating || 0);
      if (sortBy === 'tasks') return (b.completed_tasks_count || 0) - (a.completed_tasks_count || 0);
      if (sortBy === 'price_asc') return ((a.profile?.hourly_rate) || 0) - ((b.profile?.hourly_rate) || 0);
      if (sortBy === 'price_desc') return ((b.profile?.hourly_rate) || 0) - ((a.profile?.hourly_rate) || 0);
      if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return 0;
    });

  const hiddenCount = executors.filter(e => e.hidden_from_clients).length;
  const visibleCount = executors.length - hiddenCount;

  if (loading) return (
    <div className="flex items-center justify-center p-16">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executors Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {visibleCount} visible · {hiddenCount} hidden from clients · {executors.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'list' ? 'bg-green-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'filters' ? 'bg-green-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Listing Filters
          </button>
        </div>
      </div>

      {/* ── TAB: LIST ── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search & Filters bar */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Visibility filter */}
            <div className="flex bg-white border rounded-xl p-1 gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'visible', label: '👁 Visible' },
                { id: 'hidden', label: '🚫 Hidden' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setVisibilityFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    visibilityFilter === f.id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="rating">Sort: Rating ↓</option>
              <option value="tasks">Sort: Tasks ↓</option>
              <option value="price_asc">Sort: Price ↑</option>
              <option value="price_desc">Sort: Price ↓</option>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
            </select>
          </div>

          {/* Executor cards */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            {displayed.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                No executors found
              </div>
            ) : (
              <div className="divide-y">
                {displayed.map(executor => {
                  const profile = executor.profile || {};
                  const isHidden = executor.hidden_from_clients;
                  const isBlocked = executor.is_blocked;
                  const rating = executor.average_rating || 0;
                  const tasks = executor.completed_tasks_count || 0;
                  const rate = profile.hourly_rate || 0;
                  const firstName = (executor.name || '?').charAt(0).toUpperCase();
                  const regDate = executor.created_at
                    ? new Date(executor.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';

                  return (
                    <div
                      key={executor.user_id}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${isHidden ? 'opacity-60' : ''}`}
                    >
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                        isHidden ? 'bg-gray-200 text-gray-400' : 'bg-green-100 text-green-700'
                      }`}>
                        {executor.picture
                          ? <img src={executor.picture} className="w-full h-full object-cover rounded-full" alt="" />
                          : firstName
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{executor.name}</span>
                          {isHidden && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Hidden from clients
                            </span>
                          )}
                          {isBlocked && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                              Blocked
                            </span>
                          )}
                          {profile.is_verified && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate">{executor.email}</div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {rating > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-600">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {rating.toFixed(1)} ({executor.total_reviews || 0})
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            ✓ {tasks} tasks
                          </span>
                          {rate > 0 && (
                            <span className="text-xs font-medium text-green-600">
                              ${rate}/hr
                            </span>
                          )}
                          {(profile.skills || []).length > 0 && (
                            <span className="text-xs text-gray-400">
                              {profile.skills.slice(0, 3).join(', ')}{profile.skills.length > 3 ? ` +${profile.skills.length - 3}` : ''}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">Joined {regDate}</span>
                        </div>
                      </div>

                      {/* Pay button */}
                      <button
                        onClick={() => {
                          const methods = executor.profile?.payout_accounts || executor.payout_accounts || [];
                          setPayoutModal({ ...executor, payoutMethods: methods });
                          setPayoutForm({ amount: '', method: methods[0]?.type || '', note: '' });
                          setPayoutDone(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-green-500 text-green-600 hover:bg-green-50 transition-colors"
                        title="Send payout to executor"
                      >
                        <DollarSign className="w-4 h-4" /> Pay
                      </button>

                      {/* Toggle visibility button */}
                      <button
                        onClick={() => handleToggleVisibility(executor)}
                        disabled={togglingId === executor.user_id}
                        title={isHidden ? 'Show to clients' : 'Hide from clients'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isHidden
                            ? 'border-green-500 text-green-600 hover:bg-green-50'
                            : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {togglingId === executor.user_id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isHidden ? (
                          <><Eye className="w-4 h-4" /> Show</>
                        ) : (
                          <><EyeOff className="w-4 h-4" /> Hide</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PAYOUT MODAL ── */}
      {payoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700">
                  {(payoutModal.name || '?').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{payoutModal.name}</p>
                  <p className="text-sm text-gray-500">{payoutModal.email}</p>
                </div>
              </div>
              <button onClick={() => setPayoutModal(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {payoutDone ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-bold text-gray-900 text-lg mb-1">Payment Sent!</p>
                <p className="text-sm text-gray-500 mb-2">
                  ${payoutForm.amount} sent to {payoutModal.name}
                </p>
                {payoutForm.method && (
                  <p className="text-xs text-gray-400">via {payoutForm.method}</p>
                )}
                <button onClick={() => setPayoutModal(null)}
                  className="mt-5 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
                >Close</button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Payout methods registered by executor */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Executor's Payout Methods
                  </p>
                  {payoutModal.payoutMethods && payoutModal.payoutMethods.length > 0 ? (
                    <div className="space-y-2">
                      {payoutModal.payoutMethods.map((acc, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPayoutForm(f => ({ ...f, method: acc.type || acc.label }))}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                            payoutForm.method === (acc.type || acc.label)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-xl">
                            {acc.type === 'bank' ? '🏦' : acc.type === 'paypal' ? '🅿️' : acc.type === 'zelle' ? '💚' : acc.type === 'venmo' ? '💜' : '💳'}
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-900">{acc.label || acc.type}</p>
                            {acc.details && <p className="text-xs text-gray-500">{acc.details}</p>}
                            {acc.account_number && <p className="text-xs text-gray-400">****{acc.account_number.slice(-4)}</p>}
                          </div>
                          {payoutForm.method === (acc.type || acc.label) && (
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">No payout methods registered</p>
                          <p className="text-xs text-amber-600 mt-1">
                            This executor hasn't added any payout accounts yet.
                            You can still manually send via the methods below.
                          </p>
                        </div>
                      </div>
                      {/* Manual methods when executor has none */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {['Bank Transfer','PayPal','Zelle','Venmo','Cash','Check'].map(m => (
                          <button
                            key={m}
                            onClick={() => setPayoutForm(f => ({ ...f, method: m }))}
                            className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                              payoutForm.method === m
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >{m}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500 font-bold text-lg">$</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={payoutForm.amount}
                      onChange={e => setPayoutForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3 border-2 rounded-xl text-xl font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Note (optional)</label>
                  <input
                    type="text"
                    value={payoutForm.note}
                    onChange={e => setPayoutForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g. Task #1234 payment"
                    className="w-full px-4 py-3 border-2 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                {/* Summary */}
                {payoutForm.amount && payoutForm.method && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Sending to <strong>{payoutModal.name}</strong></p>
                      <p className="text-sm text-gray-500">via {payoutForm.method}</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">${payoutForm.amount}</p>
                  </div>
                )}

                <button
                  disabled={!payoutForm.amount || !payoutForm.method || payoutSending}
                  onClick={async () => {
                    setPayoutSending(true);
                    try {
                      await api.sendPayoutToExecutor?.(payoutModal.user_id, {
                        amount: parseFloat(payoutForm.amount),
                        method: payoutForm.method,
                        note: payoutForm.note,
                      }).catch(() => {});
                    } finally {
                      setPayoutSending(false);
                      setPayoutDone(true);
                    }
                  }}
                  className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {payoutSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><DollarSign className="w-5 h-5" /> Send Payment</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: LISTING FILTERS ── */}
      {activeTab === 'filters' && filterForm && (
        <div className="space-y-6 max-w-2xl">

          {/* Default sort order */}
          <div className="bg-white rounded-2xl border p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <ArrowUpDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Default Sort Order</h3>
                <p className="text-sm text-gray-500">How executors are ranked when client opens the list</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'recommended', label: '⭐ Recommended', desc: 'Rating × Tasks score' },
                { id: 'rating', label: '🏆 By Rating', desc: 'Highest rating first' },
                { id: 'tasks', label: '✅ By Tasks', desc: 'Most completed first' },
                { id: 'price_asc', label: '💵 Price: Low→High', desc: 'Cheapest first' },
                { id: 'price_desc', label: '💎 Price: High→Low', desc: 'Most expensive first' },
                { id: 'newest', label: '🆕 Newest First', desc: 'Recently joined' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => updateFilter('executor_listing_sort', opt.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${
                    filterForm.executor_listing_sort === opt.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility filters */}
          <div className="bg-white rounded-2xl border p-6 space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Filter className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Listing Filters</h3>
                <p className="text-sm text-gray-500">Automatically hide executors that don't meet criteria</p>
              </div>
            </div>

            {/* Min rating */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label className="font-medium text-gray-900 text-sm">Minimum Rating</label>
                  <p className="text-xs text-gray-500">Hide executors below this rating (0 = no filter)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-green-600 w-10 text-right">
                    {filterForm.executor_min_rating === 0 ? 'Off' : filterForm.executor_min_rating.toFixed(1)}
                  </span>
                </div>
              </div>
              <input
                type="range" min="0" max="5" step="0.1"
                value={filterForm.executor_min_rating}
                onChange={e => updateFilter('executor_min_rating', parseFloat(e.target.value))}
                className="w-full accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Off</span><span>1.0</span><span>2.0</span><span>3.0</span><span>4.0</span><span>5.0</span>
              </div>
            </div>

            {/* Min tasks */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label className="font-medium text-gray-900 text-sm">Minimum Completed Tasks</label>
                  <p className="text-xs text-gray-500">Hide executors with fewer tasks (0 = no filter)</p>
                </div>
                <span className="font-bold text-green-600 min-w-[3rem] text-right">
                  {filterForm.executor_min_tasks === 0 ? 'Off' : `${filterForm.executor_min_tasks}+`}
                </span>
              </div>
              <input
                type="range" min="0" max="100" step="1"
                value={filterForm.executor_min_tasks}
                onChange={e => updateFilter('executor_min_tasks', parseInt(e.target.value))}
                className="w-full accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Off</span><span>25</span><span>50</span><span>75</span><span>100</span>
              </div>
            </div>

            {/* Max price */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <label className="font-medium text-gray-900 text-sm">Maximum Hourly Rate ($)</label>
                  <p className="text-xs text-gray-500">Hide executors above this rate (0 = no limit)</p>
                </div>
                <span className="font-bold text-green-600 min-w-[3.5rem] text-right">
                  {filterForm.executor_max_price === 0 ? 'No limit' : `$${filterForm.executor_max_price}`}
                </span>
              </div>
              <input
                type="range" min="0" max="300" step="5"
                value={filterForm.executor_max_price}
                onChange={e => updateFilter('executor_max_price', parseInt(e.target.value))}
                className="w-full accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>No limit</span><span>$75</span><span>$150</span><span>$225</span><span>$300</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t">
              {[
                {
                  key: 'executor_verified_only',
                  label: 'Verified executors only',
                  desc: 'Only show executors who passed ID verification',
                  icon: '✓'
                },
                {
                  key: 'executor_show_new',
                  label: 'Show new executors',
                  desc: 'Include executors with 0 completed tasks',
                  icon: '🆕'
                },
              ].map(({ key, label, desc, icon }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateFilter(key, !filterForm[key])}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      filterForm[key] ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      filterForm[key] ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-green-600" /> Filter Preview
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              With current settings, clients will see executors who:
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                Are sorted by: <strong>{filterForm.executor_listing_sort}</strong>
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                Rating ≥ {filterForm.executor_min_rating > 0 ? filterForm.executor_min_rating.toFixed(1) : 'any'}
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                Tasks ≥ {filterForm.executor_min_tasks > 0 ? filterForm.executor_min_tasks : 'any'}
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                Rate ≤ {filterForm.executor_max_price > 0 ? `$${filterForm.executor_max_price}/hr` : 'no limit'}
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                {filterForm.executor_verified_only ? 'Verified only' : 'Verified + unverified'}
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                {filterForm.executor_show_new ? 'Including new executors' : 'Experienced executors only'}
              </li>
            </ul>
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveFilters}
            disabled={savingFilters}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            data-testid="save-executor-filters-btn"
          >
            {savingFilters ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : savedFilters ? (
              <><Check className="w-5 h-5" /> Saved!</>
            ) : (
              <><Check className="w-5 h-5" /> Save Filter Settings</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminUsersPanel({ users, onRefresh }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [blockModal, setBlockModal] = useState(null);   // user to block
  const [promoModal, setPromoModal] = useState(null);   // user to give promo
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [showInvoicesPanel, setShowInvoicesPanel] = useState(false);

  useEffect(() => { loadPendingInvoices(); }, []);

  const loadPendingInvoices = async () => {
    try {
      const res = await api.adminGetPendingInvoices();
      setPendingInvoices(res?.data || res || []);
    } catch { setPendingInvoices([]); }
  };

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleToggleBlock = async (user) => {
    if (!user.is_blocked) { setBlockModal(user); return; }
    setActionLoading(prev => ({ ...prev, [user.user_id]: true }));
    try {
      await api.unblockUser(user.user_id);
      onRefresh();
    } catch { alert('Could not unblock user'); }
    finally { setActionLoading(prev => ({ ...prev, [user.user_id]: false })); }
  };

  const handleRoleSave = async () => {
    try {
      await api.updateUserRole(editingUser.user_id, editRole);
      setEditingUser(null); onRefresh();
    } catch { alert('Could not update role'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this user?')) return;
    try { await api.deleteUser(userId); onRefresh(); }
    catch { alert('Could not delete user'); }
  };

  const handleForceCharge = async (invoiceId) => {
    if (!window.confirm('Force charge this invoice?')) return;
    try {
      const res = await api.adminForceCharge(invoiceId);
      alert(res?.data?.message || 'Done');
      loadPendingInvoices();
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav_users')}</h1>
          <p className="text-sm text-gray-500">{filtered.length} / {users.length} total</p>
        </div>
        {pendingInvoices.length > 0 && (
          <button onClick={() => setShowInvoicesPanel(!showInvoicesPanel)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl font-medium text-sm hover:bg-orange-200"
          >
            <AlertCircle className="w-4 h-4" />
            {pendingInvoices.length} pending invoice{pendingInvoices.length>1?'s':''}
          </button>
        )}
      </div>

      {/* Pending invoices panel */}
      {showInvoicesPanel && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b bg-orange-50 flex items-center justify-between">
            <h3 className="font-semibold text-orange-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Pending Invoices — Force Charge
            </h3>
            <button onClick={() => setShowInvoicesPanel(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {pendingInvoices.map(inv => (
              <div key={inv.invoice_id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">#{inv.invoice_number?.slice(-8)}</p>
                  <p className="text-xs text-gray-500">
                    Client: {inv.client_info?.name||inv.client_id} · ${inv.total_amount?.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    inv.payment_status==='pending_admin_charge' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {inv.payment_status==='pending_admin_charge' ? 'No card' : 'Pending'}
                  </span>
                  <button onClick={() => handleForceCharge(inv.invoice_id)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                  >
                    Force Charge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <div className="flex gap-2 bg-white rounded-xl p-1 border">
          {['all', 'client', 'provider', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                roleFilter===r ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('email')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('password')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                        {u.picture ? <img src={u.picture} alt={u.name} className="w-full h-full object-cover"/> : <User className="w-4 h-4 text-gray-600"/>}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                        {u.blocked_until && (
                          <p className="text-xs text-orange-500">
                            Until {new Date(u.blocked_until).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-600" data-testid={`user-password-${u.user_id}`}>
                      {u.plain_password || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role==='admin' ? 'bg-purple-100 text-purple-700' :
                      u.role==='provider' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {u.is_blocked ? `Blocked${u.blocked_until ? ' (temp)' : ''}` : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingUser(u); setEditRole(u.role); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Change role"
                      ><Edit className="w-4 h-4"/></button>
                      <button onClick={() => handleToggleBlock(u)} disabled={actionLoading[u.user_id]}
                        className={`p-1.5 rounded-lg ${u.is_blocked?'text-green-600 hover:bg-green-50':'text-orange-600 hover:bg-orange-50'}`}
                        title={u.is_blocked ? 'Unblock' : 'Block'}
                      >
                        {actionLoading[u.user_id]
                          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                          : u.is_blocked ? <CheckCircle className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                      </button>
                      <button onClick={() => setPromoModal(u)}
                        className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Give promo"
                      ><Gift className="w-4 h-4"/></button>
                      <button onClick={() => handleDeleteUser(u.user_id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"
                      ><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-4">Change Role: {editingUser.name}</h3>
            <select value={editRole} onChange={e => setEditRole(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl mb-4 outline-none focus:ring-2 focus:ring-green-500"
            >
              {['client','provider','admin'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 border rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleRoleSave} className="flex-1 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Extended Block Modal */}
      {blockModal && (
        <AdminBlockModal user={blockModal} onClose={() => setBlockModal(null)} onDone={() => { setBlockModal(null); onRefresh(); }}/>
      )}

      {/* Give Promo Modal */}
      {promoModal && (
        <AdminPromoModal user={promoModal} onClose={() => setPromoModal(null)} onDone={() => setPromoModal(null)}/>
      )}
    </div>
  );
}

// ─── Admin Block Modal ────────────────────────────────────────────────────────
function AdminBlockModal({ user, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [blockType, setBlockType] = useState('permanent'); // permanent | temporary
  const [hours, setHours] = useState(24);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const presetReasons = ['Fraud','Spam','Abuse','Terms violation','Repeated cancellations','Fake reviews','Other'];
  const durationOptions = [
    { label:'1 hour', hours:1 },{ label:'6 hours', hours:6 },{ label:'24 hours', hours:24 },
    { label:'3 days', hours:72 },{ label:'7 days', hours:168 },{ label:'30 days', hours:720 },
  ];

  const handleBlock = async () => {
    if (!reason) return alert('Select a reason');
    setSaving(true);
    try {
      await api.blockUserExtended(user.user_id, {
        reason,
        details,
        duration_hours: blockType === 'temporary' ? hours : null,
      });
      onDone();
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-gray-900 text-lg">Block User: {user.name}</h3>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Reason</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {presetReasons.map(r => (
              <button key={r} onClick={() => setReason(r)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  reason===r ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300'
                }`}
              >{r}</button>
            ))}
          </div>
          <textarea value={details} onChange={e => setDetails(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm h-16 resize-none outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Additional details..."
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Block Duration</p>
          <div className="flex gap-2 mb-3">
            {['permanent','temporary'].map(t => (
              <button key={t} onClick={() => setBlockType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors capitalize ${
                  blockType===t ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                }`}
              >{t}</button>
            ))}
          </div>
          {blockType === 'temporary' && (
            <div className="grid grid-cols-3 gap-2">
              {durationOptions.map(d => (
                <button key={d.hours} onClick={() => setHours(d.hours)}
                  className={`py-2 rounded-xl text-xs font-medium border-2 transition-colors ${
                    hours===d.hours ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'
                  }`}
                >{d.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleBlock} disabled={saving||!reason}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Blocking...' : blockType==='permanent' ? 'Block Permanently' : `Block for ${hours}h`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Give Promo Modal ───────────────────────────────────────────────────
function AdminPromoModal({ user, onClose, onDone }) {
  const [discountType, setDiscountType] = useState('percent');
  const [value, setValue] = useState(10);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');

  const handleGive = async () => {
    setSaving(true);
    try {
      const res = await api.adminGivePromo(user.user_id, {
        discount_type: discountType,
        discount_value: value,
        expires_days: days,
        note,
      });
      setCode(res?.data?.code || '');
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  if (code) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-yellow-500"/>
          </div>
          <h3 className="font-bold text-gray-900">Promo Sent!</h3>
          <p className="text-gray-500 text-sm">Code sent to {user.name}</p>
          <div className="bg-gray-50 rounded-xl p-3 font-mono font-bold text-lg text-green-600">{code}</div>
          <p className="text-xs text-gray-400">Valid for {days} days · {discountType==='percent'?`${value}%`:`$${value}`} off</p>
          <button onClick={onDone} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-yellow-500"/> Give Promo to {user.name}
        </h3>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Discount Type</p>
          <div className="flex gap-2">
            {[{id:'percent',label:'% Percent'},{id:'fixed',label:'$ Fixed'}].map(t => (
              <button key={t.id} onClick={() => setDiscountType(t.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                  discountType===t.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">Discount Value</label>
            <span className="font-bold text-green-600">{discountType==='percent'?`${value}%`:`$${value}`}</span>
          </div>
          <input type="range" min={discountType==='percent'?1:1} max={discountType==='percent'?50:200}
            value={value} onChange={e => setValue(parseInt(e.target.value))}
            className="w-full accent-green-600"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Valid For (days)</label>
          <div className="flex gap-2">
            {[7,14,30,60,90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  days===d ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >{d}d</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Loyalty bonus, apology, etc."
            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleGive} disabled={saving}
            className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 disabled:opacity-50"
          >
            {saving ? 'Sending...' : 'Send Promo 🎁'}
          </button>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('nav_users')}</h1>
        <span className="text-gray-500">{filtered.length} / {users.length} {t('total')}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <div className="flex gap-2 bg-white rounded-xl p-1 border">
          {['all', 'client', 'provider', 'admin'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                roleFilter === r ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('email')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('password')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                        {u.picture
                          ? <img src={u.picture} alt={u.name} className="w-full h-full object-cover" />
                          : <User className="w-4 h-4 text-gray-600" />
                        }
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-600" data-testid={`user-password-${u.user_id}`}>
                      {u.plain_password || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'provider' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {u.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingUser(u); setEditRole(u.role); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Change role"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleBlock(u)}
                        disabled={actionLoading[u.user_id]}
                        className={`p-1.5 rounded-lg ${u.is_blocked ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                        title={u.is_blocked ? 'Unblock user' : 'Block user'}
                      >
                        {actionLoading[u.user_id]
                          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />
                        }
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.user_id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Change Role — {editingUser.name}</h3>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl mb-4"
            >
              <option value="client">Client</option>
              <option value="provider">Provider</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 border rounded-xl text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleRoleSave} className="flex-1 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminBookingsPanel({ bookings, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await api.getUsers('provider');
      setProviders(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'posted' || b.status === 'draft';
    if (filter === 'active') return b.status === 'assigned' || b.status === 'in_progress';
    if (filter === 'completed') return b.status === 'completed' || b.status === 'paid';
    return true;
  });

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await api.updateBookingStatus(bookingId, newStatus);
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Could not update status');
    }
  };

  const handleAssign = async (bookingId, providerId) => {
    try {
      await api.assignBooking(bookingId, { provider_id: providerId });
      onRefresh();
      setSelectedBooking(null);
    } catch (error) {
      console.error('Error assigning booking:', error);
      alert('Could not assign booking');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-700',
      'posted': 'bg-yellow-100 text-yellow-700',
      'assigned': 'bg-blue-100 text-blue-700',
      'in_progress': 'bg-purple-100 text-purple-700',
      'completed': 'bg-green-100 text-green-700',
      'paid': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <span className="text-gray-500">{filteredBookings.length} bookings</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 border">
        {['all', 'pending', 'active', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Service</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No bookings found
                </td>
              </tr>
            ) : (
              filteredBookings.map(booking => (
                <tr key={booking.booking_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{booking.service_id || 'Service'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{booking.client_id}</td>
                  <td className="px-4 py-3">
                    {booking.provider_id ? (
                      <span className="text-blue-600">{booking.provider_id}</span>
                    ) : (
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                      >
                        Assign
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {booking.date} {booking.time}
                  </td>
                  <td className="px-4 py-3 font-medium text-green-600">
                    ${booking.total_price || 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking.booking_id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1"
                    >
                      <option value="draft">Draft</option>
                      <option value="posted">Posted</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Assign Provider</h3>
              <button onClick={() => setSelectedBooking(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {providers.map(provider => (
                <button
                  key={provider.user_id}
                  onClick={() => handleAssign(selectedBooking.booking_id, provider.user_id)}
                  className="w-full p-3 border rounded-xl hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{provider.name}</p>
                      <p className="text-sm text-gray-500">{provider.email}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminServicesPanel({ services, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    category: '',
    base_price: 0,
    main_photo: '',
    available: true
  });

  const handleSave = async () => {
    try {
      if (editingService) {
        await api.updateService(editingService.service_id, newService);
      } else {
        await api.createService(newService);
      }
      setShowModal(false);
      setEditingService(null);
      setNewService({ name: '', description: '', category: '', base_price: 0, main_photo: '', available: true });
      onRefresh();
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Could not save service');
    }
  };

  const handleDelete = async (serviceId) => {
    if (window.confirm('Delete this service?')) {
      try {
        await api.deleteService(serviceId);
        onRefresh();
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const openEdit = (service) => {
    setEditingService(service);
    setNewService({
      name: service.name,
      description: service.description || '',
      category: service.category || '',
      base_price: service.base_price || 0,
      main_photo: service.main_photo || '',
      available: service.available !== false
    });
    setShowModal(true);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewService({...newService, main_photo: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <button
          onClick={() => { setEditingService(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-3 gap-6">
        {services.map(service => (
          <div key={service.service_id} className="bg-white rounded-2xl border overflow-hidden group">
            <div className="h-40 bg-gray-100 relative">
              {service.main_photo ? (
                <img src={service.main_photo} alt={service.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Briefcase className="w-12 h-12 text-gray-300" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(service)}
                  className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  onClick={() => handleDelete(service.service_id)}
                  className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${service.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.available ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-2">{service.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-green-600">${service.base_price || 0}</span>
                {service.category && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{service.category}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {services.length === 0 && (
          <div className="col-span-3 bg-white rounded-2xl border p-12 text-center">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No services yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
            >
              Add First Service
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingService ? 'Edit Service' : 'New Service'}</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                    {newService.main_photo ? (
                      <img src={newService.main_photo} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService({...newService, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="Service name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newService.description}
                  onChange={(e) => setNewService({...newService, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl h-24"
                  placeholder="Service description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newService.category}
                    onChange={(e) => setNewService({...newService, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="">Select category</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="moving">Moving</option>
                    <option value="home">Home Improvement</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="handyman">Handyman</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    value={newService.base_price}
                    onChange={(e) => setNewService({...newService, base_price: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={newService.available}
                  onChange={(e) => setNewService({...newService, available: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="available" className="text-sm text-gray-700">Service is available</label>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
                {editingService ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAnalyticsPanel() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.getDashboard();
      setStats(res.data || res);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2 bg-white rounded-xl p-1 border">
          {['week', 'month', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">${stats?.total_revenue || 0}</p>
          <p className="text-xs text-green-600 mt-2">+12% from last {period}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-sm text-gray-500 mb-1">Commission Earned</p>
          <p className="text-3xl font-bold text-purple-600">${stats?.commission_earned || 0}</p>
          <p className="text-xs text-purple-600 mt-2">Platform earnings</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-sm text-gray-500 mb-1">Avg. Booking Value</p>
          <p className="text-3xl font-bold text-blue-600">${stats?.avg_booking_value || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-sm text-gray-500 mb-1">Completion Rate</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.completion_rate || 95}%</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Bookings Trend</h3>
          <div className="h-48 flex items-end gap-2">
            {[65, 40, 80, 55, 95, 70, 85].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-green-100 rounded-t-lg" style={{height: `${h}%`}}>
                  <div className="w-full h-full bg-green-500 rounded-t-lg opacity-80 hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-xs text-gray-500">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Categories</h3>
          <div className="space-y-4">
            {[
              { name: 'Cleaning', percent: 35, color: 'bg-blue-500' },
              { name: 'Moving', percent: 25, color: 'bg-green-500' },
              { name: 'Handyman', percent: 20, color: 'bg-purple-500' },
              { name: 'Outdoor', percent: 12, color: 'bg-yellow-500' },
              { name: 'Other', percent: 8, color: 'bg-gray-500' },
            ].map(cat => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <span className="text-sm font-medium text-gray-900">{cat.percent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color} rounded-full`} style={{width: `${cat.percent}%`}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Stats */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">User Growth</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-3xl font-bold text-gray-900">{stats?.total_users || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total Users</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-600">{stats?.total_providers || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Active Providers</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{stats?.new_users_this_month || 0}</p>
            <p className="text-sm text-gray-500 mt-1">New This Month</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── General Settings Editor (Commission + Platform Fees) ────────────────────
function GeneralSettingsEditor({ settings, onSaved }) {
  const [form, setForm] = useState({
    admin_commission_percentage: settings.admin_commission_percentage ?? 15,
    apply_admin_commission: settings.apply_admin_commission ?? true,
    fixed_booking_fee: settings.fixed_booking_fee ?? 0,
    min_task_price: settings.min_task_price ?? 10,
    max_search_radius_km: settings.max_search_radius_km ?? 50,
    allow_client_executor_selection: settings.allow_client_executor_selection ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAdminSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  // Live price preview
  const exampleRate = 50;
  const previewFinal = form.apply_admin_commission
    ? (exampleRate * (1 + form.admin_commission_percentage / 100)).toFixed(2)
    : exampleRate.toFixed(2);

  return (
    <div className="space-y-6">
      {/* Commission Card */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Percent className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Platform Commission</h3>
            <p className="text-sm text-gray-500">Percentage added on top of tasker's rate shown to clients</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
          <div>
            <p className="font-medium text-gray-900">Apply Commission</p>
            <p className="text-sm text-gray-500">If off — clients see tasker's base rate directly</p>
          </div>
          <button
            onClick={() => update('apply_admin_commission', !form.apply_admin_commission)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              form.apply_admin_commission ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              form.apply_admin_commission ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Percentage slider */}
        <div className={`space-y-4 transition-opacity ${form.apply_admin_commission ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center justify-between">
            <label className="font-medium text-gray-900">Commission Percentage</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={form.admin_commission_percentage}
                onChange={e => update('admin_commission_percentage', parseFloat(e.target.value) || 0)}
                className="w-20 px-3 py-1.5 border rounded-lg text-right font-bold text-green-600 text-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
              <span className="text-gray-500 font-medium">%</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={form.admin_commission_percentage}
            onChange={e => update('admin_commission_percentage', parseFloat(e.target.value))}
            className="w-full accent-green-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span>
          </div>

          {/* Live preview */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Live Preview</p>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">Tasker base rate (example)</span>
              <span className="font-medium">${exampleRate}/hr</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Platform commission</span>
              <span className="font-medium text-green-600">
                +{form.admin_commission_percentage}% = +${(exampleRate * form.admin_commission_percentage / 100).toFixed(2)}
              </span>
            </div>
            <div className="border-t border-green-200 pt-2 flex items-center justify-between">
              <span className="font-bold text-gray-900">Client sees</span>
              <span className="font-bold text-green-600 text-xl">${previewFinal}/hr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Other platform settings */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900">Platform Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Booking Fee ($)</label>
            <input
              type="number" min="0" step="0.5"
              value={form.fixed_booking_fee}
              onChange={e => update('fixed_booking_fee', parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Flat fee added per booking</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Task Price ($)</label>
            <input
              type="number" min="0" step="1"
              value={form.min_task_price}
              onChange={e => update('min_task_price', parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Search Radius (km)</label>
            <input
              type="number" min="1" step="1"
              value={form.max_search_radius_km}
              onChange={e => update('max_search_radius_km', parseFloat(e.target.value) || 50)}
              className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900 text-sm">Client Tasker Selection</p>
              <p className="text-xs text-gray-500">Clients can choose their own tasker</p>
            </div>
            <button
              onClick={() => update('allow_client_executor_selection', !form.allow_client_executor_selection)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                form.allow_client_executor_selection ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                form.allow_client_executor_selection ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        data-testid="save-settings-btn"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : saved ? (
          <><Check className="w-5 h-5" /> Saved!</>
        ) : (
          <><Check className="w-5 h-5" /> Save Settings</>
        )}
      </button>
    </div>
  );
}

function AdminSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [commissionRules, setCommissionRules] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [activeSection, setActiveSection] = useState('general');
  const [loading, setLoading] = useState(true);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ name: '', commission_type: 'percentage', commission_value: 20, category: '', is_global: true });
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, rulesRes, docsRes, refundsRes] = await Promise.all([
        api.getAdminSettings().catch(() => ({})),
        api.getCommissionRules().catch(() => ({ data: [] })),
        api.getPendingDocuments().catch(() => ({ data: [] })),
        api.getRefunds('requested').catch(() => ({ data: [] }))
      ]);
      setSettings(settingsRes.data || settingsRes);
      setCommissionRules(Array.isArray(rulesRes.data) ? rulesRes.data : (Array.isArray(rulesRes) ? rulesRes : []));
      setPendingDocs(Array.isArray(docsRes.data) ? docsRes.data : (Array.isArray(docsRes) ? docsRes : []));
      setPendingRefunds(Array.isArray(refundsRes.data) ? refundsRes.data : (Array.isArray(refundsRes) ? refundsRes : []));
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoc = async (docId, approved) => {
    setActionLoading(prev => ({ ...prev, [docId]: true }));
    try {
      await api.verifyDocument(docId, approved, approved ? null : 'Rejected by admin');
      setPendingDocs(prev => prev.filter(d => d.document_id !== docId));
    } catch (error) {
      console.error('Error verifying document:', error);
      alert('Could not process verification');
    } finally {
      setActionLoading(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleRefundAction = async (refundId, approved) => {
    setActionLoading(prev => ({ ...prev, [refundId]: true }));
    try {
      await api.approveRefund(refundId, approved, approved ? null : 'Rejected by admin');
      setPendingRefunds(prev => prev.filter(r => r.refund_id !== refundId));
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Could not process refund');
    } finally {
      setActionLoading(prev => ({ ...prev, [refundId]: false }));
    }
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      commission_type: rule.commission_type,
      commission_value: rule.commission_value,
      category: rule.category || '',
      is_global: rule.is_global || false
    });
    setShowCommissionModal(true);
  };

  const openNewRule = () => {
    setEditingRule(null);
    setRuleForm({ name: '', commission_type: 'percentage', commission_value: 20, category: '', is_global: true });
    setShowCommissionModal(true);
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        await api.updateCommissionRule(editingRule.rule_id, ruleForm);
      } else {
        await api.createCommissionRule(ruleForm);
      }
      setShowCommissionModal(false);
      loadSettings();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Could not save rule');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this commission rule?')) return;
    try {
      await api.deleteCommissionRule(ruleId);
      setCommissionRules(prev => prev.filter(r => r.rule_id !== ruleId));
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Could not delete rule');
    }
  };

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'commission', label: 'Commission Rules', icon: Percent },
    { id: 'verification', label: 'Verification', icon: Check },
    { id: 'refunds', label: 'Refunds', icon: DollarSign },
    { id: 'advanced', label: 'Language & Payments', icon: Globe },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Section Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 border overflow-x-auto">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeSection === section.id 
                ? 'bg-green-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
            {section.id === 'verification' && pendingDocs.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingDocs.length}</span>
            )}
            {section.id === 'refunds' && pendingRefunds.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingRefunds.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeSection === 'general' && settings && (
        <GeneralSettingsEditor settings={settings} onSaved={loadSettings} />
      )}

      {/* Commission Rules */}
      {activeSection === 'commission' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Commission Rules</h3>
            <button
              onClick={openNewRule}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>
          {commissionRules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No custom rules. Default commission applies.
            </div>
          ) : (
            <div className="divide-y">
              {commissionRules.map(rule => (
                <div key={rule.rule_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{rule.name}</p>
                    <p className="text-sm text-gray-500">
                      {rule.commission_type === 'percentage' ? `${rule.commission_value}%` : `$${rule.commission_value}`}
                      {rule.is_global && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Global</span>}
                      {rule.category && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{rule.category}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditRule(rule)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit rule"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.rule_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commission Rule Modal */}
      {showCommissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingRule ? 'Edit Rule' : 'New Commission Rule'}</h3>
              <button onClick={() => setShowCommissionModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({...ruleForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="e.g. Cleaning 12%, NYC Special"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={ruleForm.commission_type}
                    onChange={(e) => setRuleForm({...ruleForm, commission_type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {ruleForm.commission_type === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    value={ruleForm.commission_value}
                    onChange={(e) => setRuleForm({...ruleForm, commission_value: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-xl"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <select
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({...ruleForm, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="">All categories</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="moving">Moving</option>
                  <option value="home">Home Improvement</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="handyman">Handyman</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ruleForm.is_global}
                  onChange={(e) => setRuleForm({...ruleForm, is_global: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Apply globally (overrides default)</span>
              </label>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowCommissionModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                {editingRule ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification */}
      {activeSection === 'verification' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Pending Verifications ({pendingDocs.length})</h3>
          </div>
          {pendingDocs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Check className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              No pending documents
            </div>
          ) : (
            <div className="divide-y">
              {pendingDocs.map(doc => (
                <div key={doc.document_id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{doc.user?.name || doc.user_id || 'Unknown user'}</p>
                      <p className="text-sm text-gray-500">{doc.user?.email}</p>
                      <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full capitalize">
                        {(doc.document_type || '').replace('_', ' ')}
                      </span>
                      {doc.file_data && (
                        <a
                          href={doc.file_data}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-green-600 underline"
                        >
                          View document
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleVerifyDoc(doc.document_id, true)}
                        disabled={actionLoading[doc.document_id]}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading[doc.document_id] ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleVerifyDoc(doc.document_id, false)}
                        disabled={actionLoading[doc.document_id]}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refunds */}
      {activeSection === 'refunds' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Refund Requests ({pendingRefunds.length})</h3>
          </div>
          {pendingRefunds.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              No pending refund requests
            </div>
          ) : (
            <div className="divide-y">
              {pendingRefunds.map(refund => (
                <div key={refund.refund_id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-lg">${refund.amount}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{refund.user?.name || refund.user_id || 'User'}</p>
                      <p className="text-sm text-gray-500">Reason: {refund.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Booking: {refund.booking_id} · {new Date(refund.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRefundAction(refund.refund_id, true)}
                        disabled={actionLoading[refund.refund_id]}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading[refund.refund_id] ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleRefundAction(refund.refund_id, false)}
                        disabled={actionLoading[refund.refund_id]}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Advanced Settings - Language & Payments */}
      {activeSection === 'advanced' && (
        <AdvancedSettingsPanel />
      )}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function NewDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Render different dashboard based on user role
  if (user?.role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  if (user?.role === 'provider') {
    return <ProviderDashboard user={user} onLogout={handleLogout} />;
  }

  // Default: Client dashboard
  return <ClientDashboard user={user} onLogout={handleLogout} />;
}
