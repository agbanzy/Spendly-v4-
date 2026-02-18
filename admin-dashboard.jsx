import React, { useState, useReducer } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Menu, X, LogOut, Bell, Settings, Search, Filter, ChevronDown, Plus, Eye, Edit,
  Trash2, Download, Upload, Lock, Unlock, CreditCard, TrendingUp, Users, Wallet,
  Clock, AlertCircle, CheckCircle, XCircle, FileText, DollarSign, Home, Shield,
  BarChart3, Activity, Zap, Pause, Play, RefreshCw, ArrowUpRight, ArrowDownLeft,
  Calendar, Flag, MoreVertical, Send, Phone, Mail, MapPin, Building2, Briefcase,
  Euro, DollarSign as Dollar, PoundSterling, Code, Layers, Key, Database, Power,
  ChevronRight, ChevronLeft, Maximize2, Minimize2
} from 'lucide-react';

// Mock data generators
const generateUsers = () => {
  const roles = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'EMPLOYEE', 'VIEWER'];
  const companies = ['Acme Corp', 'TechFlow Inc', 'Global Solutions', 'Innovate Ltd', 'Future Systems'];
  const kycStatuses = ['APPROVED', 'PENDING', 'REJECTED'];

  return Array.from({ length: 15 }, (_, i) => ({
    id: `USR-${String(i + 1).padStart(5, '0')}`,
    name: `${['John', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'James', 'Rachel', 'Daniel', 'Olivia', 'Robert', 'Sophie', 'William', 'Alice', 'Charles'][i % 15]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'][Math.floor(i / 3)]}`,
    email: `user${i + 1}@spendly.com`,
    role: roles[i % roles.length],
    company: companies[i % companies.length],
    kycStatus: kycStatuses[Math.floor(Math.random() * kycStatuses.length)],
    walletBalance: (Math.random() * 50000 + 1000).toFixed(2),
    lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    status: Math.random() > 0.2 ? 'ACTIVE' : 'SUSPENDED'
  }));
};

const generateTransactions = () => {
  const types = ['TRANSFER', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'REFUND'];
  const statuses = ['COMPLETED', 'PENDING', 'FAILED'];
  const descriptions = [
    'Salary Deposit', 'Office Supplies', 'Client Invoice', 'Monthly Rent',
    'Equipment Purchase', 'Software License', 'Travel Reimbursement', 'Service Fee'
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `TXN-${String(i + 1).padStart(8, '0')}`,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    type: types[Math.floor(Math.random() * types.length)],
    amount: (Math.random() * 10000 + 100).toFixed(2),
    fee: (Math.random() * 50 + 1).toFixed(2),
    currency: ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    user: `User ${Math.floor(Math.random() * 100) + 1}`
  }));
};

const generateRevenueData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(month => ({
    month,
    revenue: Math.floor(Math.random() * 50000 + 10000),
    transactions: Math.floor(Math.random() * 1000 + 200)
  }));
};

const generateExpenses = () => {
  const merchants = ['Amazon', 'Stripe', 'AWS', 'Adobe', 'Slack', 'Office Depot', 'Uber', 'Restaurant XYZ'];
  const categories = ['SOFTWARE', 'SUPPLIES', 'TRAVEL', 'MEALS', 'EQUIPMENT', 'SERVICES'];
  const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];

  return Array.from({ length: 12 }, (_, i) => ({
    id: `EXP-${String(i + 1).padStart(6, '0')}`,
    merchant: merchants[i % merchants.length],
    amount: (Math.random() * 2000 + 50).toFixed(2),
    category: categories[Math.floor(Math.random() * categories.length)],
    user: `User ${Math.floor(Math.random() * 50) + 1}`,
    date: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    receipt: Math.random() > 0.3
  }));
};

const generateKYCData = () => {
  const statuses = ['PENDING', 'APPROVED', 'REJECTED'];
  const idTypes = ['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'VOTERS_ID'];
  const nationalities = ['US', 'UK', 'CA', 'AU', 'NG', 'GH', 'KE'];

  return Array.from({ length: 8 }, (_, i) => ({
    id: `KYC-${String(i + 1).padStart(6, '0')}`,
    name: `Applicant ${i + 1}`,
    email: `applicant${i + 1}@test.com`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    idType: idTypes[Math.floor(Math.random() * idTypes.length)],
    nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
    submissionDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    businessType: Math.random() > 0.5 ? 'BUSINESS' : 'PERSONAL'
  }));
};

const generateWallets = () => {
  const types = ['PRIMARY', 'SAVINGS', 'ESCROW', 'VIRTUAL'];
  const currencies = ['USD', 'EUR', 'GBP', 'NGN'];

  return Array.from({ length: 10 }, (_, i) => ({
    id: `WAL-${String(i + 1).padStart(6, '0')}`,
    user: `User ${i + 1}`,
    type: types[i % types.length],
    currency: currencies[Math.floor(Math.random() * currencies.length)],
    balance: (Math.random() * 100000 + 5000).toFixed(2),
    available: (Math.random() * 80000 + 1000).toFixed(2),
    pending: (Math.random() * 20000).toFixed(2),
    status: Math.random() > 0.1 ? 'ACTIVE' : 'FROZEN'
  }));
};

const generateCards = () => {
  const types = ['VIRTUAL', 'PHYSICAL', 'DEBIT'];
  const statuses = ['ACTIVE', 'FROZEN', 'CANCELLED'];

  return Array.from({ length: 12 }, (_, i) => ({
    id: `CARD-${String(i + 1).padStart(6, '0')}`,
    name: `Card ${i + 1}`,
    last4: String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
    balance: (Math.random() * 50000 + 1000).toFixed(2),
    limit: (Math.random() * 100000 + 10000).toFixed(2),
    type: types[Math.floor(Math.random() * types.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    user: `User ${Math.floor(Math.random() * 50) + 1}`
  }));
};

const generatePayroll = () => {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Operations'];

  return Array.from({ length: 10 }, (_, i) => ({
    id: `EMP-${String(i + 1).padStart(5, '0')}`,
    employee: `Employee ${i + 1}`,
    department: departments[Math.floor(Math.random() * departments.length)],
    salary: (Math.random() * 60000 + 40000).toFixed(2),
    bonus: (Math.random() * 10000).toFixed(2),
    deductions: (Math.random() * 5000).toFixed(2),
    status: ['PROCESSED', 'PENDING'][Math.floor(Math.random() * 2)],
    bankInfo: `****${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
  }));
};

const generateExchangeRates = () => {
  return [
    { pair: 'USD/EUR', market: 0.92, buy: 0.91, sell: 0.93, markup: 2.2 },
    { pair: 'USD/GBP', market: 0.79, buy: 0.78, sell: 0.80, markup: 2.5 },
    { pair: 'USD/NGN', market: 1550, buy: 1540, sell: 1560, markup: 1.3 },
    { pair: 'EUR/GBP', market: 0.86, buy: 0.85, sell: 0.87, markup: 2.3 },
    { pair: 'GBP/NGN', market: 1960, buy: 1945, sell: 1975, markup: 1.5 },
  ];
};

const generateAuditLogs = () => {
  const actions = ['LOGIN', 'APPROVE_EXPENSE', 'CREATE_USER', 'SUSPEND_USER', 'TRANSFER_FUNDS', 'EDIT_SETTINGS'];
  const entityTypes = ['USER', 'TRANSACTION', 'WALLET', 'EXPENSE', 'CARD'];

  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toLocaleString(),
    user: `Admin ${Math.floor(Math.random() * 5) + 1}`,
    action: actions[Math.floor(Math.random() * actions.length)],
    entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
    entityId: `ID-${Math.floor(Math.random() * 10000)}`,
    ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    details: 'Action completed successfully'
  }));
};

// Utility Components
const StatusBadge = ({ status, type = 'status' }) => {
  const configs = {
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
    SUSPENDED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspended' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Approved' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
    PAID: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Paid' },
    UNPAID: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Unpaid' },
    OVERDUE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue' },
    FROZEN: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Frozen' },
    PROCESSED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Processed' }
  };
  const config = configs[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  return <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>{config.label}</span>;
};

const RoleBadge = ({ role }) => {
  const configs = {
    OWNER: { bg: 'bg-purple-100', text: 'text-purple-800' },
    ADMIN: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    MANAGER: { bg: 'bg-blue-100', text: 'text-blue-800' },
    EDITOR: { bg: 'bg-teal-100', text: 'text-teal-800' },
    EMPLOYEE: { bg: 'bg-gray-100', text: 'text-gray-800' },
    VIEWER: { bg: 'bg-slate-100', text: 'text-slate-800' }
  };
  const config = configs[role] || configs.VIEWER;
  return <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>{role}</span>;
};

const MetricCard = ({ icon: Icon, label, value, change, changeType = 'positive' }) => (
  <div className="bg-white rounded-lg p-6 border border-gray-200">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        {change && (
          <p className={`text-xs mt-2 ${changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
            {changeType === 'positive' ? '↑' : '↓'} {change} from last month
          </p>
        )}
      </div>
      <div className="bg-indigo-50 p-3 rounded-lg">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
    </div>
  </div>
);

const Modal = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// Page Components
const OverviewPage = () => {
  const users = generateUsers();
  const transactions = generateTransactions();
  const revenues = generateRevenueData();
  const expenses = generateExpenses();

  const recentActivities = [
    { id: 1, type: 'APPROVAL', message: 'Expense approval by John Smith', time: '2 mins ago' },
    { id: 2, type: 'TRANSACTION', message: 'Transfer to Acme Corp completed', time: '15 mins ago' },
    { id: 3, type: 'USER', message: 'New user Sarah Johnson registered', time: '1 hour ago' },
    { id: 4, type: 'KYC', message: 'KYC verification completed for Emma Wilson', time: '2 hours ago' },
    { id: 5, type: 'PAYMENT', message: 'Payroll processed for 45 employees', time: '3 hours ago' },
    { id: 6, type: 'ALERT', message: 'High transaction volume detected', time: '4 hours ago' },
    { id: 7, type: 'CARD', message: 'Virtual card issued to Michael Brown', time: '5 hours ago' },
    { id: 8, type: 'WALLET', message: 'Wallet balance alert for User 42', time: '6 hours ago' },
    { id: 9, type: 'INVOICE', message: 'Invoice paid by TechFlow Inc', time: '7 hours ago' },
    { id: 10, type: 'SECURITY', message: 'Failed login attempt blocked', time: '8 hours ago' }
  ];

  const systemHealth = [
    { metric: 'API Uptime', value: '99.99%', status: 'healthy' },
    { metric: 'Database', value: 'Optimal', status: 'healthy' },
    { metric: 'Payment Gateway', value: 'Connected', status: 'healthy' },
    { metric: 'Message Queue', value: '0 errors', status: 'healthy' },
    { metric: 'Cache Hit Rate', value: '94.2%', status: 'healthy' },
    { metric: 'Avg Response Time', value: '142ms', status: 'healthy' }
  ];

  const quickActions = [
    { icon: CheckCircle, label: 'Approve Expenses', count: 12 },
    { icon: Activity, label: 'Process Payroll', count: 45 },
    { icon: Shield, label: 'Review KYC', count: 8 },
    { icon: Euro, label: 'Exchange Rates', count: '5 pairs' },
    { icon: Lock, label: 'Audit Logs', count: '1.2k' },
    { icon: Settings, label: 'System Settings', count: 'Config' }
  ];

  return (
    <div className="space-y-8">
      {/* Top Metrics */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard icon={Users} label="Total Users" value={users.length} change="12%" />
        <MetricCard icon={Wallet} label="Active Wallets" value="3,284" change="8%" />
        <MetricCard icon={Activity} label="Transactions Today" value="542" change="15%" />
        <MetricCard icon={AlertCircle} label="Pending Approvals" value="23" changeType="negative" change="35%" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trend (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenues}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivities.map(activity => (
              <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
                <div className="flex-shrink-0 w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">System Health</h3>
          <div className="space-y-4">
            {systemHealth.map((health, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{health.metric}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{health.value}</span>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-6 gap-4">
          {quickActions.map((action, idx) => (
            <button key={idx} className="bg-white rounded-lg p-6 border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all text-center group">
              <div className="bg-indigo-50 p-3 rounded-lg mx-auto mb-3 group-hover:bg-indigo-100">
                <action.icon className="w-6 h-6 text-indigo-600 mx-auto" />
              </div>
              <p className="text-sm font-medium text-gray-900">{action.label}</p>
              <p className="text-lg font-bold text-indigo-600 mt-2">{action.count}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const UserManagementPage = () => {
  const [users, setUsers] = useState(generateUsers());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedUser, setExpandedUser] = useState(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
                         user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="EDITOR">Editor</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">KYC Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Wallet Balance</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{user.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.company}</td>
                <td className="px-6 py-4"><StatusBadge status={user.kycStatus} /></td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${user.walletBalance}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.lastLogin}</td>
                <td className="px-6 py-4"><StatusBadge status={user.status} /></td>
                <td className="px-6 py-4">
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const KYCVerificationPage = () => {
  const [kycData, setKycData] = useState(generateKYCData());
  const [selectedTab, setSelectedTab] = useState('PENDING');
  const [selectedKYC, setSelectedKYC] = useState(null);

  const filteredKYC = selectedTab === 'ALL' ? kycData : kycData.filter(k => k.status === selectedTab);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Pending Review</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{kycData.filter(k => k.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Avg Review Time</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">2.3 days</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Approval Rate</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">94.2%</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              selectedTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {filteredKYC.map(kyc => (
          <button
            key={kyc.id}
            onClick={() => setSelectedKYC(kyc)}
            className="bg-white rounded-lg p-6 border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{kyc.name}</h4>
                <p className="text-sm text-gray-600">{kyc.email}</p>
                <p className="text-xs text-gray-500 mt-2">{kyc.submissionDate}</p>
                <div className="flex gap-2 mt-3">
                  <StatusBadge status={kyc.status} />
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{kyc.idType}</span>
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{kyc.businessType}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedKYC && (
        <Modal isOpen={true} title="KYC Details" onClose={() => setSelectedKYC(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-600 uppercase">Name</p>
              <p className="text-sm font-medium text-gray-900">{selectedKYC.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Email</p>
              <p className="text-sm font-medium text-gray-900">{selectedKYC.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">ID Type</p>
              <p className="text-sm font-medium text-gray-900">{selectedKYC.idType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Nationality</p>
              <p className="text-sm font-medium text-gray-900">{selectedKYC.nationality}</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-900 mb-2">Review Notes</label>
              <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="3" placeholder="Add notes..."></textarea>
            </div>
            <div className="flex gap-3 pt-4">
              <button className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Approve</button>
              <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Reject</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const WalletFinancePage = () => {
  const [wallets, setWallets] = useState(generateWallets());
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Total Local Currency</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">$847,234.50</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Total USD</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">$623,412.75</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Total Escrow</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">$112,856.20</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">User</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Wallet ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Currency</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Balance</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Available</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Pending</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(wallet => (
              <tr key={wallet.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">{wallet.user}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{wallet.id}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{wallet.type}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{wallet.currency}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${wallet.balance}</td>
                <td className="px-6 py-4 text-sm text-emerald-600">${wallet.available}</td>
                <td className="px-6 py-4 text-sm text-amber-600">${wallet.pending}</td>
                <td className="px-6 py-4"><StatusBadge status={wallet.status} /></td>
                <td className="px-6 py-4">
                  <button onClick={() => { setSelectedWallet(wallet); setShowCreditModal(true); }} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    Credit/Debit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreditModal && (
        <Modal isOpen={true} title={`Credit/Debit - ${selectedWallet?.id}`} onClose={() => setShowCreditModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>Credit</option>
                <option>Debit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Amount</label>
              <input type="number" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
              <input type="text" placeholder="Description" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Process</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState(generateTransactions());
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredTransactions = typeFilter === 'ALL' ? transactions : transactions.filter(t => t.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <input type="date" className="px-4 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="date" className="px-4 py-2 border border-gray-300 rounded-lg text-sm" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="ALL">All Types</option>
          <option value="TRANSFER">Transfer</option>
          <option value="PAYMENT">Payment</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="DEPOSIT">Deposit</option>
          <option value="REFUND">Refund</option>
        </select>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Fee</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Currency</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Description</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">User</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(txn => (
              <tr key={txn.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedTransaction(txn)}>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">{txn.id}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{txn.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.type}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${txn.amount}</td>
                <td className="px-6 py-4 text-sm text-gray-600">${txn.fee}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.currency}</td>
                <td className="px-6 py-4"><StatusBadge status={txn.status} /></td>
                <td className="px-6 py-4 text-sm text-gray-600">{txn.description}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{txn.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTransaction && (
        <Modal isOpen={true} title={`Transaction Details`} onClose={() => setSelectedTransaction(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 uppercase">ID</p>
                <p className="text-sm font-medium text-gray-900">{selectedTransaction.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Date</p>
                <p className="text-sm font-medium text-gray-900">{selectedTransaction.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Amount</p>
                <p className="text-sm font-medium text-gray-900">${selectedTransaction.amount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase">Status</p>
                <div className="mt-1"><StatusBadge status={selectedTransaction.status} /></div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ExpensesApprovalsPage = () => {
  const [expenses, setExpenses] = useState(generateExpenses());
  const [selectedTab, setSelectedTab] = useState('PENDING');

  const filteredExpenses = selectedTab === 'ALL' ? expenses : expenses.filter(e => e.status === selectedTab);
  const pendingCount = expenses.filter(e => e.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200">
        {['PENDING', 'ALL'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              selectedTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab} {tab === 'PENDING' && `(${pendingCount})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {filteredExpenses.map(expense => (
          <div key={expense.id} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">{expense.merchant}</h4>
                <p className="text-sm text-gray-600 mt-1">{expense.user}</p>
              </div>
              <StatusBadge status={expense.status} />
            </div>
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount</span>
                <span className="text-sm font-medium text-gray-900">${expense.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Category</span>
                <span className="text-sm font-medium text-gray-900">{expense.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Date</span>
                <span className="text-sm font-medium text-gray-900">{expense.date}</span>
              </div>
            </div>
            {expense.status === 'PENDING' && (
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Approve</button>
                <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const BillsPaymentsPage = () => {
  const [bills] = useState([
    { id: 'BILL-001', vendor: 'AWS', amount: 2450.00, dueDate: '2025-03-15', status: 'UNPAID', category: 'Cloud Services' },
    { id: 'BILL-002', vendor: 'Office Electricity', amount: 850.50, dueDate: '2025-02-28', status: 'OVERDUE', category: 'Utilities' },
    { id: 'BILL-003', vendor: 'Internet Provider', amount: 299.99, dueDate: '2025-03-01', status: 'PAID', category: 'Utilities' },
    { id: 'BILL-004', vendor: 'Software Licenses', amount: 5200.00, dueDate: '2025-03-10', status: 'UNPAID', category: 'Software' },
    { id: 'BILL-005', vendor: 'Office Rent', amount: 15000.00, dueDate: '2025-03-05', status: 'PAID', category: 'Rent' },
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Overdue Bills</h3>
          <p className="text-sm text-red-800 mt-1">1 bill is overdue. Immediate action required.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Bill ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Category</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map(bill => (
              <tr key={bill.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">{bill.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{bill.vendor}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{bill.category}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${bill.amount.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{bill.dueDate}</td>
                <td className="px-6 py-4"><StatusBadge status={bill.status} /></td>
                <td className="px-6 py-4">
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    {bill.status === 'UNPAID' ? 'Pay Now' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CardsManagementPage = () => {
  const [cards, setCards] = useState(generateCards());

  const activeCount = cards.filter(c => c.status === 'ACTIVE').length;
  const frozenCount = cards.filter(c => c.status === 'FROZEN').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Total Cards</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{cards.length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Active Cards</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600 text-sm">Frozen</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{frozenCount}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            Issue New Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {cards.map(card => (
          <div key={card.id} className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-lg p-6 text-white h-48 flex flex-col justify-between">
            <div>
              <p className="text-sm opacity-75">{card.type}</p>
              <h4 className="text-lg font-semibold mt-2">{card.name}</h4>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-widest">•••• {card.last4}</p>
              <p className="text-xs opacity-75 mt-3">{card.user}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <StatusBadge status={card.status} />
              <button className="text-white hover:opacity-75"><MoreVertical className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PayrollProcessingPage = () => {
  const [payrollData, setPayrollData] = useState(generatePayroll());

  const totalPayroll = payrollData.reduce((sum, emp) => sum + parseFloat(emp.salary), 0);
  const avgSalary = (totalPayroll / payrollData.length).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Pay Period: March 1 - 15, 2025</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-gray-600 text-sm">Total Payroll</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">${totalPayroll.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Average Salary</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">${avgSalary}</p>
          </div>
          <div>
            <button className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm">
              Process Payroll
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Salary</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Bonus</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Deductions</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Net Pay</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payrollData.map(emp => {
              const netPay = (parseFloat(emp.salary) + parseFloat(emp.bonus) - parseFloat(emp.deductions)).toFixed(2);
              return (
                <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{emp.employee}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.department}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">${parseFloat(emp.salary).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600">${parseFloat(emp.bonus).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-red-600">${parseFloat(emp.deductions).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">${netPay}</td>
                  <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                  <td className="px-6 py-4">
                    <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                      Pay Individual
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InvoicesPage = () => {
  const [invoices] = useState([
    { id: 'INV-001', client: 'Acme Corp', amount: 5250.00, date: '2025-02-15', dueDate: '2025-03-15', status: 'PAID' },
    { id: 'INV-002', client: 'TechFlow Inc', amount: 3500.00, date: '2025-02-20', dueDate: '2025-03-20', status: 'UNPAID' },
    { id: 'INV-003', client: 'Global Solutions', amount: 8200.00, date: '2025-02-25', dueDate: '2025-03-25', status: 'UNPAID' },
    { id: 'INV-004', client: 'Innovate Ltd', amount: 2100.00, date: '2025-01-20', dueDate: '2025-02-20', status: 'OVERDUE' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium text-sm">
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Invoice ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Issued Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(invoice => (
              <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">{invoice.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{invoice.client}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">${invoice.amount.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{invoice.date}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{invoice.dueDate}</td>
                <td className="px-6 py-4"><StatusBadge status={invoice.status} /></td>
                <td className="px-6 py-4 flex gap-2">
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</button>
                  {invoice.status === 'UNPAID' && <button className="text-amber-600 hover:text-amber-800 text-sm font-medium">Remind</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VendorsPage = () => {
  const [vendors] = useState([
    { id: 'VND-001', name: 'AWS', category: 'Cloud Services', totalPaid: 24500.00, pending: 2450.00 },
    { id: 'VND-002', name: 'Stripe', category: 'Payment Processing', totalPaid: 12300.00, pending: 0 },
    { id: 'VND-003', name: 'Adobe', category: 'Software', totalPaid: 8900.00, pending: 599.99 },
    { id: 'VND-004', name: 'Slack', category: 'Communication', totalPaid: 4200.00, pending: 0 },
    { id: 'VND-005', name: 'GitHub', category: 'Development', totalPaid: 2100.00, pending: 0 },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Vendors</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium text-sm">
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {vendors.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{vendor.name}</h4>
                <p className="text-sm text-gray-600">{vendor.category}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Paid</span>
                <span className="text-sm font-medium text-gray-900">${vendor.totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending Payment</span>
                <span className="text-sm font-medium text-amber-600">${vendor.pending.toFixed(2)}</span>
              </div>
            </div>
            <button className="w-full mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium border border-indigo-200">
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamDepartmentsPage = () => {
  const [departments] = useState([
    { id: 1, name: 'Engineering', members: 12, budget: 480000, head: 'John Smith' },
    { id: 2, name: 'Sales', members: 8, budget: 240000, head: 'Sarah Johnson' },
    { id: 3, name: 'Marketing', members: 6, budget: 150000, head: 'Michael Brown' },
    { id: 4, name: 'HR', members: 4, budget: 100000, head: 'Emma Wilson' },
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6 mb-8">
        {departments.map(dept => (
          <div key={dept.id} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{dept.name}</h4>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Head</span>
                <span className="text-sm font-medium text-gray-900">{dept.head}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Members</span>
                <span className="text-sm font-bold text-gray-900">{dept.members}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Budget</span>
                <span className="text-sm font-medium text-gray-900">${dept.budget.toLocaleString()}</span>
              </div>
            </div>
            <button className="w-full mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium border border-indigo-200">
              View Team Members
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const CompaniesPage = () => {
  const [companies] = useState([
    { id: 1, name: 'Acme Corp', industry: 'Technology', size: 'Enterprise', members: 245, status: 'ACTIVE' },
    { id: 2, name: 'TechFlow Inc', industry: 'Software', size: 'Mid-Market', members: 85, status: 'ACTIVE' },
    { id: 3, name: 'Global Solutions', industry: 'Consulting', size: 'Large', members: 120, status: 'ACTIVE' },
    { id: 4, name: 'Innovate Ltd', industry: 'Startup', size: 'Small', members: 15, status: 'ACTIVE' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Companies</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium text-sm">
          <Plus className="w-4 h-4" />
          Create Company
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {companies.map(company => (
          <div key={company.id} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900">{company.name}</h4>
                <p className="text-sm text-gray-600">{company.industry}</p>
              </div>
            </div>
            <div className="space-y-2 pb-4 border-b border-gray-200">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Size</span>
                <span className="text-sm font-medium text-gray-900">{company.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Members</span>
                <span className="text-sm font-medium text-gray-900">{company.members}</span>
              </div>
            </div>
            <div className="pt-4 flex gap-2">
              <button className="flex-1 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium border border-indigo-200">Settings</button>
              <button className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium border border-gray-200">Members</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExchangeRatesPage = () => {
  const [rates, setRates] = useState(generateExchangeRates());
  const [rateHistory] = useState([
    { date: 'Mon', rate: 0.91 },
    { date: 'Tue', rate: 0.915 },
    { date: 'Wed', rate: 0.92 },
    { date: 'Thu', rate: 0.918 },
    { date: 'Fri', rate: 0.925 },
    { date: 'Sat', rate: 0.92 },
    { date: 'Sun', rate: 0.92 },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white rounded-lg p-6 border border-gray-200">
        <div>
          <p className="text-sm text-gray-600">Last Updated</p>
          <p className="text-lg font-semibold text-gray-900">Just now</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh from Market
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Currency Pair</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Market Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Buy Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Sell Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Markup %</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{rate.pair}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{rate.market}</td>
                <td className="px-6 py-4 text-sm font-medium text-emerald-600">{rate.buy}</td>
                <td className="px-6 py-4 text-sm font-medium text-red-600">{rate.sell}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{rate.markup}%</td>
                <td className="px-6 py-4">
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">USD/EUR Rate History</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={rateHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SecurityAuditPage = () => {
  const [auditLogs, setAuditLogs] = useState(generateAuditLogs());
  const [expandedLog, setExpandedLog] = useState(null);

  const securityAlerts = [
    { type: 'FAILED_LOGIN', count: 3, severity: 'warning' },
    { type: 'SUSPICIOUS_ACTIVITY', count: 1, severity: 'critical' },
    { type: 'RATE_LIMIT_HIT', count: 7, severity: 'info' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {securityAlerts.map((alert, idx) => (
          <div key={idx} className="bg-white rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 uppercase">{alert.type.replace(/_/g, ' ')}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{alert.count}</p>
            <p className={`text-xs mt-2 ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>
              {alert.severity === 'critical' ? 'Critical' : alert.severity === 'warning' ? 'Warning' : 'Info'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">User</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Action</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Entity Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}>
                <td className="px-6 py-4 text-sm text-gray-600">{log.timestamp}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{log.user}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.action}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{log.entityType}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{log.ipAddress}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium text-sm">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>
    </div>
  );
};

const SystemSettingsPage = () => {
  const [settings, setSettings] = useState({
    sessionTimeout: 30,
    mfaEnabled: true,
    passwordMinLength: 12,
    passwordRequireSpecial: true,
    stripeEnabled: true,
    payStackEnabled: false,
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Organization Settings</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Organization Name</label>
            <input type="text" defaultValue="Spendly Inc." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Organization Email</label>
            <input type="email" defaultValue="admin@spendly.com" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Policies</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-900">Multi-Factor Authentication</label>
            <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.mfaEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, mfaEnabled: !settings.mfaEnabled})}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.mfaEnabled ? 'translate-x-6' : 'translate-x-1'}`}></span>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Session Timeout (minutes)</label>
            <input type="number" value={settings.sessionTimeout} onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Password Minimum Length</label>
            <input type="number" value={settings.passwordMinLength} onChange={(e) => setSettings({...settings, passwordMinLength: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Providers</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-900">Stripe</label>
            <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.stripeEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, stripeEnabled: !settings.stripeEnabled})}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.stripeEnabled ? 'translate-x-6' : 'translate-x-1'}`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-900">PayStack</label>
            <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.payStackEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`} onClick={() => setSettings({...settings, payStackEnabled: !settings.payStackEnabled})}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.payStackEnabled ? 'translate-x-6' : 'translate-x-1'}`}></span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">API Health</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Payment API</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="text-sm font-medium text-emerald-600">Operational</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Database</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="text-sm font-medium text-emerald-600">Operational</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Message Queue</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="text-sm font-medium text-emerald-600">Operational</span>
            </span>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
        <p className="text-sm text-red-800 mb-4">Purging data is permanent and cannot be undone.</p>
        <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm">Purge Database</button>
      </div>

      <div className="flex gap-4">
        <button className="flex-1 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save Changes</button>
        <button className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
      </div>
    </div>
  );
};

// Main Dashboard Component
export default function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState('OVERVIEW');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { id: 'OVERVIEW', label: 'Overview', icon: Home },
    { id: 'USERS', label: 'User Management', icon: Users },
    { id: 'KYC', label: 'KYC Verification', icon: Shield },
    { id: 'WALLETS', label: 'Wallet & Finance', icon: Wallet },
    { id: 'TRANSACTIONS', label: 'Transactions', icon: Activity },
    { id: 'EXPENSES', label: 'Expenses & Approvals', icon: FileText },
    { id: 'BILLS', label: 'Bills & Payments', icon: DollarSign },
    { id: 'CARDS', label: 'Cards Management', icon: CreditCard },
    { id: 'PAYROLL', label: 'Payroll Processing', icon: Briefcase },
    { id: 'INVOICES', label: 'Invoices', icon: FileText },
    { id: 'VENDORS', label: 'Vendors', icon: Building2 },
    { id: 'TEAMS', label: 'Team & Departments', icon: Users },
    { id: 'COMPANIES', label: 'Companies', icon: Building2 },
    { id: 'RATES', label: 'Exchange Rates', icon: Euro },
    { id: 'SECURITY', label: 'Security & Audit', icon: Lock },
    { id: 'SETTINGS', label: 'System Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'OVERVIEW': return <OverviewPage />;
      case 'USERS': return <UserManagementPage />;
      case 'KYC': return <KYCVerificationPage />;
      case 'WALLETS': return <WalletFinancePage />;
      case 'TRANSACTIONS': return <TransactionsPage />;
      case 'EXPENSES': return <ExpensesApprovalsPage />;
      case 'BILLS': return <BillsPaymentsPage />;
      case 'CARDS': return <CardsManagementPage />;
      case 'PAYROLL': return <PayrollProcessingPage />;
      case 'INVOICES': return <InvoicesPage />;
      case 'VENDORS': return <VendorsPage />;
      case 'TEAMS': return <TeamDepartmentsPage />;
      case 'COMPANIES': return <CompaniesPage />;
      case 'RATES': return <ExchangeRatesPage />;
      case 'SECURITY': return <SecurityAuditPage />;
      case 'SETTINGS': return <SystemSettingsPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col border-r border-gray-800`}>
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">Spendly Admin</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-2">
          {navigation.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentPage === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Admin Info */}
        <div className={`border-t border-gray-800 p-4 ${sidebarOpen ? '' : 'flex justify-center'}`}>
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'flex-col'}`}>
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">JD</span>
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-gray-400">Super Admin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-gray-600 lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              {navigation.find(n => n.id === currentPage)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative text-gray-600 hover:text-gray-900">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full"></span>
            </button>
            <button className="text-gray-600 hover:text-gray-900">
              <Settings className="w-6 h-6" />
            </button>
            <button className="text-gray-600 hover:text-gray-900">
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}
