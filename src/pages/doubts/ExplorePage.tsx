import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  Lock,
  CheckCircle2,
  HelpCircle,
  FolderTree,
  Hash,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DoubtCard } from '../../components/cards/DoubtCard';
import { Department, AcademicYear } from '../../types';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { doubts, categories, tags } = useApp();

  // URL query params
  const paramTag = searchParams.get('tag') || '';
  const paramCategory = searchParams.get('category') || '';
  const paramVisibility = searchParams.get('visibility') || 'all';
  const paramStatus = searchParams.get('status') || 'all';

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(paramCategory);
  const [selectedTag, setSelectedTag] = useState(paramTag);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(paramStatus);
  const [visibilityFilter, setVisibilityFilter] = useState<string>(paramVisibility);
  const [sortBy, setSortBy] = useState<'latest' | 'trending' | 'most_answered' | 'unanswered' | 'solved'>('latest');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Sync when searchParams change
  useEffect(() => {
    if (paramTag) setSelectedTag(paramTag);
    if (paramCategory) setSelectedCategory(paramCategory);
    if (paramVisibility) setVisibilityFilter(paramVisibility);
    if (paramStatus) setStatusFilter(paramStatus);
  }, [paramTag, paramCategory, paramVisibility, paramStatus]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedTag('');
    setSelectedDept('all');
    setSelectedYear('all');
    setStatusFilter('all');
    setVisibilityFilter('all');
    setSortBy('latest');
    setSearchParams({});
  };

  // Filter application
  let filtered = doubts.filter(d => {
    // Search text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.authorSnapshot.name.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Category
    if (selectedCategory && d.category !== selectedCategory) return false;

    // Tag
    if (selectedTag && !d.tags.includes(selectedTag)) return false;

    // Department
    if (selectedDept !== 'all' && d.authorSnapshot.department !== selectedDept) return false;

    // Year
    if (selectedYear !== 'all' && d.authorSnapshot.year !== selectedYear) return false;

    // Visibility
    if (visibilityFilter === 'private' && d.visibility !== 'private') return false;
    if (visibilityFilter === 'public' && d.visibility !== 'public') return false;

    // Status
    if (statusFilter === 'solved' && !d.hasAcceptedAnswer) return false;
    if (statusFilter === 'unanswered' && (d.answersCount > 0 || d.hasAcceptedAnswer)) return false;

    return true;
  });

  // Sorting
  if (sortBy === 'latest') {
    // Keep standard ordering
  } else if (sortBy === 'trending') {
    filtered.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else if (sortBy === 'most_answered') {
    filtered.sort((a, b) => b.answersCount - a.answersCount);
  } else if (sortBy === 'unanswered') {
    filtered.sort((a, b) => a.answersCount - b.answersCount);
  } else if (sortBy === 'solved') {
    filtered.sort((a, b) => (b.hasAcceptedAnswer ? 1 : 0) - (a.hasAcceptedAnswer ? 1 : 0));
  }

  const activeFiltersCount = [
    selectedCategory,
    selectedTag,
    selectedDept !== 'all',
    selectedYear !== 'all',
    statusFilter !== 'all',
    visibilityFilter !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Explore Academic Doubts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse solved engineering questions, assignment explanations, and technical discussions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}

          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Search & Sort Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search keywords, concepts, question titles, or authors..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="latest">Sort: Latest Doubts</option>
            <option value="trending">Sort: Highest Upvoted / Trending</option>
            <option value="most_answered">Sort: Most Answered</option>
            <option value="unanswered">Sort: Unanswered First</option>
            <option value="solved">Sort: Solved Solutions First</option>
          </select>
        </div>
      </div>

      {/* Advanced Filter Row (Desktop & Mobile Drawer) */}
      <div
        className={`${
          showMobileFilters ? 'block' : 'hidden'
        } sm:block p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-3`}
      >
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Refine Criteria</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {filtered.length} results matching
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Category Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Subject Hub</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Depts</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="IT">IT</option>
              <option value="AIDS">AIDS</option>
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Author Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Years</option>
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
              <option value="3rd">3rd Year</option>
              <option value="4th">4th Year</option>
              <option value="Faculty">Faculty</option>
            </select>
          </div>

          {/* Solution Status */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Questions</option>
              <option value="solved">Solved (Accepted Answer)</option>
              <option value="unanswered">Unanswered / Open</option>
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Visibility</label>
            <select
              value={visibilityFilter}
              onChange={e => setVisibilityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Visibility</option>
              <option value="public">Public Doubts</option>
              <option value="private">🔒 Private Doubts</option>
            </select>
          </div>
        </div>

        {/* Selected Tag Active Pill */}
        {selectedTag && (
          <div className="pt-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Filtering by Tag:</span>
            <span className="inline-flex items-center gap-1 font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
              #{selectedTag}
              <button onClick={() => setSelectedTag('')} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Doubts Result List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map(doubt => (
            <DoubtCard
              key={doubt.id}
              doubt={doubt}
              onTagClick={tag => setSelectedTag(tag)}
            />
          ))
        ) : (
          <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No doubts match your filters</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              Try clearing some filter constraints or searching with broader keywords.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
