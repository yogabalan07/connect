import React from 'react';
import { History, Shield, User, HelpCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminAuditLogsPage: React.FC = () => {
  const { auditLogs } = useApp();

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4 text-sky-400" />;
      case 'doubt':
        return <HelpCircle className="w-4 h-4 text-indigo-400" />;
      case 'moderation':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Shield className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System & Moderation Audit Logs</h1>
        <p className="text-xs text-slate-400 mt-1">
          Chronological immutable timeline of administrator decisions, student approvals, and content flags
        </p>
      </div>

      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-6">
        <div className="relative pl-6 border-l-2 border-slate-800 space-y-8">
          {auditLogs.map(log => (
            <div key={log.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-950 border-2 border-purple-500 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span>{log.actor}</span>
                  <span className="text-purple-400 font-normal">{log.action}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{log.timestamp}</span>
              </div>

              <div className="mt-1 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2.5">
                <div className="p-1 rounded bg-slate-900">
                  {getLogIcon(log.type)}
                </div>
                <span className="font-mono text-slate-200">{log.target}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
