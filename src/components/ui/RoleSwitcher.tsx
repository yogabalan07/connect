import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, GraduationCap, Award, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const RoleSwitcher: React.FC = () => {
  const { currentUser, switchRole } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  const roles = [
    {
      role: 'student' as const,
      name: 'Rahul Sharma',
      desc: '3rd Year CSE (Student View)',
      icon: <GraduationCap className="w-4 h-4 text-sky-400" />
    },
    {
      role: 'mentor' as const,
      name: 'Priya Sundaram',
      desc: '4th Year ECE Mentor (TI Placed)',
      icon: <Award className="w-4 h-4 text-emerald-400" />
    },
    {
      role: 'admin' as const,
      name: 'Dr. Ramesh Kumar',
      desc: 'HOD CSE (Full Admin Portal)',
      icon: <Shield className="w-4 h-4 text-purple-400" />
    }
  ];

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 transition-all shadow-sm"
        title="Switch Demo Role"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="hidden sm:inline text-slate-400">Demo Role:</span>
        <span className="font-semibold text-slate-100">{currentUser.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 p-2 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl"
          >
            <div className="px-2.5 py-1.5 mb-1 border-b border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Persona (Instant Demo)
              </span>
            </div>
            <div className="space-y-1">
              {roles.map(item => {
                const isSelected = currentUser.role === item.role;
                return (
                  <button
                    key={item.role}
                    onClick={() => {
                      switchRole(item.role);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="mt-0.5 p-1 rounded-md bg-slate-800 border border-slate-700">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                        {item.name}
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-mono">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
