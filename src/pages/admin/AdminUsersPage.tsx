import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Shield, ShieldOff, Check, X, Eye, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserStatus } from '../../types';

export const AdminUsersPage: React.FC = () => {
  const { users, approveUser, rejectUser, blockUser, unblockUser } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const filtered = users.filter(u => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (deptFilter !== 'all' && u.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student & Mentor Directory</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage university enrollment, student credentials, permissions, and moderation status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/users/pending"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            <span>Pending Approvals ({users.filter(u => u.status === 'pending').length})</span>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, roll no, or email..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Enrolled</option>
            <option value="pending">Pending Approval</option>
            <option value="blocked">Restricted / Blocked</option>
          </select>
        </div>

        <div>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="MECH">MECH</option>
            <option value="CIVIL">CIVIL</option>
            <option value="IT">IT</option>
            <option value="AIDS">AIDS</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Department & Year</th>
                <th className="p-4">Reputation</th>
                <th className="p-4">Status</th>
                <th className="p-4">Registered</th>
                <th className="p-4 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.role === 'admin' && (
                            <span className="text-[10px] text-purple-400 font-mono">Staff</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div>{u.department}</div>
                    <div className="text-[11px] text-slate-500">{u.year} Year (Sec {u.section || 'A'})</div>
                  </td>
                  <td className="p-4 font-mono font-bold text-amber-400 tabular-nums">
                    {u.reputation}
                  </td>
                  <td className="p-4">
                    {u.status === 'active' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                    {u.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        Pending Approval
                      </span>
                    )}
                    {u.status === 'blocked' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        Blocked
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400 text-[11px] font-mono">
                    {u.joinedDate}
                  </td>
                  <td className="p-4 text-right space-x-1.5">
                    <Link
                      to={`/app/users/${u.id}`}
                      className="inline-block p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="View Profile"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>

                    {u.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => approveUser(u.id)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectUser(u.id)}
                          className="px-2 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 text-[11px]"
                        >
                          Reject
                        </button>
                      </>
                    ) : u.status === 'blocked' ? (
                      <button
                        onClick={() => unblockUser(u.id)}
                        className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 text-[11px] font-medium"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => blockUser(u.id)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px]"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
