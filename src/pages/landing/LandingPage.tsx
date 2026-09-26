import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  MessageSquare,
  Users,
  Search,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Cpu,
  Binary,
  Code2,
  Terminal,
  BookOpen,
  HelpCircle,
  Award,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { RoleSwitcher } from '../../components/ui/RoleSwitcher';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useApp();

  // Hero animated mock sequence states
  const [heroStep, setHeroStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroStep(prev => (prev + 1) % 4);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { value: '10,480+', label: 'Doubts Asked', sub: 'Across 6 Engineering Depts' },
    { value: '25,920+', label: 'Verified Solutions', sub: 'By Peers & Senior Mentors' },
    { value: '5,200+', label: 'College Students', sub: 'CSE, ECE, EEE, MECH, IT' },
    { value: '96.4%', label: 'Resolved Rate', sub: 'Average response under 45m' }
  ];

  const features = [
    {
      icon: <HelpCircle className="w-5 h-5 text-indigo-400" />,
      title: 'Public Academic Doubts',
      desc: 'Ask doubts in DSA, Operating Systems, Math, and Embedded Systems. Tag relevant subjects for quick answers.'
    },
    {
      icon: <Lock className="w-5 h-5 text-amber-400" />,
      title: '🔒 Private Doubts',
      desc: 'Discuss confidential capstone projects, lab submissions, or research with selected teammates and mentors.'
    },
    {
      icon: <Users className="w-5 h-5 text-sky-400" />,
      title: 'Senior Mentorship & Tagging',
      desc: 'Tag placed seniors and faculty mentors with @username for specialized guidance on exams and interviews.'
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      title: 'Accepted Solutions & Rep',
      desc: 'Mark the most helpful answer as verified. Authors earn academic reputation points and community badges.'
    },
    {
      icon: <Search className="w-5 h-5 text-purple-400" />,
      title: 'Instant Search & Filter',
      desc: 'Search past semester doubts, exam questions, code snippets, and algorithms with keyboard shortcut ⌘K.'
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-rose-400" />,
      title: 'Department Moderation',
      desc: 'Verified student IDs, department admin review, and zero spam policy to maintain academic excellence.'
    }
  ];

  const categories = [
    { name: 'Data Structures & C++', icon: <Binary className="w-4 h-4 text-sky-400" />, count: '142 doubts' },
    { name: 'Embedded Systems & IoT', icon: <Cpu className="w-4 h-4 text-emerald-400" />, count: '98 doubts' },
    { name: 'Operating Systems', icon: <Terminal className="w-4 h-4 text-indigo-400" />, count: '76 doubts' },
    { name: 'Placements & Coding', icon: <Award className="w-4 h-4 text-amber-400" />, count: '154 doubts' },
    { name: 'Machine Learning & AI', icon: <Zap className="w-4 h-4 text-purple-400" />, count: '110 doubts' },
    { name: 'VLSI & Electronics', icon: <Code2 className="w-4 h-4 text-rose-400" />, count: '61 doubts' }
  ];

  const testimonials = [
    {
      quote: "Campus Doubt Hub completely transformed our 3rd-year Operating Systems preparation. When I was stuck on Belady's Anomaly, Rahul and Prof. Ramesh replied within an hour with crystal clear proofs.",
      author: 'Ananya Iyer',
      role: '1st Year CSE',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80'
    },
    {
      quote: "The 🔒 Private Doubt feature allowed our Smart Grid capstone team to privately consult Texas Instruments alumni on FreeRTOS priority inversion without leaking our schematic before the review.",
      author: 'Karthik Raj',
      role: '2nd Year ECE',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80'
    },
    {
      quote: "As a placed 4th-year student, this platform gives me a structured space to mentor juniors in coding rounds and system design. The reputation badges motivate healthy academic collaboration.",
      author: 'Priya Sundaram',
      role: 'Placed at Texas Instruments (4th Year ECE)',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Bar */}
      <nav className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-white">
              Campus Doubt Hub
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#categories" className="hover:text-white transition-colors">Subjects</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <ThemeToggle />
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/app"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <span>Launch App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-indigo-300 mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Built exclusively for college engineering students & seniors</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1] text-balance">
            Ask. Learn. Share.{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Grow Together.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed text-balance">
            A unified academic community where college juniors ask doubts, seniors share verified solutions, and students build semester-long knowledge together.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <span>Join the Community</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/app/explore"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-sm font-semibold transition-all active:scale-95"
            >
              <span>Explore Doubts</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Floating Action Badges */}
          <div className="mt-12 relative max-w-4xl mx-auto">
            {/* Floating Card 1 */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="hidden md:flex absolute -top-8 -left-6 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md text-left"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-200">Answer Accepted</div>
                <div className="text-[10px] text-emerald-400 font-mono">+15 Reputation</div>
              </div>
            </motion.div>

            {/* Floating Card 2 */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
              className="hidden md:flex absolute -top-6 -right-6 z-20 items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md text-left"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-200">@Arun mentioned you</div>
                <div className="text-[10px] text-slate-400">in #KalmanFilter</div>
              </div>
            </motion.div>

            {/* Animated Platform Dashboard Hero Mockup */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl p-4 sm:p-6 text-left relative overflow-hidden backdrop-blur-md">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-slate-400">
                    campus-doubt-hub.internal/feed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Activity
                  </span>
                </div>
              </div>

              {/* Special Animated Sequence: Question -> Answer -> Accepted -> Notification */}
              <div className="space-y-4">
                {/* Step 1: Question */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt="Rahul"
                      className="w-7 h-7 rounded-full object-cover border border-slate-700"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">Rahul Sharma</span>
                      <span className="text-slate-400"> · 3rd Year CSE · 2m ago</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    How does a Kalman Filter work in robotics and noisy IMU sensor fusion?
                  </h3>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span className="text-indigo-400">Embedded Systems</span>
                    <span>·</span>
                    <span>#Robotics</span>
                    <span>·</span>
                    <span>#ESP32</span>
                  </div>
                </div>

                {/* Step 2: Answer Animation */}
                <AnimatePresence>
                  {heroStep >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.35 }}
                      className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/30 ml-4 sm:ml-8 relative"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                            alt="Priya"
                            className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-white">Priya Sundaram</span>
                            <span className="text-[10px] font-semibold text-emerald-400 ml-1.5 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                              Senior Mentor (TI Placed)
                            </span>
                          </div>
                        </div>

                        {heroStep >= 2 && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Accepted Answer</span>
                          </motion.div>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        Kalman filtering estimates the true state by recursively minimizing mean squared error in two phases: Predict (project state ahead via physics model) and Update (blend noisy accelerometer reading using the calculated Kalman Gain K).
                      </p>

                      <div className="mt-2.5 p-2 rounded-lg bg-slate-950/80 font-mono text-[11px] text-emerald-400/90 border border-slate-800">
                        <code>float K = P / (P + R); // Weighted blending factor</code>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step 3: Notification Toast */}
                <AnimatePresence>
                  {heroStep >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                        <span>Someone answered your question. +15 Reputation awarded to Priya!</span>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-300">Just now</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Statistics Counters */}
      <section className="py-12 border-y border-slate-800/80 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tabular-nums tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs font-semibold text-indigo-400">{stat.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Step-by-Step Workflow
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              How Campus Doubt Hub Works
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Clear your academic doubts in four intuitive steps designed specifically for college semesters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { num: '01', title: 'Ask with Context', desc: 'Post code snippets, circuit photos, or assignment questions with department and year tags.' },
              { num: '02', title: 'Connect & Tag', desc: 'Tag specific subject toppers or placed senior mentors using @mentions to notify them directly.' },
              { num: '03', title: 'Receive Solutions', desc: 'Get peer reviews, step-by-step mathematical derivations, and tested code implementations.' },
              { num: '04', title: 'Accept & Learn', desc: 'Mark verified answers as Accepted, reward mentors with reputation, and bookmark for semester exams.' }
            ].map(card => (
              <div
                key={card.num}
                className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-indigo-500/40 transition-all group"
              >
                <div className="text-2xl font-mono font-bold text-indigo-400/60 group-hover:text-indigo-400 transition-colors">
                  {card.num}
                </div>
                <h3 className="mt-3 text-base font-bold text-white">{card.title}</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Everything You Need
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered for College Excellence
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              From public coding challenges to private capstone brainstorming, we provide the full academic stack.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-4">
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories & Subjects */}
      <section id="categories" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Academic Disciplines
              </span>
              <h2 className="mt-1 text-3xl font-extrabold text-white">Popular Subject Hubs</h2>
            </div>
            <Link
              to="/app/categories"
              className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Explore all 16 departments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c, i) => (
              <div
                key={i}
                onClick={() => navigate('/app/explore')}
                className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-indigo-500/40 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    {c.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{c.count}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-950/70">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Student Voices
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Trusted by Campus Learners
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between"
              >
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "{t.quote}"
                </p>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3">
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{t.author}</div>
                    <div className="text-[11px] text-slate-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center p-10 sm:p-12 rounded-3xl bg-gradient-to-b from-indigo-950/60 to-slate-900/90 border border-indigo-500/30 shadow-2xl relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Have an academic doubt right now?
          </h2>
          <p className="mt-3 text-sm text-indigo-200 max-w-xl mx-auto">
            Someone on campus knows the solution. Ask freely, connect with senior mentors, and accelerate your engineering journey.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/app/create"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Start Asking
            </Link>
            <Link
              to="/app"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              Browse Campus Doubts
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-sm">Campus Doubt Hub</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link to="/app" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/app/explore" className="hover:text-white transition-colors">Explore</Link>
            <Link to="/app/categories" className="hover:text-white transition-colors">Categories</Link>
            <Link to="/app/community" className="hover:text-white transition-colors">Leaderboard</Link>
            <Link to="/admin" className="text-purple-400 hover:underline">Admin Portal</Link>
          </div>

          <div className="text-slate-500">
            © 2026 Campus Doubt Hub. Designed for College Students & Mentors.
          </div>
        </div>
      </footer>
    </div>
  );
};
