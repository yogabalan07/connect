import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle2, HelpCircle, Activity } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminAnalyticsPage: React.FC = () => {
  const { doubts, users, categories } = useApp();
  const [metricTimeframe, setMetricTimeframe] = useState<'7d' | '30d' | 'semester'>('7d');

  const solvedCount = doubts.filter(d => d.hasAcceptedAnswer).length;
  const resolutionPercentage = Math.round((solvedCount / (doubts.length || 1)) * 100);

  const deptBreakdown = [
    { dept: 'Computer Science (CSE)', count: 24, percentage: 48 },
    { dept: 'Electronics & Comm (ECE)', count: 14, percentage: 28 },
    { dept: 'Information Tech (IT)', count: 6, percentage: 12 },
    { dept: 'Electrical & Electronics (EEE)', count: 4, percentage: 8 },
    { dept: 'Mechanical & Civil', count: 2, percentage: 4 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campus Academic Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Student participation, resolution rates, and departmental engagement metrics
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
          {['7d', '30d', 'semester'].map(tf => (
            <button
              key={tf}
              onClick={() => setMetricTimeframe(tf as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase font-mono transition-colors ${
                metricTimeframe === tf ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold">Active Daily Inquirers</span>
          <div className="text-2xl font-bold text-white font-mono mt-1">1,842</div>
          <span className="text-[10px] text-emerald-400 font-medium">↑ +14.2% vs last week</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold">Solved Ratio</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{resolutionPercentage}%</div>
          <span className="text-[10px] text-slate-400">Verified solutions</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold">Average Response Time</span>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">38 mins</div>
          <span className="text-[10px] text-emerald-400 font-medium">Under 1 hour SLA</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-semibold">Flagged Content Rate</span>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">&lt; 0.2%</div>
          <span className="text-[10px] text-slate-400">High academic integrity</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Participation Breakdown */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white">Department Question Volume Distribution</h2>
          <div className="space-y-3 pt-2">
            {deptBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.dept}</span>
                  <span className="text-slate-400 font-mono">{item.percentage}% ({item.count} questions)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    style={{ width: `${item.percentage}%` }}
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Active Subject Hubs */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white">Top Active Academic Subjects</h2>
          <div className="space-y-2.5 pt-2">
            {categories.slice(0, 5).map((cat, i) => (
              <div
                key={cat.id}
                className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 font-mono font-bold text-purple-400">#{i + 1}</span>
                  <span className="font-semibold text-slate-200">{cat.name}</span>
                </div>
                <span className="font-mono text-slate-400 tabular-nums">
                  {cat.questionsCount} doubts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
