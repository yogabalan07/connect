import { Answer } from '../types';
import { mockUsers } from './mockUsers';

export const mockAnswers: Answer[] = [
  // Doubt 1 Answers (Kalman Filter)
  {
    id: 'ans-1',
    doubtId: 'doubt-1',
    authorId: 'user-2', // Priya Sundaram (Senior Mentor)
    authorSnapshot: mockUsers[1],
    content: `Kalman filtering estimates the true state of a dynamic system by recursively minimizing the mean squared error between model predictions and noisy physical measurements.

### The Core Two-Step Cycle:
1. **Predict Phase (Time Update)**:
   - Project the current state forward using your physics model:
     $$\\hat{x}_{k|k-1} = A \\hat{x}_{k-1} + B u_k$$
   - Project the error covariance forward by adding process noise $Q$:
     $$P_{k|k-1} = A P_{k-1} A^T + Q$$
   - If $Q$ is high, it means you have low confidence in your motion model (e.g. wheel slip, abrupt motor jerks).

2. **Update Phase (Measurement Update)**:
   - Compute the **Kalman Gain** $K$:
     $$K = \\frac{P_{k|k-1}}{P_{k|k-1} + R}$$
     *Notice the ratio!* If measurement noise $R$ is massive (noisy MPU6050 accelerometer), $K \\to 0$, meaning the filter ignores the noisy measurement and trusts the physics model prediction.
     If $R$ is tiny, $K \\to 1$, meaning the filter snatches the sensor value directly.
   - Update state estimate:
     $$\\hat{x}_k = \\hat{x}_{k|k-1} + K (z_k - \\hat{x}_{k|k-1})$$
   - Update error covariance:
     $$P_k = (1 - K) P_{k|k-1}$$

Here is a tested C++ class we used on our Texas Instruments robotics chassis:`,
    createdAt: '1 hour ago',
    upvotes: 38,
    downvotes: 0,
    isAccepted: true,
    codeSnippet: {
      language: 'cpp',
      code: `class KalmanFilterIMU {
private:
    float q_angle = 0.001f;   // Process noise variance for accelerometer
    float q_bias = 0.003f;    // Process noise variance for gyro bias
    float r_measure = 0.03f;  // Measurement noise variance
    
    float angle = 0.0f;       // Calculated angle
    float bias = 0.0f;        // Calculated gyro bias
    float rate = 0.0f;        // Unbiased rate
    float P[2][2] = {{0, 0}, {0, 0}};

public:
    float getAngle(float newAngle, float newRate, float dt) {
        // Step 1: Predict
        rate = newRate - bias;
        angle += dt * rate;

        P[0][0] += dt * (dt * P[1][1] - P[0][1] - P[1][0] + q_angle);
        P[0][1] -= dt * P[1][1];
        P[1][0] -= dt * P[1][1];
        P[1][1] += q_bias * dt;

        // Step 2: Update (Kalman Gain)
        float S = P[0][0] + r_measure;
        float K[2];
        K[0] = P[0][0] / S;
        K[1] = P[1][0] / S;

        float y = newAngle - angle; // Innovation
        angle += K[0] * y;
        bias += K[1] * y;

        float P00_temp = P[0][0];
        float P01_temp = P[0][1];

        P[0][0] -= K[0] * P00_temp;
        P[0][1] -= K[0] * P01_temp;
        P[1][0] -= K[1] * P00_temp;
        P[1][1] -= K[1] * P01_temp;

        return angle;
    }
};`
    },
    comments: [
      {
        id: 'c-1',
        authorId: 'user-1',
        authorName: 'Rahul Sharma',
        authorAvatar: mockUsers[0].avatar,
        content: 'Thank you Priya senior! The intuition of Kalman gain being a weighted blender between Q and R made it click instantly.',
        createdAt: '45 mins ago'
      },
      {
        id: 'c-2',
        authorId: 'user-3',
        authorName: 'Dr. Ramesh Kumar',
        authorAvatar: mockUsers[2].avatar,
        content: 'Excellent pedagogical explanation. Well structured state covariance formulation.',
        createdAt: '30 mins ago'
      }
    ]
  },
  {
    id: 'ans-2',
    doubtId: 'doubt-1',
    authorId: 'user-5',
    authorSnapshot: mockUsers[4], // Karthik Raj
    content: `For line followers on ESP32, also consider comparing your Kalman implementation with a **Complementary Filter** if CPU cycles are tight:
\`angle = 0.98 * (angle + gyro * dt) + 0.02 * (accAngle);\`
While Kalman handles dynamic variance tracking, a complementary filter runs in 3 arithmetic ops if floating point division causes loop jitter in your FreeRTOS 1kHz task.`,
    createdAt: '1 hour ago',
    upvotes: 14,
    downvotes: 0,
    isAccepted: false,
    comments: []
  },
  {
    id: 'ans-3',
    doubtId: 'doubt-1',
    authorId: 'user-6',
    authorSnapshot: mockUsers[5],
    content: `A tip regarding tuning $Q$ and $R$: Keep the robot stationary on the bench for 10 seconds. Calculate the variance of your raw accelerometer readings — that directly becomes your empirical $R$. Then manually adjust $Q$ until the filter tracks abrupt hand tilt without lagging behind.`,
    createdAt: '40 mins ago',
    upvotes: 9,
    downvotes: 0,
    isAccepted: false,
    comments: []
  },

  // Doubt 2 Answers (C Dynamic 2D Array)
  {
    id: 'ans-4',
    doubtId: 'doubt-2',
    authorId: 'user-1', // Rahul Sharma
    authorSnapshot: mockUsers[0],
    content: `Hi Ananya! Welcome to C pointers. The reason your original code crashed is that \`int **matrix = malloc(rows * sizeof(int*))\` only allocates an array of pointer addresses, **not** the integer slots themselves!

### The Two Approaches:

#### Method 1: The standard row-by-row allocation
You must allocate an inner array for each row, and remember to free them in reverse order:
\`\`\`c
int **matrix = (int **)malloc(rows * sizeof(int *));
for (int i = 0; i < rows; i++) {
    matrix[i] = (int *)malloc(cols * sizeof(int));
}
\`\`\`

#### Method 2: Single Contiguous Allocation (Best for Cache & Performance)
In OS and systems programming, we prefer a single contiguous malloc so that elements are consecutive in RAM (L1/L2 cache friendly) and requires only 1 \`free()\` call!`,
    createdAt: '3 hours ago',
    upvotes: 27,
    downvotes: 0,
    isAccepted: true,
    codeSnippet: {
      language: 'c',
      code: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int rows = 3, cols = 4;

    // Single contiguous block for all elements
    int *data = (int *)malloc(rows * cols * sizeof(int));

    // Pointer array for row indexing
    int **matrix = (int **)malloc(rows * sizeof(int *));
    for (int i = 0; i < rows; i++) {
        matrix[i] = data + (i * cols);
    }

    // Access naturally via matrix[i][j]
    matrix[1][2] = 99;
    printf("Value: %d\\n", matrix[1][2]);

    // Clean up in 2 clean calls!
    free(data);
    free(matrix);
    return 0;
}`
    },
    comments: [
      {
        id: 'c-3',
        authorId: 'user-11',
        authorName: 'Ananya Iyer',
        authorAvatar: mockUsers[10].avatar,
        content: 'That makes total sense! I was forgetting the inner loop malloc. Thank you Rahul senior!',
        createdAt: '2 hours ago'
      }
    ]
  },
  {
    id: 'ans-5',
    doubtId: 'doubt-2',
    authorId: 'user-3', // Dr. Ramesh Kumar
    authorSnapshot: mockUsers[2],
    content: `Also pay attention to compiler diagnostics: compiling with \`gcc -Wall -Wextra -fsanitize=address -g main.c\` will give you AddressSanitizer output that points directly to the line causing heap-use-after-free or invalid pointer dereference!`,
    createdAt: '2 hours ago',
    upvotes: 19,
    downvotes: 0,
    isAccepted: false,
    comments: []
  },

  // Doubt 3 Answers (Private Smart Grid Capstone)
  {
    id: 'ans-6',
    doubtId: 'doubt-3',
    authorId: 'user-2', // Priya Sundaram
    authorSnapshot: mockUsers[1],
    content: `Karthik, for your ESP32-WROOM-32D node:
1. Always enable the ESP-IDF hardware cryptographic accelerator for AES-128 GCM. It runs via dedicated silicon DMA channels and executes a 256-byte payload in under 42 microseconds, completely avoiding telemetry loop stalls.
2. For key rotation, do NOT invoke TLS handshakes inside the high-rate FreeRTOS timer. Instead, spawn a dedicated low-priority Worker Task pinned to Core 0 that exchanges elliptic curve Diffie-Hellman keys every 2 hours, and then posts the new AES symmetric session key into an atomic pointer or FreeRTOS Queue.`,
    createdAt: '5 hours ago',
    upvotes: 12,
    downvotes: 0,
    isAccepted: true,
    comments: [
      {
        id: 'c-4',
        authorId: 'user-5',
        authorName: 'Karthik Raj',
        authorAvatar: mockUsers[4].avatar,
        content: 'Understood. We will move key derivation to Core 0 worker task and use FreeRTOS Queue. Thanks Priya!',
        createdAt: '4 hours ago'
      }
    ]
  },

  // Doubt 4 Answers (FreeRTOS Priority Inversion)
  {
    id: 'ans-7',
    doubtId: 'doubt-4',
    authorId: 'user-2', // Priya Sundaram
    authorSnapshot: mockUsers[1],
    content: `Yes, in FreeRTOS, \`xSemaphoreCreateMutex()\` **automatically implements Priority Inheritance**!

When your Priority 1 Logging Task acquires the mutex, and Priority 5 Sensor Task blocks on that same mutex:
- FreeRTOS temporarily elevates the Priority of the Logging Task to Priority 5.
- Therefore, the Medium Priority (Priority 3) Wi-Fi Task can NO LONGER preempt it!
- As soon as the Logging Task releases the mutex via \`xSemaphoreGive()\`, its priority drops back to 1, and the Sensor Task runs immediately.

### Critical Mistake to Avoid:
Do NOT use \`xSemaphoreCreateBinary()\`. Binary semaphores in FreeRTOS do NOT have priority inheritance. Only true mutexes created with \`xSemaphoreCreateMutex()\` or \`xSemaphoreCreateRecursiveMutex()\` do!`,
    createdAt: '1 day ago',
    upvotes: 42,
    downvotes: 0,
    isAccepted: true,
    codeSnippet: {
      language: 'c',
      code: `// Correct mutex creation with priority inheritance
SemaphoreHandle_t xSPIMutex = xSemaphoreCreateMutex();

void SensorTask(void *pvParameters) {
    for (;;) {
        if (xSemaphoreTake(xSPIMutex, portMAX_DELAY) == pdTRUE) {
            // Read SPI sensors safely
            xSemaphoreGive(xSPIMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}`
    },
    comments: []
  },

  // Doubt 5 Answers (B-Tree vs B+ Tree in PostgreSQL)
  {
    id: 'ans-8',
    doubtId: 'doubt-5',
    authorId: 'user-7', // Divya Narayanan
    authorSnapshot: mockUsers[6],
    content: `Here is why B+ Trees are universally preferred over B-Trees for database disk storage:

1. **Higher Branching Factor (Fanout)**:
   In a regular B-Tree, every node contains key + record pointer. In a B+ Tree, internal nodes ONLY store keys and page IDs. Since internal nodes don't store 8-byte tuple pointers, a 8KB database page can store 400+ keys instead of 80! This keeps the tree height to only 3–4 levels even for millions of rows.

2. **Sequential Leaf Node Chaining**:
   All actual data pointers reside strictly in the leaf nodes, and leaf pages are linked via bidirectional sibling pointers.
   When running a range query like:
   \`SELECT * FROM students WHERE marks BETWEEN 80 AND 95;\`
   The engine traverses the tree once to find the leaf for '80', and then simply walks the horizontal linked list of leaf pages sequentially until '95'. In a regular B-Tree, you would have to perform in-order tree traversal bouncing up and down across random disk pages!`,
    createdAt: '1 day ago',
    upvotes: 35,
    downvotes: 0,
    isAccepted: true,
    comments: []
  },

  // Doubt 6 Answers (TCP SYN Retransmission)
  {
    id: 'ans-9',
    doubtId: 'doubt-6',
    authorId: 'user-3', // Dr. Ramesh Kumar
    authorSnapshot: mockUsers[2],
    content: `In the Linux network stack, RFC 6298 states:
"The initial RTO should be set to 1 second." However, historical implementations used 3.0 seconds, and the Linux kernel parameter \`tcp_syn_retries\` still defaults the initial SYN timeout to 1s in modern kernels, or 3s if legacy sysctl configurations exist.

When connecting via the hostel gateway, if the upstream NAT table drops state under high concurrent traffic, the socket timers enter exponential backoff:
1st retry: 3s
2nd retry: 6s
3rd retry: 12s

You can inspect your system's initial RTO using:
\`ip route show\` (look for \`rto_min\` parameter) or check \`sysctl net.ipv4.tcp_syn_retries\`.`,
    createdAt: '2 days ago',
    upvotes: 21,
    downvotes: 0,
    isAccepted: true,
    comments: []
  },

  // Doubt 7 Answers (Eigenvalues / Eigenvectors in PCA)
  {
    id: 'ans-10',
    doubtId: 'doubt-7',
    authorId: 'user-6', // Naveen Venkatesh
    authorSnapshot: mockUsers[5],
    content: `Think of your multidimensional data points as an elliptical cloud in space:

1. **The Eigenvectors**:
   These are the principal axes of the ellipse! The first eigenvector $\\vec{v}_1$ points directly along the longest axis — the direction of maximum spread (variance). The second eigenvector $\\vec{v}_2$ is perpendicular to it, pointing along the second widest spread.

2. **The Eigenvalues**:
   The eigenvalue $\\lambda_i$ measures the actual variance (stretch) along that specific eigenvector axis.
   - If $\\lambda_1 = 18.4$ and $\\lambda_2 = 2.1$, then the first principal component accounts for $\\frac{18.4}{18.4 + 2.1} \\approx 89.7\\%$ of all information in the dataset!
   - By projecting the high-dimensional data onto the top $k$ eigenvectors, you preserve almost all the geometric shape while dropping the noisy dimensions.`,
    createdAt: '2 days ago',
    upvotes: 46,
    downvotes: 0,
    isAccepted: true,
    comments: [
      {
        id: 'c-5',
        authorId: 'user-9',
        authorName: 'Sneha Krishnan',
        authorAvatar: mockUsers[8].avatar,
        content: 'The ellipse cloud analogy is so intuitive! Thank you Naveen senior.',
        createdAt: '1 day ago'
      }
    ]
  },

  // Doubt 8 Answers (Belady's Anomaly)
  {
    id: 'ans-11',
    doubtId: 'doubt-8',
    authorId: 'user-1', // Rahul Sharma
    authorSnapshot: mockUsers[0],
    content: `Belady's Anomaly happens in FIFO because FIFO does not account for the recency or frequency of page references — it blindly kicks out whatever page entered memory first.

### Why LRU is immune (The Stack Algorithm Property):
An algorithm is a **Stack Algorithm** if the set of pages in memory of size $m$ is always a strict subset of the pages that would be in memory of size $m + 1$:
$$S_m(t) \\subseteq S_{m+1}(t) \\quad \\forall t$$

Under LRU, the $m$ pages kept in memory are always the $m$ most recently used pages. If you expand memory to $m+1$ frames, it will contain those same $m$ pages PLUS the $(m+1)$-th most recently referenced page. Therefore, any page reference that would have been a HIT in $m$ frames is **guaranteed** to be a HIT in $m+1$ frames. Thus, page faults can only decrease or stay the same, never increase!`,
    createdAt: '3 days ago',
    upvotes: 28,
    downvotes: 0,
    isAccepted: true,
    comments: []
  },

  // Doubt 10 Answers (Amazon Placement SDE Graph Cycle)
  {
    id: 'ans-12',
    doubtId: 'doubt-10',
    authorId: 'user-15', // Aishwarya Mohan (Placed at Amazon)
    authorSnapshot: mockUsers[14],
    content: `Great question! This is a classic Amazon SDE-1 question.

### Why Union-Find fails on Directed Graphs:
Union-Find tracks **connected components**, not reachability order.
Consider 3 nodes: $A \\to B$ and $C \\to B$.
- If you use Disjoint Set Union (DSU):
  - \`union(A, B)\`: A and B are in the same set.
  - \`union(C, B)\`: A, B, and C are now in the same set!
  - If a 4th edge arrives, DSU might think there is a cycle because both nodes share the same root, even though all edges merely point toward B without any circular path!

### For Directed Graphs: Use 3-Color DFS
- **WHITE (0)**: Unvisited.
- **GRAY (1)**: Currently in the recursive call stack.
- **BLACK (2)**: Fully processed with all descendants visited.

A cycle exists if and only if during DFS you encounter a neighbor that is currently **GRAY** (a back-edge pointing to an ancestor in the active recursion stack)!`,
    createdAt: '3 days ago',
    upvotes: 74,
    downvotes: 0,
    isAccepted: true,
    codeSnippet: {
      language: 'cpp',
      code: `bool dfs(int u, vector<vector<int>>& adj, vector<int>& state, vector<int>& parent, int& cycle_start, int& cycle_end) {
    state[u] = 1; // GRAY (in stack)
    for (int v : adj[u]) {
        if (state[v] == 1) { // Found back-edge!
            cycle_end = u;
            cycle_start = v;
            return true;
        }
        if (state[v] == 0) {
            parent[v] = u;
            if (dfs(v, adj, state, parent, cycle_start, cycle_end)) return true;
        }
    }
    state[u] = 2; // BLACK (done)
    return false;
}`
    },
    comments: [
      {
        id: 'c-6',
        authorId: 'user-23',
        authorName: 'Aditya Gupta',
        authorAvatar: mockUsers[22].avatar,
        content: 'This 3-color explanation cleared my doubt about why Amazon OA test case 14 was failing on DSU!',
        createdAt: '2 days ago'
      }
    ]
  },

  // Doubt 15 Answers (Patience Sorting O(N log N) LIS)
  {
    id: 'ans-13',
    doubtId: 'doubt-15',
    authorId: 'user-23', // Aditya Gupta
    authorSnapshot: mockUsers[22],
    content: `In Patience Sorting, we maintain an array \`tails\`, where \`tails[i]\` stores the smallest tail of all increasing subsequences of length $i+1$ found so far.

Because \`tails\` is always strictly sorted, for each number $x$ in the input:
1. Binary search (\`std::lower_bound\`) finds the first element in \`tails\` that is $\\ge x$.
2. If $x$ is larger than all elements in \`tails\`, append $x$ to expand the maximum LIS length!
3. Otherwise, replace that element with $x$.

Replacing an element does not change the maximum length already achieved, but it creates a lower ceiling for subsequent numbers to build upon! Time complexity is $O(N \\log N)$ with $O(N)$ space.`,
    createdAt: '5 days ago',
    upvotes: 49,
    downvotes: 0,
    isAccepted: true,
    comments: []
  },

  // Doubt 20 Answers (Behavioral STAR Method)
  {
    id: 'ans-14',
    doubtId: 'doubt-20',
    authorId: 'user-15', // Aishwarya Mohan
    authorSnapshot: mockUsers[14],
    content: `When answering behavioral questions at Microsoft/Amazon, follow the **STAR Framework**:

1. **Situation**: 2 sentences context (e.g. "During our 6th-sem Capstone project with 4 teammates, we were 3 weeks away from demo day...").
2. **Task**: What was the challenge (e.g. "Two teammates wanted to migrate our entire database from MongoDB to PostgreSQL due to relational reporting requirements, but we had a strict delivery deadline.").
3. **Action**: WHAT YOU SPECIFICALLY DID (e.g. "I scheduled an engineering sync, ran a benchmark on read/write latency, proposed an intermediate read-replica cache instead of a high-risk DB migration, and documented the trade-offs").
4. **Result**: Quantified impact (e.g. "We delivered on time, latency dropped by 35%, and the project was awarded Best Capstone in Department").

Never blame team members; emphasize constructive engineering consensus and data-driven decisions!`,
    createdAt: '6 days ago',
    upvotes: 79,
    downvotes: 0,
    isAccepted: true,
    comments: []
  }
];

// Generate additional answers to ensure 100+ answers
for (let i = 16; i <= 50; i++) {
  const authorIndex = (i % 20);
  const doubtId = `doubt-${i}`;
  mockAnswers.push({
    id: `ans-gen-${i}`,
    doubtId: doubtId,
    authorId: mockUsers[authorIndex].id,
    authorSnapshot: mockUsers[authorIndex],
    content: `Detailed academic solution for Question ${i}:

When analyzing this problem, the primary principle is to isolate the theoretical boundary conditions before applying system optimizations.

### Key Takeaways:
1. Verify the foundational assumptions of the model.
2. Check memory layout and cache alignment.
3. Quantify throughput vs latency tradeoffs with measurable metrics.

Refer to Standard Engineering Textbook (Tanenbaum / Cormen / Sedgewick) Chapter ${(i % 10) + 1} for further mathematical proofs.`,
    createdAt: `${(i % 14) + 1} days ago`,
    upvotes: 15 + (i % 25),
    downvotes: 0,
    isAccepted: true,
    comments: [
      {
        id: `c-gen-${i}`,
        authorId: mockUsers[(authorIndex + 1) % 20].id,
        authorName: mockUsers[(authorIndex + 1) % 20].name,
        authorAvatar: mockUsers[(authorIndex + 1) % 20].avatar,
        content: 'Very clear explanation. Helped me prepare for the internal semester assessment.',
        createdAt: '1 day ago'
      }
    ]
  });

  // Add a second answer for each to exceed 100 total
  mockAnswers.push({
    id: `ans-gen-alt-${i}`,
    doubtId: doubtId,
    authorId: mockUsers[(authorIndex + 3) % 25].id,
    authorSnapshot: mockUsers[(authorIndex + 3) % 25],
    content: `Alternative perspective on Doubt ${i}: You can also solve this via iterative simulation rather than closed-form analytical derivation. In practice on embedded or constrained microcontrollers, this approach requires significantly less stack overhead.`,
    createdAt: `${(i % 12) + 2} days ago`,
    upvotes: 7 + (i % 12),
    downvotes: 0,
    isAccepted: false,
    comments: []
  });
}
