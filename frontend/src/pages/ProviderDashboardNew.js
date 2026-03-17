import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  Home, MapPin, Calendar, BarChart3, User, Clock, Star, 
  ChevronRight, ChevronLeft, Plus, X, Check, DollarSign,
  FileText, MessageSquare, Sparkles, CreditCard, Gift, HelpCircle,
  Bell, Settings, Award, Target, Navigation, Play, CheckCircle,
  Send, Image, Briefcase, TrendingUp, AlertCircle
} from 'lucide-react';

// ==================== PROVIDER DASHBOARD ====================
export default function ProviderDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, tasksRes, profileRes, availRes] = await Promise.all([
        api.getProviderStats().catch(() => ({})),
        api.getProviderTasks().catch(() => ({ data: [] })),
        api.getExecutorProfile().catch(() => ({})),
        api.getAvailability().catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data || statsRes);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : (Array.isArray(tasksRes) ? tasksRes : []));
      setProfile(profileRes.data || profileRes);
      setAvailability(Array.isArray(availRes.data) ? availRes.data : []);
    } catch (error) {
      console.error('Error loading provider data:', error);
    }
  };

  const menuItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'tasks', icon: MapPin, label: 'Tasks' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'performance', icon: BarChart3, label: 'Performance' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          HandyHub
        </h1>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-gray-100 rounded-full text-red-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-24 overflow-y-auto">
        {activeTab === 'home' && <ProviderHome stats={stats} tasks={tasks} user={user} onRefresh={loadData} />}
        {activeTab === 'tasks' && <ProviderTasks tasks={tasks} onRefresh={loadData} />}
        {activeTab === 'calendar' && <ProviderCalendar availability={availability} onRefresh={loadData} />}
        {activeTab === 'performance' && <ProviderPerformance stats={stats} profile={profile} />}
        {activeTab === 'profile' && <ProviderProfile user={user} profile={profile} onRefresh={loadData} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex justify-around">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
              activeTab === item.id ? 'text-green-600' : 'text-gray-500'
            }`}
            data-testid={`provider-nav-${item.id}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ==================== PROVIDER HOME ====================
function ProviderHome({ stats, tasks, user, onRefresh }) {
  const activeTasks = tasks.filter(t => 
    t.status === 'assigned' || t.status === 'in_progress' || t.status === 'on_the_way'
  );
  const pendingTasks = tasks.filter(t => t.status === 'posted' || t.status === 'offering');

  const handleTaskAction = async (taskId, action) => {
    try {
      if (action === 'accept') {
        await api.acceptTask(taskId);
      } else if (action === 'on_the_way') {
        await api.updateTaskStatus(taskId, 'on_the_way');
      } else if (action === 'start') {
        await api.updateTaskStatus(taskId, 'in_progress');
      } else if (action === 'complete') {
        await api.updateTaskStatus(taskId, 'completed');
      }
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Could not update task');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-1">Hello, {user?.name?.split(' ')[0] || 'Tasker'}!</h2>
        <p className="text-green-100">Ready for today's tasks?</p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-3xl font-bold">${stats?.stats?.total_earnings || 0}</p>
            <p className="text-sm text-green-100">This month</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{stats?.stats?.total_completed_tasks || 0}</p>
            <p className="text-sm text-green-100">Tasks done</p>
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Today's Tasks</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            {activeTasks.length} active
          </span>
        </div>
        <div className="divide-y">
          {activeTasks.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Target className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No active tasks</p>
            </div>
          ) : (
            activeTasks.map(task => (
              <TaskCard key={task.task_id} task={task} onAction={handleTaskAction} />
            ))
          )}
        </div>
      </div>

      {/* New Task Requests */}
      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between bg-yellow-50">
            <h3 className="font-semibold text-gray-900">New Requests</h3>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
              {pendingTasks.length} pending
            </span>
          </div>
          <div className="divide-y">
            {pendingTasks.map(task => (
              <TaskCard key={task.task_id} task={task} onAction={handleTaskAction} isNew />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ task, onAction, isNew }) {
  const getStatusColor = (status) => {
    const colors = {
      'posted': 'bg-yellow-100 text-yellow-700',
      'assigned': 'bg-blue-100 text-blue-700',
      'on_the_way': 'bg-purple-100 text-purple-700',
      'in_progress': 'bg-orange-100 text-orange-700',
      'completed': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getNextAction = (status) => {
    if (status === 'posted' || status === 'offering') return { action: 'accept', label: 'Accept', icon: Check };
    if (status === 'assigned') return { action: 'on_the_way', label: 'On my way', icon: Navigation };
    if (status === 'on_the_way') return { action: 'start', label: 'Start Job', icon: Play };
    if (status === 'in_progress') return { action: 'complete', label: 'Complete', icon: CheckCircle };
    return null;
  };

  const nextAction = getNextAction(task.status);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{task.title}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {task.address || 'Address TBD'}
          </p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" />
            {task.date} at {task.time}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">${task.price || task.total_price || 0}</p>
          {task.estimated_hours && (
            <p className="text-xs text-gray-500">{task.estimated_hours}h</p>
          )}
        </div>
      </div>
      
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {nextAction && (
        <button
          onClick={() => onAction(task.task_id, nextAction.action)}
          className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
            isNew 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          <nextAction.icon className="w-5 h-5" />
          {nextAction.label}
        </button>
      )}
    </div>
  );
}

// ==================== PROVIDER TASKS ====================
function ProviderTasks({ tasks, onRefresh }) {
  const [filter, setFilter] = useState('available');
  const [selectedTask, setSelectedTask] = useState(null);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'available') return t.status === 'posted' || t.status === 'offering';
    if (filter === 'active') return ['assigned', 'on_the_way', 'in_progress'].includes(t.status);
    if (filter === 'past') return ['completed', 'paid', 'cancelled'].includes(t.status);
    return true;
  });

  const handleAction = async (taskId, action) => {
    try {
      if (action === 'accept') {
        await api.acceptTask(taskId);
      } else {
        await api.updateTaskStatus(taskId, action);
      }
      onRefresh();
      setSelectedTask(null);
    } catch (error) {
      console.error('Error:', error);
      alert('Action failed');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Filter Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 border">
        {[
          { id: 'available', label: 'Available' },
          { id: 'active', label: 'Active' },
          { id: 'past', label: 'Past' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No {filter} tasks</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div
              key={task.task_id}
              onClick={() => setSelectedTask(task)}
              className="bg-white rounded-2xl p-4 border cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{task.title}</h4>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {task.address || 'Location TBD'}
                  </p>
                </div>
                <span className="text-lg font-bold text-green-600">${task.price || task.total_price || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{task.date} at {task.time}</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}

// Task Detail Modal
function TaskDetailModal({ task, onClose, onAction }) {
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');

  const getActions = (status) => {
    const actions = [];
    if (status === 'posted' || status === 'offering') {
      actions.push({ id: 'accept', label: 'Accept Task', icon: Check, color: 'bg-green-600' });
    }
    if (status === 'assigned') {
      actions.push({ id: 'on_the_way', label: "I'm On My Way", icon: Navigation, color: 'bg-blue-600' });
    }
    if (status === 'on_the_way') {
      actions.push({ id: 'in_progress', label: 'Start Job', icon: Play, color: 'bg-orange-600' });
    }
    if (status === 'in_progress') {
      actions.push({ id: 'completed', label: 'Complete & Invoice', icon: CheckCircle, color: 'bg-green-600' });
    }
    return actions;
  };

  const actions = getActions(task.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-gray-900">Task Details</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Map placeholder */}
          <div className="h-32 bg-gray-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>

          {/* Task Info */}
          <div>
            <h4 className="text-lg font-bold text-gray-900">{task.title}</h4>
            <p className="text-sm text-gray-500 mt-1">{task.address}</p>
          </div>

          {/* Price & Time */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
            <div>
              <p className="text-sm text-gray-600">Hourly Rate</p>
              <p className="text-xl font-bold text-green-600">${task.hourly_rate || 50}/hr</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Estimated</p>
              <p className="font-semibold text-gray-900">{task.estimated_hours || 2} hours</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setShowChat(false)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                !showChat ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'
              }`}
            >
              Task Details
            </button>
            <button
              onClick={() => setShowChat(true)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                showChat ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'
              }`}
            >
              Chat
            </button>
          </div>

          {!showChat ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="text-gray-900">{task.description || 'No description provided'}</p>
              </div>
              {task.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Client Notes</p>
                  <p className="text-gray-900">{task.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Schedule</p>
                <p className="text-gray-900">{task.date} at {task.time}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Chat messages placeholder */}
              <div className="h-40 bg-gray-50 rounded-xl p-3 overflow-y-auto">
                <p className="text-sm text-gray-500 text-center">No messages yet</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border rounded-xl"
                />
                <button className="p-2 bg-green-600 text-white rounded-xl">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-2">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onAction(task.task_id, action.id)}
              className={`w-full py-3 ${action.color} text-white rounded-xl font-medium flex items-center justify-center gap-2`}
            >
              <action.icon className="w-5 h-5" />
              {action.label}
            </button>
          ))}
          {task.status !== 'posted' && (
            <button className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">
              Add to Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== PROVIDER CALENDAR ====================
function ProviderCalendar({ availability, onRefresh }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({ start: '09:00', end: '17:00', recurring: false });

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

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

  const handleAddSlot = async () => {
    try {
      await api.addAvailability({
        date: selectedDate.toISOString().split('T')[0],
        start_time: newSlot.start,
        end_time: newSlot.end,
        day_of_week: selectedDate.getDay(),
        is_recurring: newSlot.recurring
      });
      setShowAddSlot(false);
      onRefresh();
    } catch (error) {
      console.error('Error adding slot:', error);
      alert('Could not add availability');
    }
  };

  const prevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };

  const nextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Set Availability</h3>
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Week Selector */}
        <div className="flex border-b">
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex-1 py-3 text-center transition-colors ${
                  isSelected ? 'bg-green-600 text-white' : isToday ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs font-medium ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
                  {days[date.getDay()]}
                </p>
                <p className={`text-lg font-bold ${isSelected ? '' : 'text-gray-900'}`}>
                  {date.getDate()}
                </p>
              </button>
            );
          })}
        </div>

        {/* Time Slots */}
        <div className="divide-y max-h-80 overflow-y-auto">
          {hours.map(hour => {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            const hasSlot = availability.some(s => {
              const slotDate = new Date(s.date);
              return slotDate.toDateString() === selectedDate.toDateString() &&
                s.start_time <= timeStr && s.end_time > timeStr;
            });
            
            return (
              <div
                key={hour}
                className={`flex items-center px-4 py-3 ${hasSlot ? 'bg-green-50' : 'hover:bg-gray-50'}`}
              >
                <span className="w-16 text-sm text-gray-500">
                  {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                </span>
                <div className={`flex-1 h-8 mx-4 rounded ${hasSlot ? 'bg-green-200' : 'bg-gray-100'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Availability Button */}
      <button
        onClick={() => setShowAddSlot(true)}
        className="w-full py-4 bg-green-600 text-white rounded-2xl font-medium hover:bg-green-700 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Availability
      </button>

      {/* Add Slot Modal */}
      {showAddSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Availability</h3>
              <button onClick={() => setShowAddSlot(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date: {selectedDate.toLocaleDateString()}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <select
                    value={newSlot.start}
                    onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    {hours.map(h => (
                      <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                        {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <select
                    value={newSlot.end}
                    onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    {hours.map(h => (
                      <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                        {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newSlot.recurring}
                  onChange={(e) => setNewSlot({ ...newSlot, recurring: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  Repeat weekly on {days[selectedDate.getDay()]}s
                </label>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowAddSlot(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSlot}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PROVIDER PERFORMANCE ====================
function ProviderPerformance({ stats, profile }) {
  const earnings = stats?.stats || {};
  const analytics = stats?.analytics || {};

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Performance</h2>

      {/* Earnings Card */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Earnings</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-xl font-bold text-green-600">${earnings.today_earnings || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">This Week</p>
            <p className="text-xl font-bold text-green-600">${earnings.week_earnings || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">This Month</p>
            <p className="text-xl font-bold text-green-600">${earnings.total_earnings || 0}</p>
          </div>
        </div>
      </div>

      {/* Reviews Card */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Reviews</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-center gap-4">
          <p className="text-3xl font-bold text-gray-900">{earnings.average_rating || '5.0'}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                className={`w-5 h-5 ${
                  i <= Math.floor(earnings.average_rating || 5)
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-gray-500">({earnings.total_reviews || 0} reviews)</span>
        </div>
      </div>

      {/* Analytics Card */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Analytics</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 mb-4">
          See how you compare to other Taskers in your area
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Search Position</p>
            <p className="text-2xl font-bold text-green-600">#{analytics.search_position || 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Response Rate</p>
            <p className="text-2xl font-bold text-green-600">{analytics.response_rate || 95}%</p>
          </div>
        </div>
      </div>

      {/* Skills & Rates Card */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Skills & Rates</h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Active Skills</span>
          <span className="font-bold text-gray-900">{profile?.skills?.length || 0}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-gray-600">Hourly Rate</span>
          <span className="font-bold text-green-600">${profile?.hourly_rate || 25}/hr</span>
        </div>
      </div>

      {/* Elite Status Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600" />
            Elite Status
          </h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Complete milestones to unlock Elite benefits
        </p>
        <div className="bg-white rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-medium text-green-600">2/4 milestones</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-green-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Challenges Card */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" />
            Challenges
          </h3>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">Complete 5 tasks</p>
              <p className="text-xs text-gray-500">Earn $25 bonus</p>
            </div>
            <span className="text-sm font-medium text-orange-600">3/5</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== PROVIDER PROFILE ====================
function ProviderProfile({ user, profile, onRefresh }) {
  const [activeSection, setActiveSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [documents, setDocuments] = useState([]);
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
      setDocuments(Array.isArray(docsRes?.data) ? docsRes.data : []);
      setPayoutAccounts(Array.isArray(payoutsRes?.data) ? payoutsRes.data : []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSave = async (data) => {
    try {
      await api.updateProfile(data);
      onRefresh();
      setActiveSection(null);
      alert('Saved!');
    } catch (error) {
      alert('Could not save');
    }
  };

  const accountMenuItems = [
    { id: 'account', icon: User, label: 'Account details', desc: 'Name, email, phone' },
    { id: 'tasker-profile', icon: FileText, label: 'Tasker profile', desc: 'Bio, skills, rates' },
    { id: 'documents', icon: FileText, label: 'Verification', desc: 'ID, certificates' },
    { id: 'calendar-sync', icon: Calendar, label: 'Sync calendar', desc: 'Google, Apple' },
    { id: 'templates', icon: MessageSquare, label: 'Chat templates', desc: 'Quick responses' },
    { id: 'promote', icon: Sparkles, label: 'Promote yourself', desc: 'Boost visibility' },
    { id: 'payments', icon: CreditCard, label: 'Payments', desc: 'Payout accounts' },
    { id: 'invite', icon: Gift, label: 'Invite friends', desc: 'Earn $50', highlight: true },
  ];

  const settingsMenuItems = [
    { id: 'support', icon: HelpCircle, label: 'Support' },
    { id: 'security', icon: Settings, label: 'Account security' },
    { id: 'about', icon: AlertCircle, label: 'About' },
  ];

  // Render sub-sections
  if (activeSection === 'account') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Account Details</h2>
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              defaultValue={user?.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" defaultValue={user?.email} disabled className="w-full px-4 py-3 border rounded-xl bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              defaultValue={user?.phone}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <button onClick={() => handleSave(editData)} className="w-full py-3 bg-green-600 text-white rounded-xl font-medium">
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  if (activeSection === 'tasker-profile') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Tasker Profile</h2>
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              defaultValue={profile?.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl h-32"
              placeholder="Tell clients about yourself..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              defaultValue={profile?.hourly_rate || 25}
              onChange={(e) => setEditData({ ...editData, hourly_rate: parseFloat(e.target.value) })}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
            <input
              type="number"
              defaultValue={profile?.experience_years || 0}
              onChange={(e) => setEditData({ ...editData, experience_years: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Radius (km)</label>
            <input
              type="number"
              defaultValue={profile?.service_radius_km || 25}
              onChange={(e) => setEditData({ ...editData, service_radius_km: parseFloat(e.target.value) })}
              className="w-full px-4 py-3 border rounded-xl"
            />
          </div>
          <button onClick={() => handleSave(editData)} className="w-full py-3 bg-green-600 text-white rounded-xl font-medium">
            Save Profile
          </button>
        </div>
      </div>
    );
  }

  if (activeSection === 'documents') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Verification Documents</h2>
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold mb-4">Upload Document</h3>
          <div className="grid grid-cols-2 gap-4">
            {['id_card', 'passport', 'drivers_license', 'insurance', 'certificate'].map(type => (
              <label key={type} className="flex flex-col items-center p-4 border-2 border-dashed rounded-xl hover:border-green-500 cursor-pointer">
                <FileText className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 capitalize text-center">{type.replace('_', ' ')}</span>
                <input type="file" accept="image/*" className="hidden" />
              </label>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">My Documents</h3></div>
          {documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No documents uploaded</div>
          ) : (
            <div className="divide-y">
              {documents.map(doc => (
                <div key={doc.document_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium capitalize">{doc.document_type.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-500">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                    doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{doc.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeSection === 'payments') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Payment Settings</h2>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Payout Accounts</h3>
            <button className="text-sm text-green-600 font-medium">+ Add</button>
          </div>
          {payoutAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No payout accounts</p>
            </div>
          ) : (
            <div className="divide-y">
              {payoutAccounts.map(acc => (
                <div key={acc.account_id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{acc.bank_name || 'Bank Account'}</p>
                      <p className="text-sm text-gray-500">****{acc.account_number_last4}</p>
                    </div>
                  </div>
                  {acc.is_default && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Default</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeSection === 'templates') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button onClick={() => setActiveSection(null)} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-xl font-bold text-gray-900">Chat Templates</h2>
        <div className="bg-white rounded-2xl border p-6">
          <p className="text-gray-500 mb-4">Create quick responses to save time</p>
          <div className="space-y-3">
            {[
              "Hi! I'm on my way. See you soon!",
              "I've arrived at your location.",
              "The job is complete. Thank you!",
              "I'll need about 30 more minutes."
            ].map((template, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <span className="text-sm text-gray-700">{template}</span>
                <button className="text-blue-600"><Edit className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-3 border-2 border-dashed rounded-xl text-gray-500 hover:border-green-500 hover:text-green-600">
            + Add Template
          </button>
        </div>
      </div>
    );
  }

  // Main Profile Menu
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Profile</h2>

      {/* User Info */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{user?.name}</h3>
            <p className="text-gray-500">{user?.email}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full mt-1">
                <Check className="w-3 h-3" /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">Account Information</p>
        <div className="divide-y">
          {accountMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 ${item.highlight ? 'bg-green-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${item.highlight ? 'text-green-600' : 'text-gray-600'}`} />
                <div className="text-left">
                  <span className={`font-medium block ${item.highlight ? 'text-green-700' : 'text-gray-900'}`}>{item.label}</span>
                  {item.desc && <span className="text-xs text-gray-500">{item.desc}</span>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">Settings</p>
        <div className="divide-y">
          {settingsMenuItems.map(item => (
            <button key={item.id} className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
