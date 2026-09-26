import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree,
  Binary,
  Cpu,
  Terminal,
  Database,
  Network,
  BrainCircuit,
  Briefcase,
  Globe,
  Activity,
  Microchip,
  Calculator,
  Wrench,
  Building2,
  Trophy,
  GraduationCap,
  Cloud,
  ChevronRight,
  Search
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { categories } = useApp();
  const [activeDomain, setActiveDomain] = useState<'all' | 'Programming' | 'Engineering' | 'Academics' | 'Career'>('all');
  const [search, setSearch] = useState('');

  const iconMap: { [key: string]: any } = {
    Binary,
    Cpu,
    Terminal,
    Database,
    Network,
    BrainCircuit,
    Briefcase,
    Globe,
    Activity,
    Microchip,
    Calculator,
    Wrench,
    Building2,
    Trophy,
    GraduationCap,
    Cloud
  };

  const filtered = categories.filter(c => {
    if (activeDomain !== 'all' && c.domain !== activeDomain) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Academic Categories</h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore syllabus-aligned knowledge hubs across all engineering disciplines
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Domain Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
        {['all', 'Programming', 'Engineering', 'Academics', 'Career'].map(d => (
          <button
            key={d}
            onClick={() => setActiveDomain(d as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-colors ${
              activeDomain === d ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {d === 'all' ? 'All Departments' : d}
          </button>
        ))}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cat => {
          const IconComponent = iconMap[cat.icon] || FolderTree;
          return (
            <div
              key={cat.id}
              onClick={() => navigate(`/app/explore?category=${encodeURIComponent(cat.name)}`)}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-all cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:bg-indigo-600/20 group-hover:text-indigo-300 transition-all">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {cat.questionsCount} doubts
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {cat.name}
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {cat.domain}
                </span>
                <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  <span>Browse Hub</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
