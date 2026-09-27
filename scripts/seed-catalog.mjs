#!/usr/bin/env node
/**
 * Seeds the reference catalogue: `categories` and `tags`.
 *
 * These two collections are reference data, not user content: they are what
 * the create-doubt category picker, the explore filters and the tag pages
 * read. `src/data/mockCategories.ts` and `src/data/mockTags.ts` (and the fake
 * counts they carried) are gone, so this script is the only way to populate
 * them, and it runs against the real database.
 *
 * Safety rails (all of them are hard stops, not warnings):
 *   - dry-run by default: nothing is written without `--apply`;
 *   - an existing document id is never overwritten;
 *   - a category whose name already exists (any casing) is never duplicated;
 *   - counters start at zero (`questionsCount`, `count`, `followersCount`) so
 *     the catalogue never claims activity it does not have — the app derives
 *     real counts from `doubts`, `votes` and `tagFollows`;
 *   - `isTrending` is not written; it is an editorial flag the app may set.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS='<path to service-account JSON>'
 *   npm run catalog:seed            # report only
 *   npm run catalog:seed -- --apply # write the missing documents
 */
import { getFirestore } from 'firebase-admin/firestore';
import { describeError, initFirebaseAdmin, loadLocalEnv } from './lib/env.mjs';

/** Task 11: operation + Firebase error code + concise message, never secrets. */
function failOperation(operation, error) {
  console.error(`\n[seed-catalog] failed`);
  console.error(`  ${describeError(error, { operation }).split('\n').join('\n  ')}`);
  process.exit(1);
}

/**
 * Tag document ids must match `catalogService.createTag`
 * (`tag-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`), otherwise an
 * admin adding a tag that is already seeded would create a second document
 * for the same topic.
 */
function tagId(name) {
  return `tag-${name.trim().replace(/^#/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const CATEGORIES = [
  {
    name: 'Data Structures & Algorithms',
    slug: 'dsa',
    description: 'Arrays, Trees, Graphs, Dynamic Programming, Backtracking, and Complexity Analysis.',
    icon: 'Binary',
    domain: 'Programming'
  },
  {
    name: 'Embedded Systems & IoT',
    slug: 'embedded-iot',
    description: 'Microcontrollers (ESP32, STM32, Arduino), RTOS, SPI/I2C protocols, sensors, and firmware.',
    icon: 'Cpu',
    domain: 'Engineering'
  },
  {
    name: 'Operating Systems & Concurrency',
    slug: 'os',
    description: 'Process scheduling, deadlocks, virtual memory, pthreads, semaphores, and system calls.',
    icon: 'Terminal',
    domain: 'Academics'
  },
  {
    name: 'Database Systems & SQL',
    slug: 'dbms',
    description: 'Relational design, normalization, ACID properties, indexing, query optimization, and NoSQL.',
    icon: 'Database',
    domain: 'Academics'
  },
  {
    name: 'Computer Networks',
    slug: 'networks',
    description: 'TCP/IP model, routing protocols, sliding window, socket programming, and network security.',
    icon: 'Network',
    domain: 'Academics'
  },
  {
    name: 'Machine Learning & AI',
    slug: 'ml-ai',
    description: 'Supervised/unsupervised models, neural networks, computer vision, NLP, and math for ML.',
    icon: 'BrainCircuit',
    domain: 'Programming'
  },
  {
    name: 'Placements & Coding Tests',
    slug: 'placements',
    description: 'Interview experiences, online assessments, HR rounds, resume reviews, and company questions.',
    icon: 'Briefcase',
    domain: 'Career'
  },
  {
    name: 'Web & Fullstack Engineering',
    slug: 'web-dev',
    description: 'Frontend (React, TypeScript), Backend (Node, Django, Go), REST/GraphQL APIs, and auth.',
    icon: 'Globe',
    domain: 'Programming'
  },
  {
    name: 'Digital Signal Processing',
    slug: 'dsp',
    description: 'Z-transforms, FFT, FIR/IIR filter design, convolution, and MATLAB simulation of signals.',
    icon: 'Activity',
    domain: 'Engineering'
  },
  {
    name: 'VLSI & Digital Electronics',
    slug: 'vlsi',
    description: 'Verilog, VHDL, CMOS inverter design, FPGA implementation, timing analysis, and state machines.',
    icon: 'Microchip',
    domain: 'Engineering'
  },
  {
    name: 'Engineering Mathematics',
    slug: 'math',
    description: 'Linear Algebra, Calculus, Differential Equations, Probability & Statistics, and Complex Analysis.',
    icon: 'Calculator',
    domain: 'Academics'
  },
  {
    name: 'Mechanical CAD & FEA',
    slug: 'mech-cad',
    description: 'SolidWorks, ANSYS, stress-strain analysis, thermodynamics cycles, and kinematic mechanisms.',
    icon: 'Wrench',
    domain: 'Engineering'
  },
  {
    name: 'Civil & Structural Design',
    slug: 'civil-design',
    description: 'STAAD.Pro, RCC beam design, fluid statics, survey data calculations, and soil mechanics.',
    icon: 'Building2',
    domain: 'Engineering'
  },
  {
    name: 'Hackathons & Capstone Projects',
    slug: 'hackathons',
    description: 'Idea brainstorming, project architecture, teammate search, demo pitching, and prototype design.',
    icon: 'Trophy',
    domain: 'Career'
  },
  {
    name: 'Internships & Research Labs',
    slug: 'internships',
    description: 'Summer research internships (IITs, IISc, DRDO), off-campus applications, and cold mailing tips.',
    icon: 'GraduationCap',
    domain: 'Career'
  },
  {
    name: 'Cloud Computing & DevOps',
    slug: 'devops',
    description: 'Docker containers, Kubernetes orchestration, CI/CD pipelines, AWS/GCP architecture.',
    icon: 'Cloud',
    domain: 'Programming'
  }
];

const TAGS = [
  ['DSA', 'Data structures & algorithms, time/space complexity, competitive programming.'],
  ['C', 'Procedural systems language, pointer arithmetic, memory management.'],
  ['Python', 'General purpose scripting, scientific computing, PyTorch and data structures.'],
  ['Java', 'Object-oriented programming, JVM internals, garbage collection and OOP design.'],
  ['React', 'Declarative component-based UI library for modern web applications.'],
  ['NodeJS', 'Event-driven asynchronous JavaScript runtime for server-side computing.'],
  ['FastAPI', 'High-performance modern Python web framework based on Starlette and Pydantic.'],
  ['SpringBoot', 'Enterprise Java backend framework with dependency injection and Hibernate.'],
  ['Git', 'Distributed version control, merge conflicts, interactive rebasing, branching.'],
  ['Docker', 'Containerization, Dockerfile optimization, multi-stage builds and compose.'],
  ['Linux', 'Kernel internals, bash scripting, systemd services, signals and permissions.'],
  ['DBMS', 'Database management systems, relational schema design, SQL optimization.'],
  ['SQL', 'Structured Query Language, joins, CTEs, window functions and indexing.'],
  ['OS', 'Operating systems, process control blocks, paging, scheduling and locks.'],
  ['Pointers', 'Raw memory addresses, double pointers, void pointers and segmentation faults.'],
  ['Recursion', 'Recursive call stacks, base cases, tree traversals and dynamic programming.'],
  ['Networks', 'TCP three-way handshake, congestion control, subnetting and DNS resolution.'],
  ['ESP32', 'Dual-core Xtensa microcontrollers with integrated Wi-Fi and Bluetooth.'],
  ['Arduino', 'Open-source electronics prototyping platform for sensors and actuators.'],
  ['IoT', 'Internet of Things sensor networks, edge devices, MQTT, and telemetry.'],
  ['EmbeddedSystems', 'Bare-metal programming, timers, interrupts, hardware registers and RTOS.'],
  ['FreeRTOS', 'Real-time operating system for embedded microcontrollers, tasks, queues, semaphores.'],
  ['Robotics', 'Kinematics, ROS (Robot Operating System), motor drivers, and sensor fusion.'],
  ['KalmanFilter', 'State estimation algorithm for noisy sensor fusion in robotics and avionics.'],
  ['Verilog', 'Hardware description language for digital circuits and FPGA simulation.'],
  ['VLSI', 'Very Large Scale Integration, CMOS layout, timing slack and setup/hold times.'],
  ['MATLAB', 'Numerical computing environment, matrix manipulation, filter design toolbox.'],
  ['TensorFlow', 'Deep learning framework for training neural networks and tensor computation.'],
  ['LinearAlgebra', 'Vector spaces, eigenvalues, eigenvectors, matrix decompositions and PCA.'],
  ['Placement', 'Campus placements, interview coding questions, aptitude tests, mock rounds.'],
  ['InterviewPrep', 'Curated technical interview roadmaps, HR behavioral STAR methods, mock prep.'],
  ['Capstone', 'Final year engineering projects, research papers, system architectural diagrams.']
];

function parseArgs(argv) {
  const args = { apply: false };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[seed-catalog] ${error.message}`);
  process.exit(1);
}

if (args.help) {
  console.log('Usage: npm run catalog:seed [-- --apply]');
  process.exit(0);
}

/** Decides what happens to one seed entry; an existing document is never touched. */
function decideCategory(existingIds, existingNames, id, name) {
  if (existingIds.has(id)) return { action: 'skip', reason: `document ${id} already exists` };
  if (existingNames.has(name.toLowerCase())) {
    return { action: 'skip', reason: `a category named "${name}" already exists` };
  }
  return { action: 'create', reason: 'missing from the catalogue' };
}

function decideTag(existingIds, id) {
  if (existingIds.has(id)) return { action: 'skip', reason: `document ${id} already exists` };
  return { action: 'create', reason: 'missing from the catalogue' };
}

async function main() {
  const env = loadLocalEnv();

  let projectId;
  try {
    ({ projectId } = initFirebaseAdmin(env));
  } catch (error) {
    failOperation('initializing Firebase Admin from GOOGLE_APPLICATION_CREDENTIALS', error);
  }

  // Same explicit database targeting as the other admin scripts: never rely
  // on the Admin SDK's implicit database resolution (it yields `5 NOT_FOUND`).
  const databaseId = process.env.FIRESTORE_DATABASE_ID || env.FIRESTORE_DATABASE_ID || 'default';
  const db = getFirestore(databaseId);

  console.log(`[seed-catalog] project:  ${projectId}`);
  console.log(`[seed-catalog] database: ${databaseId}\n`);

  let categorySnapshot;
  let tagSnapshot;
  try {
    [categorySnapshot, tagSnapshot] = await Promise.all([
      db.collection('categories').get(),
      db.collection('tags').get()
    ]);
  } catch (error) {
    failOperation('reading the categories and tags collections', error);
  }

  const existingCategoryIds = new Set(categorySnapshot.docs.map(doc => doc.id));
  const existingCategoryNames = new Set(
    categorySnapshot.docs.map(doc => String(doc.data()?.name ?? '').toLowerCase()).filter(Boolean)
  );
  const existingTagIds = new Set(tagSnapshot.docs.map(doc => doc.id));

  console.log(
    `[seed-catalog] catalogue already holds ${categorySnapshot.size} categor` +
      `${categorySnapshot.size === 1 ? 'y' : 'ies'} and ${tagSnapshot.size} tag(s).`
  );

  const plan = [];

  for (const category of CATEGORIES) {
    const id = `cat-${category.slug}`;
    plan.push({
      collection: 'categories',
      id,
      verdict: decideCategory(existingCategoryIds, existingCategoryNames, id, category.name),
      data: {
        id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        domain: category.domain,
        questionsCount: 0,
        status: 'active'
      }
    });
  }

  for (const [name, description] of TAGS) {
    const id = tagId(name);
    plan.push({
      collection: 'tags',
      id,
      verdict: decideTag(existingTagIds, id),
      data: {
        id,
        name,
        description,
        count: 0,
        followersCount: 0
      }
    });
  }

  const width = Math.max(...plan.map(item => item.id.length));
  for (const item of plan) {
    const mark = item.verdict.action === 'create' ? 'CREATE' : 'skip  ';
    console.log(`${mark}  ${item.collection.padEnd(10)} ${item.id.padEnd(width)}  (${item.verdict.reason})`);
  }

  const pending = plan.filter(item => item.verdict.action === 'create');
  const skipped = plan.length - pending.length;
  console.log(`\n[seed-catalog] ${pending.length} to create, ${skipped} already present.`);

  if (pending.length === 0) return;
  if (!args.apply) {
    console.log('[seed-catalog] dry run - re-run with --apply to write the documents above.');
    return;
  }

  let written = 0;
  for (const item of pending) {
    try {
      // Re-check immediately before writing so a document created between the
      // scan and the write can never be clobbered.
      const current = await db.collection(item.collection).doc(item.id).get();
      if (current.exists) {
        console.log(`[seed-catalog] skipped ${item.collection}/${item.id} (created meanwhile)`);
        continue;
      }
      await db.collection(item.collection).doc(item.id).set(item.data);
    } catch (error) {
      failOperation(`writing ${item.collection}/${item.id}`, error);
    }
    written += 1;
    console.log(`[seed-catalog] created ${item.collection}/${item.id}`);
  }

  console.log(`[seed-catalog] wrote ${written} document(s).`);
}

main().catch(error => failOperation('running the seed script', error));
