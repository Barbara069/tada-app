/*
  script.js - Enhanced TODO App with Priority, Deadline & Sub-steps
  
  PURPOSE:
    Manage tasks with priority levels (High/Medium/Low), deadlines (due dates),
    and sub-steps (mini-tasks within each main task). Automatically sorts by urgency
    and tracks completion for both main tasks and sub-steps.
  
  KEY FUNCTIONS:
    - addTask(): Create new task from input form
    - createTaskElement(text, priority, deadline): Build task HTML structure
    - attachTaskEventHandlers(li): Wire up all interactive elements
    - sortByUrgency(): Reorder by priority (with deadline as tie-breaker)
    - sortByDeadline(): Reorder by deadline (earliest first)
    - updateCounters(): Refresh completion statistics
    - createSubstepElement(text): Build mini-task element
    - attachSubstepHandlers(li): Wire up sub-step interactive elements
    - handleTaskCompletion(): Trigger celebration confetti effect
*/

// ============================================
// CELEBRATION EFFECTS
// ============================================

/**
 * Trigger confetti explosion from center of screen
 * Called when a main task is marked as complete
 */
function handleTaskCompletion() {
  // Use global confetti (loaded via CDN in index.html)
  if (typeof window.confetti !== 'function') {
    return;
  }

  // Confetti explosion from center with varied particles
  window.confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.5 }
  });
}

// ============================================
// STORAGE MANAGER (Theme + Quick Notes + Daily Habits)
// ============================================

const STORAGE_KEY = 'myDashboard_v1';
const TASKS_STORAGE_KEY = 'myDashboard_tasks_v1';
const getThemeClass = (value) => (value.startsWith('theme-') ? value : `theme-${value}`);
const applyTheme = (value) => {
  document.body.className = getThemeClass(value || 'morning-coffee');
};

const themeSelect = document.getElementById('theme-select');
const quickMemoItems = Array.from(document.querySelectorAll('#quick-memo-pad .quick-memo-item'));
const sleepGoalInput = document.getElementById('sleep-goal-input');
const habitRows = Array.from(document.querySelectorAll('#daily-habits-widget .habit-item'));

function saveData() {
  const themeValue = themeSelect ? themeSelect.value : 'morning-coffee';
  applyTheme(themeValue);
  const quickNotes = quickMemoItems.map(item => (item.textContent || '').trim());

  const habits = habitRows
    .filter(row => row.dataset.habitId && row.dataset.habitId !== 'sleep-goal')
    .map(row => {
      const checkbox = row.querySelector('.habit-checkbox');
      const input = row.querySelector('.habit-input');
      return {
        text: input ? input.value : '',
        checked: checkbox ? checkbox.checked : false
      };
    });

  const data = {
    theme: themeValue,
    quickNotes,
    sleepGoal: sleepGoalInput ? sleepGoalInput.value : '',
    habits
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  console.log('Data saved');
}

function loadData() {
  let needsSave = false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const legacyTheme = localStorage.getItem('todo-theme');
    if (legacyTheme && themeSelect) {
      themeSelect.value = legacyTheme;
      applyTheme(legacyTheme);
      needsSave = true;
    }

    const legacyHabits = localStorage.getItem('daily-habits-widget');
    if (legacyHabits) {
      try {
        const legacy = JSON.parse(legacyHabits);
        if (sleepGoalInput && typeof legacy.sleepTime === 'string') {
          sleepGoalInput.value = legacy.sleepTime;
          needsSave = true;
        }
        if (legacy.active && typeof legacy.active === 'object') {
          const rows = habitRows.filter(row => row.dataset.habitId && row.dataset.habitId !== 'sleep-goal');
          rows.forEach((row, idx) => {
            const checkbox = row.querySelector('.habit-checkbox');
            const input = row.querySelector('.habit-input');
            const key = row.dataset.habitId;
            const saved = legacy.active[key] || legacy.active[`habit-${idx + 1}`];
            if (!saved) return;
            if (checkbox) checkbox.checked = !!saved.checked;
            if (input && typeof saved.value === 'string') {
              input.value = saved.value;
              needsSave = true;
            }
          });
        }
      } catch (e) {
        // ignore legacy parse errors
      }
    }

    return { loaded: false, needsSave };
  }
  try {
    const data = JSON.parse(raw);

    if (themeSelect && data.theme) {
      themeSelect.value = data.theme;
      applyTheme(data.theme);
    }

    if (Array.isArray(data.quickNotes)) {
      quickMemoItems.forEach((item, idx) => {
        item.textContent = data.quickNotes[idx] || '';
      });
    }

    if (sleepGoalInput && typeof data.sleepGoal === 'string') {
      sleepGoalInput.value = data.sleepGoal;
    }

    if (Array.isArray(data.habits)) {
      const rows = habitRows.filter(row => row.dataset.habitId && row.dataset.habitId !== 'sleep-goal');
      rows.forEach((row, idx) => {
        const checkbox = row.querySelector('.habit-checkbox');
        const input = row.querySelector('.habit-input');
        const saved = data.habits[idx];
        if (!saved) return;
        if (checkbox) checkbox.checked = !!saved.checked;
        if (input) input.value = saved.text || '';
      });
    }
    return { loaded: true, needsSave: false };
  } catch (e) {
    return { loaded: false, needsSave: false };
  }
}

if (themeSelect) {
  themeSelect.addEventListener('change', saveData);
}

quickMemoItems.forEach(item => {
  item.addEventListener('input', saveData);
  item.addEventListener('keyup', saveData);
  item.addEventListener('blur', saveData);
});

if (sleepGoalInput) {
  sleepGoalInput.addEventListener('input', saveData);
}

habitRows.forEach(row => {
  const checkbox = row.querySelector('.habit-checkbox');
  const input = row.querySelector('.habit-input');
  if (checkbox) checkbox.addEventListener('change', saveData);
  if (input) input.addEventListener('input', saveData);
});

const storageState = loadData();
if (themeSelect) {
  applyTheme(themeSelect.value || 'morning-coffee');
}

if (storageState && storageState.needsSave) {
  saveData();
}

window.addEventListener('beforeunload', saveData);
window.addEventListener('beforeunload', saveTasks);

// ============================================
// DOM REFERENCES - Cache frequently used elements
// ============================================

// Input box: where users type task descriptions
const inputBox = document.getElementById('input-box');

// List container: the <ul> element that holds all task <li> items
const listContainer = document.getElementById('list-container');

function serializeSubstep(subLi) {
  return {
    id: subLi.dataset.substepId || '',
    text: subLi.querySelector('.substep-text')?.textContent || '',
    completed: subLi.classList.contains('completed'),
    etaMin: subLi.dataset.etaMin || '',
    elapsedMs: subLi.dataset.elapsedMs || '0'
  };
}

function serializeTask(li) {
  return {
    id: li.dataset.taskId || '',
    text: li.querySelector('.task-text')?.textContent || '',
    desc: li.querySelector('.task-desc')?.value || '',
    deadline: li.dataset.deadline || '',
    etaMin: li.dataset.etaMin || '',
    completed: li.classList.contains('completed'),
    isUrgent: li.dataset.isUrgent || 'false',
    isImportant: li.dataset.isImportant || 'false',
    elapsedMs: li.dataset.elapsedMs || '0',
    collapsed: li.classList.contains('collapsed'),
    substeps: Array.from(li.querySelectorAll('.substeps-list > li')).map(serializeSubstep)
  };
}

function saveTasks() {
  if (!listContainer) return;
  const tasks = Array.from(listContainer.querySelectorAll(':scope > li')).map(serializeTask);
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  if (!listContainer) return;
  const raw = localStorage.getItem(TASKS_STORAGE_KEY);
  if (!raw) return;
  try {
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks)) return;
    listContainer.innerHTML = '';

    tasks.forEach(task => {
      const li = createTaskElement(task.text || 'Untitled', 'medium', task.deadline || '');
      if (task.id) li.dataset.taskId = task.id;
      li.dataset.isUrgent = task.isUrgent || 'false';
      li.dataset.isImportant = task.isImportant || 'false';
      li.dataset.elapsedMs = task.elapsedMs || '0';

      const desc = li.querySelector('.task-desc');
      if (desc) desc.value = task.desc || '';

      if (task.etaMin) {
        li.dataset.etaMin = task.etaMin;
        updateTaskEtaBadge(li, parseInt(task.etaMin, 10));
      }

      if (task.completed) {
        li.classList.add('completed');
        const checkbox = li.querySelector('.task-checkbox');
        if (checkbox) checkbox.checked = true;
      }

      if (task.collapsed) {
        li.classList.add('collapsed');
        const collapseBtn = li.querySelector('.collapse-btn');
        if (collapseBtn) collapseBtn.textContent = '▶';
      }

      attachTaskEventHandlers(li);

      const timerPanel = li.querySelector('.task-timer-panel');
      if (timerPanel) updateTimerDisplay(li, timerPanel, parseInt(li.dataset.elapsedMs || '0', 10));

      const subList = li.querySelector('.substeps-list');
      if (subList && Array.isArray(task.substeps)) {
        task.substeps.forEach(sub => {
          const subLi = createSubstepElement(sub.text || '');
          if (sub.id) subLi.dataset.substepId = sub.id;
          subLi.dataset.elapsedMs = sub.elapsedMs || '0';
          if (sub.etaMin) subLi.dataset.etaMin = sub.etaMin;

          if (sub.completed) {
            subLi.classList.add('completed');
            const cb = subLi.querySelector('.substep-checkbox');
            if (cb) cb.checked = true;
          }

          attachSubstepHandlers(subLi, li);
          subList.appendChild(subLi);

          const subTimer = subLi.querySelector('.substep-timer-panel');
          if (subTimer) updateTimerDisplay(subLi, subTimer, parseInt(subLi.dataset.elapsedMs || '0', 10));
        });
      }

      updateSubstepSummary(li);
      listContainer.appendChild(li);
    });

    updateCounters();
    renderMatrixView();
  } catch (e) {
    // ignore storage errors
  }
}

if (listContainer) {
  listContainer.addEventListener('input', saveTasks);
  listContainer.addEventListener('change', saveTasks);
  const listObserver = new MutationObserver(saveTasks);
  listObserver.observe(listContainer, { childList: true, subtree: true });
}

// View toggles and matrix container
const mainContent = document.getElementById('main-content');
const matrixView = document.getElementById('matrix-view');
const viewListBtn = document.getElementById('view-list-btn');
const viewMatrixBtn = document.getElementById('view-matrix-btn');
const quickMemoList = document.querySelector('.quick-memo-list');
const sleepGoalCheck = document.getElementById('sleep-goal-check');

// Clock panel
const currentTimeEl = document.getElementById('current-time');
const sleepReminderEl = document.getElementById('sleep-reminder');
const clockGreetingEl = document.getElementById('clock-greeting');
const sleepCountdownEl = document.getElementById('sleep-countdown');

// Counter displays for completed and uncompleted tasks
const completedCounter = document.getElementById('completed-counter');
const uncompletedCounter = document.getElementById('uncompleted-counter');

// Task ID counter for unique identification
let taskIdCounter = 0;

function initClock() {
  if (!currentTimeEl) return;

  const parseTimeInput = (str) => {
    if (!str) return null;
    const raw = str.trim().toLowerCase();
    const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const suffix = match[3];
    if (suffix) {
      if (hour === 12) hour = 0;
      if (suffix === 'pm') hour += 12;
    }
    if (hour > 23 || minute > 59) return null;

    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
  };

  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;

    if (clockGreetingEl) {
      const hourNum = now.getHours();
      let greeting = 'Time to recharge! 🔋';

      if (hourNum >= 8 && hourNum < 12) {
        greeting = 'Good morning! ☀️';
      } else if (hourNum >= 12 && hourNum < 13) {
        greeting = 'Time for lunch! 🍔';
      } else if (hourNum >= 13 && hourNum < 17) {
        greeting = 'Coffee time! ☕';
      } else if (hourNum >= 0 && hourNum < 5) {
        greeting = 'Go to bed! 🌙';
      }

      if (clockGreetingEl.textContent !== greeting) {
        clockGreetingEl.textContent = greeting;
        clockGreetingEl.classList.remove('fade-in');
        void clockGreetingEl.offsetWidth;
        clockGreetingEl.classList.add('fade-in');
      }
    }

    if (sleepReminderEl) {
      const hourNum = now.getHours();
      const isSleepTime = hourNum >= 2 && hourNum < 5;
      sleepReminderEl.textContent = isSleepTime ? '🌙 该休息了' : '';
      sleepReminderEl.classList.toggle('active', isSleepTime);
    }

    if (sleepCountdownEl && sleepGoalInput) {
      const goal = parseTimeInput(sleepGoalInput.value);
      const checked = sleepGoalCheck?.checked;
      if (goal && !checked) {
        const diffMs = goal.getTime() - now.getTime();
        const seconds = Math.max(0, Math.floor(diffMs / 1000));
        const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const ss = String(seconds % 60).padStart(2, '0');
        sleepCountdownEl.textContent = `Sleep in ${hh}:${mm}:${ss}`;
        sleepCountdownEl.style.display = 'inline-flex';
      } else {
        sleepCountdownEl.textContent = '';
        sleepCountdownEl.style.display = 'none';
      }
    }
  };

  updateClock();
  setInterval(updateClock, 1000);
}

if (inputBox) {
  autoResizeInput(inputBox);
  inputBox.addEventListener('input', () => autoResizeInput(inputBox));
  inputBox.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && text.includes('\n')) {
      const lineBreaks = (text.match(/\n/g) || []).length;
      if (lineBreaks >= 3) {
        e.preventDefault();
        pendingPasteText = text;
        showSmartPasteToast(inputBox, '📋 List detected! Create sub-steps?', () => {
          const { description, subSteps } = smartParsePaste(pendingPasteText);
          const title = description.split('\n').filter(Boolean)[0] || 'New Task';
          inputBox.value = title;
          autoResizeInput(inputBox);
          createTaskWithSubsteps(title, description, subSteps);
          inputBox.value = '';
          autoResizeInput(inputBox);
          pendingPasteText = '';
        });
      } else {
        e.preventDefault();
        const { description, subSteps } = smartParsePaste(text);
        const title = description.split('\n').filter(Boolean)[0] || 'New Task';
        inputBox.value = title;
        autoResizeInput(inputBox);
        createTaskWithSubsteps(title, description, subSteps);
        inputBox.value = '';
        autoResizeInput(inputBox);
      }
    }
  });
}

initClock();

function createMatrixTaskItem(taskLi) {
  const item = document.createElement('li');
  item.className = 'matrix-task-item';
  item.textContent = taskLi.querySelector('.task-text')?.textContent || 'Untitled';
  return item;
}

function setActiveView(view) {
  if (!matrixView) return;
  const isMatrix = view === 'matrix';
  matrixView.classList.toggle('hidden', !isMatrix);
  if (viewListBtn) viewListBtn.classList.toggle('active', !isMatrix);
  if (viewMatrixBtn) viewMatrixBtn.classList.toggle('active', isMatrix);
  if (isMatrix) renderMatrixView();
}

if (quickMemoList) {
  quickMemoList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const target = e.target;
    if (!target || !target.classList.contains('quick-memo-item')) return;
    const newItem = document.createElement('li');
    newItem.className = 'quick-memo-item';
    newItem.setAttribute('contenteditable', 'true');
    target.insertAdjacentElement('afterend', newItem);
    newItem.focus();
  });
}

if (viewListBtn) {
  viewListBtn.addEventListener('click', () => setActiveView('list'));
}
if (viewMatrixBtn) {
  viewMatrixBtn.addEventListener('click', () => setActiveView('matrix'));
}

// ============================================
// TIMER CARD MANAGEMENT (Right Column)
// ============================================

function createTaskTimerPanel(taskElement) {
  const panel = document.createElement('div');
  panel.className = 'task-timer-panel';
  panel.innerHTML = `
    <span class="timer-display">00:00:00</span>
    <div class="timer-buttons">
      <button type="button" class="timer-start-btn" aria-label="Start"><img src="assets/icons/play.svg" alt="Start"></button>
      <button type="button" class="timer-pause-btn timer-btn-hidden" aria-label="Pause"><img src="assets/icons/pause.svg" alt="Pause"></button>
      <button type="button" class="timer-reset-btn" aria-label="Reset"><img src="assets/icons/rotate-ccw.svg" alt="Reset"></button>
    </div>
    <span class="timer-status"></span>
  `;

  if (!taskElement.dataset.elapsedMs) taskElement.dataset.elapsedMs = '0';

  const startBtn = panel.querySelector('.timer-start-btn');
  const pauseBtn = panel.querySelector('.timer-pause-btn');
  const resetBtn = panel.querySelector('.timer-reset-btn');

  if (startBtn) startBtn.addEventListener('click', () => startTimer(taskElement, panel));
  if (pauseBtn) pauseBtn.addEventListener('click', () => pauseTimer(taskElement, panel));
  if (resetBtn) resetBtn.addEventListener('click', () => resetTimer(taskElement, panel));

  updateTimerDisplay(taskElement, panel, parseInt(taskElement.dataset.elapsedMs || '0', 10));

  if (taskElement.classList.contains('completed')) {
    panel.classList.add('timer-completed');
    const status = panel.querySelector('.timer-status');
    if (status) status.textContent = '🌟 Nice! Done';
  }

  if (taskElement.dataset.timerRunning === 'true') {
    startBtn?.classList.add('timer-btn-hidden');
    pauseBtn?.classList.remove('timer-btn-hidden');
  }

  return panel;
}

function createSubstepTimerPanel(substepElement) {
  const panel = document.createElement('div');
  panel.className = 'substep-timer-panel';
  panel.innerHTML = `
    <span class="timer-display">00:00:00</span>
    <button type="button" class="substep-timer-toggle" aria-label="Start">
      <img src="assets/icons/play.svg" alt="Start">
    </button>
  `;

  if (!substepElement.dataset.elapsedMs) substepElement.dataset.elapsedMs = '0';
  updateTimerDisplay(substepElement, panel, parseInt(substepElement.dataset.elapsedMs || '0', 10));

  const toggleBtn = panel.querySelector('.substep-timer-toggle');
  const toggleImg = toggleBtn?.querySelector('img');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const running = substepElement.dataset.timerRunning === 'true';
      if (running) {
        pauseTimer(substepElement, panel);
        if (toggleImg) {
          toggleImg.src = 'assets/icons/play.svg';
          toggleImg.alt = 'Start';
        }
      } else {
        startTimer(substepElement, panel);
        if (toggleImg) {
          toggleImg.src = 'assets/icons/pause.svg';
          toggleImg.alt = 'Pause';
        }
      }
    });
  }

  return panel;
}

/**
 * Sync substep completion state to its timer card (encouraging feedback).
 * @param {HTMLElement} subLi - The sub-step element
 */
function syncSubstepTimerCompletion(subLi) {
  const timerPanel = subLi.querySelector('.substep-timer-panel');
  if (!timerPanel) return;

  const status = timerPanel.querySelector('.timer-status');
  if (subLi.classList.contains('completed')) {
    timerPanel.classList.add('timer-completed');
    if (status) status.textContent = '🌟 Nice! Done';
  } else {
    timerPanel.classList.remove('timer-completed');
    if (status) status.textContent = '';
  }
}

/**
 * Sync main task completion state to its timer card (encouraging feedback).
 * @param {HTMLElement} taskLi - The main task element
 */
function syncTaskTimerCompletion(taskLi) {
  const timerPanel = taskLi.querySelector('.task-timer-panel');
  if (!timerPanel) return;

  const status = timerPanel.querySelector('.timer-status');
  if (taskLi.classList.contains('completed')) {
    timerPanel.classList.add('timer-completed');
    if (status) status.textContent = '🌟 Nice! Done';
  } else {
    timerPanel.classList.remove('timer-completed');
    if (status) status.textContent = '';
  }
}

/**
 * Update timer card's ETA display
 */
function updateTimerCardETA(taskElement, card) {
  const panel = card || taskElement.querySelector('.task-timer-panel') || taskElement.querySelector('.substep-timer-panel');
  if (!panel) return;
  const etaMin = taskElement.dataset.etaMin;
  const etaDisplayEl = panel.querySelector('.eta-display');
  if (etaDisplayEl) {
    etaDisplayEl.textContent = etaMin ? `ETA: ${etaMin} min` : '';
  }
}

/**
 * Rebuild all timer cards in the right column
 */
function rebuildTimerCards() {
  return;
}

/**
 * Move a completed task to the bottom and rebuild its timers order.
 * @param {HTMLElement} taskLi
 */
function moveCompletedTaskToBottom(taskLi) {
  if (!taskLi) return;
  listContainer.appendChild(taskLi);
}

// ============================================
// PRIORITY FUNCTIONS
// ============================================

/**
 * Apply a priority CSS class to a task and store its priority in data attribute.
 * Removes old priority classes to avoid duplicates.
 * @param {HTMLElement} li - The task element
 * @param {string} priority - 'high', 'medium', or 'low'
 */
function applyPriorityClass(li, priority) {
  // Remove all old priority classes to prevent style conflicts
  li.classList.remove('priority-high', 'priority-medium', 'priority-low');
  
  // Add the appropriate new class based on priority value
  if (priority === 'high') li.classList.add('priority-high');
  else if (priority === 'medium') li.classList.add('priority-medium');
  else li.classList.add('priority-low');
  
  // Store in data attribute so sorting functions can read it later
  li.dataset.priority = priority;
}

/**
 * Apply effort badge styling and text (low vs high energy).
 * @param {HTMLElement} li - The task element
 * @param {string} effort - 'low' or 'high'
 */
function applyEffortBadge(li, effort) {
  const badge = li.querySelector('.effort-badge');
  if (!badge) return;

  badge.classList.remove('effort-low', 'effort-high');
  if (effort === 'high') {
    badge.classList.add('effort-high');
    badge.textContent = '🧠 High Focus';
  } else {
    badge.classList.add('effort-low');
    badge.textContent = '⚡ Quick';
  }

  li.dataset.effort = effort;
}

/**
 * Sort all tasks by urgency: High → Medium → Low.
 * Tied priorities are broken by earliest deadline first.
 * Reorders tasks in the DOM to reflect new sort order.
 */
function sortByUrgency() {
  // Map each priority level to a numeric weight (higher = more urgent)
  const order = { high: 3, medium: 2, low: 1 };
  
  // Get all task elements and convert to array (so we can use .sort())
  const items = Array.from(listContainer.querySelectorAll(':scope > li'));
  
  // Sort the array by priority first, then by deadline
  items.sort((a, b) => {
    // Read priority from data attribute (default to 'medium' if missing)
    const pa = order[a.dataset.priority || 'medium'];
    const pb = order[b.dataset.priority || 'medium'];
    
    // If priorities differ, sort by priority (higher number first)
    if (pb !== pa) return pb - pa;
    
    // TIE-BREAKER: If same priority, sort by deadline (earliest first)
    // Tasks without deadline are treated as Infinity (pushed to end)
    const da = a.dataset.deadline ? new Date(a.dataset.deadline).getTime() : Infinity;
    const db = b.dataset.deadline ? new Date(b.dataset.deadline).getTime() : Infinity;
    
    return da - db;  // Earlier date comes first
  });
  
  // Re-append sorted tasks to DOM in new order
  items.forEach(item => listContainer.appendChild(item));
  // Rebuild timers to match new task order
  rebuildTimerCards();
  
  // Refresh completion counters after reordering
  updateCounters();
}

// Wire up "Sort by Urgency" button (only if it exists in HTML)
const sortButton = document.getElementById('sort-button');
if (sortButton) sortButton.addEventListener('click', sortByUrgency);

// ============================================
// DEADLINE FUNCTIONS
// ============================================

/**
 * Calculate and display countdown to deadline with color coding
 * @param {HTMLElement} li - The task element
 */
function updateDeadlineCountdown(li) {
  const deadline = li.dataset.deadline;
  const countdownEl = li.querySelector('.deadline-countdown');
  if (!countdownEl) return;
  
  if (!deadline) {
    countdownEl.textContent = '';
    countdownEl.className = 'deadline-countdown';
    return;
  }
  
  const now = new Date();
  const deadlineDate = new Date(deadline + 'T23:59:59'); // End of deadline day
  const diffMs = deadlineDate - now;
  
  if (diffMs < 0) {
    // Overdue
    const overdueDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    const overdueHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60)) % 24;
    countdownEl.textContent = `⚠️ Overdue: ${overdueDays}d ${overdueHours}h`;
    countdownEl.className = 'deadline-countdown overdue';
  } else {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
    const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
    
    // Determine urgency and color
    const totalHours = diffMs / (1000 * 60 * 60);
    let className = 'deadline-countdown';
    let emoji = '⏰';
    
    if (totalHours < 24) {
      // Less than 1 day - critical (red)
      className += ' critical';
      emoji = '🔥';
      countdownEl.textContent = `${emoji} ${hours}h ${minutes}m`;
    } else if (totalHours < 48) {
      // Less than 2 days - urgent (orange)
      className += ' urgent';
      emoji = '⚡';
      countdownEl.textContent = `${emoji} ${days}d ${hours}h`;
    } else if (totalHours < 168) {
      // Less than 7 days - warning (yellow)
      className += ' warning';
      emoji = '⏳';
      countdownEl.textContent = `${emoji} ${days}d ${hours}h`;
    } else {
      // More than 7 days - safe (green)
      className += ' safe';
      emoji = '✅';
      countdownEl.textContent = `${emoji} ${days} days`;
    }
    
    countdownEl.className = className;
  }
}

/**
 * Start countdown update interval for all tasks with deadlines
 */
function startCountdownUpdates() {
  // Update all countdowns every minute
  setInterval(() => {
    const tasks = listContainer.querySelectorAll('li[data-deadline]');
    tasks.forEach(task => updateDeadlineCountdown(task));
  }, 60000); // Update every minute
  
  // Initial update
  const tasks = listContainer.querySelectorAll('li[data-deadline]');
  tasks.forEach(task => updateDeadlineCountdown(task));
}

/**
 * Apply or clear a deadline for a task.
 * Stores deadline in data attribute and displays friendly "Due: MM/DD/YYYY" label.
 * @param {HTMLElement} li - The task element
 * @param {string} deadline - ISO date string (e.g. "2026-02-15") or empty to clear
 */
function applyDeadline(li, deadline) {
  const inputEl = li.querySelector('.deadline-input');
  if (inputEl) inputEl.value = deadline || '';

  // If no deadline: remove all deadline-related attributes and styling
  if (!deadline) {
    li.removeAttribute('data-deadline');
    li.classList.remove('has-deadline');  // Remove deadline styling
    updateDeadlineCountdown(li); // Clear countdown
  } else {
    // Store deadline in data attribute for sorting operations
    li.dataset.deadline = deadline;
    
    // Add CSS class to highlight that this task has a deadline
    li.classList.add('has-deadline');
    
    // Update countdown display
    updateDeadlineCountdown(li);
  }

  // Recompute importance/urgency based on deadline
}

/**
 * Sort all tasks by deadline: earliest first.
 * Tasks without a deadline appear at the end.
 */
function sortByDeadline() {
  // Get all tasks and convert to array
  const items = Array.from(listContainer.querySelectorAll(':scope > li'));
  
  // Sort by deadline: convert to milliseconds for numeric comparison
  items.sort((a, b) => {
    // No deadline = Infinity (sorts to the end)
    const da = a.dataset.deadline ? new Date(a.dataset.deadline).getTime() : Infinity;
    const db = b.dataset.deadline ? new Date(b.dataset.deadline).getTime() : Infinity;
    
    return da - db;  // Earlier deadline comes first
  });
  
  // Re-append sorted tasks to DOM
  items.forEach(item => listContainer.appendChild(item));
  // Rebuild timers to match new task order
  rebuildTimerCards();
  updateCounters();
}

// Wire up "Sort by Deadline" button (only if it exists in HTML)
const sortDeadlineButton = document.getElementById('sort-deadline-button');
if (sortDeadlineButton) sortDeadlineButton.addEventListener('click', sortByDeadline);

// Start countdown updates
startCountdownUpdates();

// -------------------
// Global progress helpers
// -------------------
/**
 * Refresh the progress bar and summary for a parent task.
 * Kept global so other functions can call it.
 */
function refreshProgressUI(parentLi, completed, total, pct) {
  const progressBar = parentLi.querySelector('.progress-bar');
  const progressPercent = parentLi.querySelector('.progress-percent');
  const summaryEl = parentLi.querySelector('.substep-summary');
  if (progressBar) progressBar.style.width = (pct || 0) + '%';
  if (progressPercent) progressPercent.textContent = (pct || 0) + '%';
  if (summaryEl) summaryEl.textContent = total > 0 ? `${completed}/${total} (${pct}%)` : '';
}

/**
 * Compute and apply sub-step summary and progress for a parent task.
 * If all sub-steps are complete, mark parent as completed.
 */
function updateSubstepSummary(parentLi) {
  const sList = parentLi.querySelectorAll('.substeps-list > li');
  const total = sList.length;
  const completed = parentLi.querySelectorAll('.substeps-list > li.substep.completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  refreshProgressUI(parentLi, completed, total, pct);

  // Auto-complete parent if all sub-steps are completed
  const parentCheckbox = parentLi.querySelector('.task-checkbox');
  if (completed > 0 && completed === total) {
    parentLi.classList.add('completed');
    if (parentCheckbox) parentCheckbox.checked = true;
  } else {
    parentLi.classList.remove('completed');
    if (parentCheckbox) parentCheckbox.checked = false;
  }
  updateCounters();
}

// =================
// TIMERS IMPLEMENTATION
// =================

/**
 * Format milliseconds to HH:MM:SS
 * @param {number} ms - milliseconds
 * @returns {string} formatted time
 */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

/**
 * Start timer for given element (task or sub-step). Stores elapsed in data attribute and interval id on element.
 * @param {HTMLElement} el - The task or substep element
 * @param {HTMLElement} card - The timer card in the right column
 */
function startTimer(el, card) {
  // Prevent multiple intervals
  if (el._timerInterval) return;
  // parse stored elapsed ms
  let elapsed = parseInt(el.dataset.elapsedMs || '0', 10);
  // update display immediately (in case)
  updateTimerDisplay(el, card, elapsed);
  // set interval to add 1000ms every second
  el._timerInterval = setInterval(() => {
    elapsed += 1000;
    el.dataset.elapsedMs = String(elapsed);
    updateTimerDisplay(el, card, elapsed);
  }, 1000);
  el.dataset.timerRunning = 'true';
  if (card) {
    card.querySelector('.timer-start-btn')?.classList.add('timer-btn-hidden');
    card.querySelector('.timer-pause-btn')?.classList.remove('timer-btn-hidden');
  }
}

/**
 * Pause timer for given element
 * @param {HTMLElement} el - The task or substep element
 * @param {HTMLElement} card - The timer card in the right column
 */
function pauseTimer(el, card) {
  if (el._timerInterval) {
    clearInterval(el._timerInterval);
    el._timerInterval = null;
  }
  el.dataset.timerRunning = 'false';
  if (card) {
    card.querySelector('.timer-start-btn')?.classList.remove('timer-btn-hidden');
    card.querySelector('.timer-pause-btn')?.classList.add('timer-btn-hidden');
  }
}

/**
 * Reset timer for element
 * @param {HTMLElement} el - The task or substep element
 * @param {HTMLElement} card - The timer card in the right column
 */
function resetTimer(el, card) {
  pauseTimer(el, card);
  el.dataset.elapsedMs = '0';
  updateTimerDisplay(el, card, 0);
  if (card) {
    card.querySelector('.timer-start-btn')?.classList.remove('timer-btn-hidden');
    card.querySelector('.timer-pause-btn')?.classList.add('timer-btn-hidden');
  }
}

/**
 * Update the visible timer display for element (now updates the card in right column)
 * @param {HTMLElement} el - The task or substep element
 * @param {HTMLElement} card - The timer card in the right column
 * @param {number} elapsed - Elapsed milliseconds
 */
function updateTimerDisplay(el, panel, elapsed) {
  const container = panel || el;
  if (!container) return;
  const display = container.querySelector('.timer-display');
  if (display) display.textContent = formatTime(elapsed);
}

// =================
// DRAG AND DROP for top-level tasks
// =================

// Helper: find the element after which the dragged element should be inserted
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(':scope > li:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Handle dragstart/dragend at task creation (we will add handlers for each li when created)

// Wire dragover on container to support dropping anywhere
listContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  const afterElement = getDragAfterElement(listContainer, e.clientY);
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;
  if (afterElement == null) listContainer.appendChild(dragging);
  else listContainer.insertBefore(dragging, afterElement);
});


// ============================================
// SUB-STEPS (MINI TASKS) FUNCTIONS
// ============================================

/**
 * Create a visual element for a sub-step (mini-task nested within a main task).
 * Each sub-step has a checkbox, text label, and delete button.
 * @param {string} text - The sub-step description
 * @return {HTMLElement} - An <li> element with checkbox + text + delete button
 */
function createSubstepElement(text) {
  // Create a new list item for the sub-step
  const s = document.createElement('li');
  
  // Mark with CSS class so it's styled differently from main tasks
  s.className = 'substep';
  
  // Initialize timer elapsed (ms) to 0
  s.dataset.elapsedMs = '0';
  
  // Set up HTML: checkbox + text label + delete button
  s.innerHTML = `
    <div class="substep-left">
      <input type="checkbox" class="substep-checkbox">
      <span class="substep-text"></span>
    </div>
    <div class="substep-right">
      <input type="number" class="substep-eta-input" min="0" placeholder="ETA" aria-label="Sub-step ETA">
      <span class="substep-eta-display"></span>
      <div class="substep-timer-panel">
        <span class="timer-display">00:00:00</span>
        <button type="button" class="substep-timer-toggle" aria-label="Start">
          <img src="assets/icons/play.svg" alt="Start">
        </button>
      </div>
      <button type="button" class="delete-substep-btn" aria-label="Delete sub-step"><img src="assets/icons/delete.svg" alt="Delete"></button>
    </div>
  `;
  
  // Set the text (using textContent to prevent XSS vulnerabilities)
  s.querySelector('.substep-text').textContent = text;

  const timerPanel = s.querySelector('.substep-timer-panel');
  if (timerPanel) {
    const panel = createSubstepTimerPanel(s);
    timerPanel.replaceWith(panel);
  }
  
  return s;
}

/**
 * Attach event listeners to a sub-step element.
 * Handles checkbox (mark complete) and delete button (remove sub-step).
 * @param {HTMLElement} subLi - The sub-step <li> element
 */
function attachSubstepHandlers(subLi, parentLi) {
  // Get the checkbox and delete button within this sub-step
  const cb = subLi.querySelector('.substep-checkbox');
  const del = subLi.querySelector('.delete-substep-btn');
  
  /**
   * Checkbox handler: Toggle 'completed' class
   * When checked, adds strikethrough styling; when unchecked, removes it.
   * After toggling, update the parent task's substep summary and possibly auto-complete the parent.
   */
  cb.addEventListener('click', function () {
    // Toggle class based on checkbox.checked boolean value
    subLi.classList.toggle('completed', cb.checked);
    // Sync timer card completion state with encouraging feedback
    syncSubstepTimerCompletion(subLi);
    if (parentLi) updateSubstepSummary(parentLi);
  });
  
  // ETA input for sub-step
  const etaInp = subLi.querySelector('.substep-eta-input');
  if (etaInp) {
    etaInp.addEventListener('change', function () {
      const v = etaInp.value.trim();
      if (v) {
        subLi.dataset.etaMin = String(parseInt(v, 10));
        const d = subLi.querySelector('.substep-eta-display'); if (d) d.textContent = v + ' min';
        updateTimerCardETA(subLi);
      } else {
        subLi.removeAttribute('data-eta-min');
        const d = subLi.querySelector('.substep-eta-display'); if (d) d.textContent = '';
        updateTimerCardETA(subLi);
      }
    });
  }

  /**
   * Delete button handler: Remove this sub-step from the DOM and clear timers
   */
  del.addEventListener('click', function () {
    if (subLi._timerInterval) { clearInterval(subLi._timerInterval); subLi._timerInterval = null; }
    subLi.remove();
    if (parentLi) updateSubstepSummary(parentLi);
  });
}

/**
 * Inline edit helper: replace the task text element with an input for editing.
 * Supports Enter to save, Escape to cancel, and blur to save.
 */
function startInlineEdit(li, taskSpan, checkbox) {
  // If an editor already exists, do not create another
  if (li.querySelector('.task-edit-input')) return;

  const original = taskSpan.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = original;

  // Insert input before the span and hide the original span
  taskSpan.parentNode.insertBefore(input, taskSpan);
  taskSpan.style.display = 'none';
  input.focus();
  input.select();

  let done = false;
  function finish(save) {
    if (done) return; done = true;
    if (save) {
      const val = input.value.trim();
      if (!val) {
        alert('Task name cannot be empty');
        input.focus();
        done = false; // allow further editing
        return;
      }
      taskSpan.textContent = val;
      // Editing implies active work; clear completed state
      li.classList.remove('completed');
      checkbox.checked = false;
      updateCounters();
      renderMatrixView();
    }
    input.remove();
    taskSpan.style.display = '';
  }

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', function () { finish(true); });
}

/**
 * Auto-resize a textarea to fit its content.
 * @param {HTMLTextAreaElement} el
 */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/**
 * Auto-resize the main input box width based on content length.
 * @param {HTMLInputElement} el
 */
function autoResizeInput(el) {
  if (!el) return;
  const value = el.value || '';
  const chars = Math.min(Math.max(value.length + 1, 10), 42);
  el.style.width = `${chars}ch`;
}

/**
 * Get task category based on ETA minutes.
 * @param {number} etaMin
 * @returns {{label: string, icon: string, color: string, bg: string}}
 */
function getTaskCategory(etaMin) {
  if (etaMin < 15) {
    return { label: 'Quick', icon: '⚡', color: 'text-emerald-400', bg: 'bg-emerald-400/20' };
  }
  if (etaMin >= 15 && etaMin <= 60) {
    return { label: 'Core', icon: '🎯', color: 'text-blue-400', bg: 'bg-blue-400/20' };
  }
  return { label: 'Major', icon: '🏆', color: 'text-amber-400', bg: 'bg-amber-400/20' };
}

/**
 * Update the ETA badge next to task timestamp.
 * @param {HTMLElement} taskLi
 * @param {number|null} etaMin
 */
function updateTaskEtaBadge(taskLi, etaMin) {
  const badge = taskLi.querySelector('.eta-badge');
  if (!badge) return;

  if (typeof etaMin !== 'number' || Number.isNaN(etaMin)) {
    badge.textContent = '';
    badge.className = 'eta-badge';
    return;
  }

  const category = getTaskCategory(etaMin);
  badge.textContent = `${category.icon} ${category.label}`;
  badge.className = `eta-badge ${category.color} ${category.bg}`;
}

function getIconPath(isUrgent, isImportant) {
  if (isUrgent && isImportant) return './assets/icons/rocket.png';
  if (!isUrgent && isImportant) return './assets/icons/diamond.png';
  if (isUrgent && !isImportant) return './assets/icons/lightning.png';
  return './assets/icons/latte.png';
}

function updateStatusIcon(taskLi) {
  const icon = taskLi.querySelector('.status-icon');
  if (!icon) return;
  const isUrgent = taskLi.dataset.isUrgent === 'true';
  const isImportant = taskLi.dataset.isImportant === 'true';
  icon.src = getIconPath(isUrgent, isImportant);
}

function getPriorityScore(isUrgent, isImportant) {
  if (isUrgent && isImportant) return 4;
  if (!isUrgent && isImportant) return 3;
  if (isUrgent && !isImportant) return 2;
  return 1;
}

function updateMatrixIcon(container, urgentOverride, importantOverride) {
  const icon = container.querySelector('.matrix-icon');
  if (!icon) return;
  const touched = container.dataset.matrixTouched === 'true';
  if (!touched) {
    icon.classList.add('matrix-icon-hidden');
    return;
  }
  const isUrgent = typeof urgentOverride === 'boolean'
    ? urgentOverride
    : container.dataset.isUrgent === 'true';
  const isImportant = typeof importantOverride === 'boolean'
    ? importantOverride
    : container.dataset.isImportant !== 'false';
  icon.src = getIconPath(isUrgent, isImportant);
  icon.classList.remove('matrix-icon-hidden');
}

function sortTasks() {
  const items = Array.from(listContainer.querySelectorAll(':scope > li'));
  items.sort((a, b) => {
    const aUrgent = a.dataset.isUrgent === 'true';
    const aImportant = a.dataset.isImportant !== 'false';
    const bUrgent = b.dataset.isUrgent === 'true';
    const bImportant = b.dataset.isImportant !== 'false';
    return getPriorityScore(bUrgent, bImportant) - getPriorityScore(aUrgent, aImportant);
  });
  items.forEach(item => listContainer.appendChild(item));
  rebuildTimerCards();
  updateCounters();
  renderMatrixView();
}

/**
 * Auto-breakdown pasted text into title + steps.
 * @param {string} text
 * @returns {{title: string, steps: string[]}}
 */
function smartParsePaste(text) {
  const raw = (text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return { description: '', subSteps: [] };

  const lines = raw.split('\n');
  const listRegex = /^\s*(\d+\.|[-*•])\s+/;
  const subSteps = [];
  const descriptionLines = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (listRegex.test(trimmed)) {
      subSteps.push(trimmed);
    } else {
      descriptionLines.push(line);
    }
  });

  return { description: descriptionLines.join('\n').trim(), subSteps };
}

/**
 * Append substeps to an existing task and create timer cards.
 * @param {HTMLElement} taskLi
 * @param {string[]} subSteps
 */
function addSubstepsToTask(taskLi, subSteps) {
  if (!taskLi || !Array.isArray(subSteps) || !subSteps.length) return;
  const subList = taskLi.querySelector('.substeps-list');
  if (!subList) return;

  const created = [];

  subSteps.forEach(stepText => {
    const s = createSubstepElement(stepText);
    s.dataset.substepId = 'substep-' + (taskIdCounter++);
    attachSubstepHandlers(s, taskLi);
    subList.appendChild(s);
    created.push(s);
  });

  updateSubstepSummary(taskLi);

  return created;
}

let pendingPasteText = '';

function showSmartPasteToast(anchorEl, message, onConfirm) {
  const existing = document.querySelector('.smart-paste-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'smart-paste-toast';
  toast.textContent = message || '📋 List detected! Create sub-steps?';
  document.body.appendChild(toast);

  const rect = anchorEl.getBoundingClientRect();
  toast.style.top = `${rect.bottom + 8}px`;
  toast.style.left = `${rect.left}px`;

  const cleanup = () => {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  };

  toast.addEventListener('click', () => {
    cleanup();
    if (typeof onConfirm === 'function') onConfirm();
  });

  setTimeout(cleanup, 5000);
}

function showSmartPasteConfirm(anchorEl, onUndo) {
  showSmartPasteToast(anchorEl, '✅ Sub-steps created. Click to undo.', onUndo);
}

/**
 * Create a task with description and append substeps.
 * @param {string} title
 * @param {string} description
 * @param {string[]} subSteps
 */
function createTaskWithSubsteps(title, description, subSteps) {
  if (!title) return;
  const priority = 'medium';
  const li = createTaskElement(title, priority, '');
  if (description) {
    li.dataset.description = description;
    const descBox = li.querySelector('.task-desc');
    if (descBox) {
      descBox.value = description;
      autoResizeTextarea(descBox);
    }
  }
  attachTaskEventHandlers(li);
  listContainer.appendChild(li);

  addSubstepsToTask(li, subSteps);

  sortByUrgency();
  renderMatrixView();
  updateCounters();
}

/**
 * Auto-classify task importance/urgency based on ETA and deadline.
 * @param {HTMLElement} taskLi
 */
function autoClassifyTask(taskLi) {
  if (!taskLi) return;
  const etaMin = taskLi.dataset.etaMin ? parseInt(taskLi.dataset.etaMin, 10) : null;
  const deadline = taskLi.dataset.deadline || '';

  let isImportant = true;
  let isUrgent = false;

  if (typeof etaMin === 'number' && !Number.isNaN(etaMin)) {
    const category = getTaskCategory(etaMin);
    if (category.label === 'Quick') isImportant = false;
    if (category.label === 'Core' || category.label === 'Major') isImportant = true;
    if (etaMin < 60) isUrgent = true;
  }

  if (deadline) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (deadline === today) isUrgent = true;
  }

  taskLi.dataset.isImportant = String(isImportant);
  taskLi.dataset.isUrgent = String(isUrgent);
}


/**
 * Render the 2x2 Eisenhower Matrix view from current tasks.
 */
function renderMatrixView() {
  document.querySelectorAll('.matrix-task-card').forEach(card => card.remove());
  const doFirst = document.getElementById('matrix-do-first');
  const schedule = document.getElementById('matrix-schedule');
  const delegate = document.getElementById('matrix-delegate');
  const eliminate = document.getElementById('matrix-eliminate');
  if (!doFirst || !schedule || !delegate || !eliminate) return;

  [doFirst, schedule, delegate, eliminate].forEach(cell => {
    cell.innerHTML = '<ul class="matrix-task-list"></ul>';
  });

  const tasks = Array.from(listContainer.querySelectorAll(':scope > li'));
  tasks.forEach(task => {
    const isImportant = task.dataset.isImportant !== 'false';
    const isUrgent = task.dataset.isUrgent === 'true';

    let targetCell = eliminate;
    if (isUrgent && isImportant) targetCell = doFirst;
    else if (!isUrgent && isImportant) targetCell = schedule;
    else if (isUrgent && !isImportant) targetCell = delegate;

    const list = targetCell.querySelector('.matrix-task-list');
    if (list) list.appendChild(createMatrixTaskItem(task));
  });

}

/**
 * Set up drag-and-drop handlers for matrix quadrants.
 */
function setupMatrixDnD() {
  const quadrants = document.querySelectorAll('.matrix-cell-body');
  quadrants.forEach(cell => {
    cell.addEventListener('dragover', (e) => e.preventDefault());
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;
      const taskLi = listContainer.querySelector(`:scope > li[data-task-id="${taskId}"]`);
      if (!taskLi) return;

      const quadrant = cell.parentElement?.dataset.quadrant || '';
      if (quadrant === 'do-first') {
        taskLi.dataset.isUrgent = 'true';
        taskLi.dataset.isImportant = 'true';
      } else if (quadrant === 'schedule') {
        taskLi.dataset.isUrgent = 'false';
        taskLi.dataset.isImportant = 'true';
      } else if (quadrant === 'delegate') {
        taskLi.dataset.isUrgent = 'true';
        taskLi.dataset.isImportant = 'false';
      } else if (quadrant === 'eliminate') {
        taskLi.dataset.isUrgent = 'false';
        taskLi.dataset.isImportant = 'false';
      }

      renderMatrixView();
    });
  });
}

/**
 * Create a new task element with complete HTML structure.
 * This builds the skeleton but does NOT attach event handlers (done separately).
 * 
 * @param {string} taskText - The main task description
 * @param {string} priority - Priority: 'high', 'medium', or 'low' (default: 'medium')
 * @param {string} deadline - ISO date string (e.g. "2026-02-15") or empty (default: '')
 * @return {HTMLElement} - Complete <li> ready to insert into DOM
 */
function createTaskElement(taskText, priority = 'medium', deadline = '') {
  // Create the main list item that represents one task
  const li = document.createElement('li');
  li.classList.add('task-item');
  // Give each task a unique id used for drag operations
  li.dataset.id = 'task-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  li.setAttribute('draggable', 'true'); // enable HTML5 drag-and-drop
  
  // Store priority in a data attribute so sorting can access it
  li.dataset.priority = priority;
  // Initialize timer elapsed (ms) to 0
  li.dataset.elapsedMs = '0';
  // Default Eisenhower flags
  li.dataset.isImportant = 'false';
  li.dataset.isUrgent = 'false';
  li.dataset.matrixTouched = 'false';
  
  // Build complete HTML structure:
  //   - Task checkbox + text
  //   - Deadline date input + display label
  //   - ETA input + ETA display
  //   - Delete button
  //   - Sub-steps section (each sub-step has its own timer in right column)
  li.innerHTML = `
    <div class="task-main">
      <div class="task-left">
        <button type="button" class="collapse-btn" aria-label="Toggle substeps">▼</button>
        <label class="task-check-toggle" aria-label="Task completed">
          <input type="checkbox" class="task-checkbox">
          <span class="task-check-icon icon-unchecked" aria-hidden="true"><img src="assets/icons/complete.svg" alt="Not completed"></span>
          <span class="task-check-icon icon-checked"><img src="assets/icons/complete.svg" alt="Completed"></span>
        </label>
        <div class="task-status">
          <img class="status-icon" alt="Status icon">
          <div class="status-toggles" aria-label="Urgent and important">
            <label class="status-toggle">
              <input type="checkbox" class="toggle-urgent" aria-label="Urgent">
              <span>Urgent</span>
            </label>
            <label class="status-toggle">
              <input type="checkbox" class="toggle-important" aria-label="Important">
              <span>Important</span>
            </label>
          </div>
        </div>
        <span class="task-text"></span>
        <div class="task-controls">
          <input type="date" class="deadline-input" aria-label="Task deadline">
          <span class="deadline-countdown"></span>
          <input type="number" class="eta-input" min="0" placeholder="ETA(min)" aria-label="ETA in minutes">
          <span class="eta-badge"></span>
          <div class="progress-container" aria-hidden="false">
            <div class="progress-bar" style="width:0%"></div>
            <div class="progress-percent">0%</div>
          </div>
          <span class="substep-summary"></span>
          <button type="button" class="delete-btn" aria-label="Delete task"><img src="assets/icons/delete.svg" alt="Delete"></button>
        </div>
      </div>
      <div class="task-right">
        <div class="task-timer-panel"></div>
      </div>
    </div>
    <!-- description area for parent task -->
    <textarea class="task-desc" rows="1" placeholder="Add a description for this task"></textarea>

    <div class="substeps">
      <input type="text" class="substep-input" placeholder="Add sub-step">
      <button type="button" class="add-substep-btn">Add Step</button>
      <ul class="substeps-list"></ul>
    </div>
  `;
  
  // Set the task text (using textContent to avoid XSS vulnerabilities)
  li.querySelector('.task-text').textContent = taskText;
  
  applyPriorityClass(li, priority);

  // Configure the deadline:
  // 1. Get the date <input> element
  // 2. Set its value to the deadline (may be empty)
  // 3. Apply deadline styling (display label, CSS classes)
  const di = li.querySelector('.deadline-input');
  di.value = deadline || '';
  applyDeadline(li, deadline);

  const urgentToggle = li.querySelector('.toggle-urgent');
  const importantToggle = li.querySelector('.toggle-important');
  if (urgentToggle) urgentToggle.checked = li.dataset.isUrgent === 'true';
  if (importantToggle) importantToggle.checked = li.dataset.isImportant === 'true';
  updateStatusIcon(li);

  const timerHost = li.querySelector('.task-timer-panel');
  if (timerHost) {
    const panel = createTaskTimerPanel(li);
    timerHost.replaceWith(panel);
  }

  return li;
}

/**
 * Add a new task by reading the input form and creating a task element.
 * This is the main entry point when user clicks "Add" or presses Enter.
 * 
 * STEPS:
 *   1. Read and clean up task text from input box
 *   2. Read selected priority from dropdown
 *   3. Validate that task text is not empty
 *   4. Create task element with text, priority, and empty deadline
 *   5. Attach all event handlers to the new task
 *   6. Append task to the DOM container
 *   7. Automatically sort tasks by urgency
 *   8. Clear the input box for the next task
 *   9. Update the completion counters
 */
function addTask() {
  // Read and trim the task text from the input box
  const task = inputBox.value.trim();
  
  // Default priority for new tasks
  const priority = 'medium';
  
  // Validate: do not allow empty tasks
  if (!task) {
    alert('Please write down a task');
    return;  // Exit early without creating anything
  }
  
  // Create the task element with text, priority, and empty deadline
  const li = createTaskElement(task, priority, '');
  
  // Attach all event handlers (checkbox, edit, delete, priority, deadline, sub-steps)
  attachTaskEventHandlers(li);
  
  // Add the task to the list container in the DOM
  listContainer.appendChild(li);
  
  // Automatically re-sort the entire list to maintain priority order
  sortTasks();

  // Refresh matrix view after adding task
  renderMatrixView();
  
  // Clear the input box so user can immediately type a new task
  inputBox.value = '';
  autoResizeInput(inputBox);
  
  // Refresh the task counters (completed vs. uncompleted)
  updateCounters();
}

/**
 * Attach all event listeners to a task element.
 * Handles: checkbox (completion), edit button, priority change, deadline, delete, sub-steps.
 * 
 * @param {HTMLElement} li - The task <li> element
 */
function attachTaskEventHandlers(li) {
  // Extract key sub-elements of the task
  const checkbox = li.querySelector('.task-checkbox');  // Toggle completion
  const collapseBtn = li.querySelector('.collapse-btn'); // Toggle substeps visibility
  const deleteBtn = li.querySelector('.delete-btn');    // Remove task
  const taskSpan = li.querySelector('.task-text');      // Display task text
  const urgentToggle = li.querySelector('.toggle-urgent');
  const importantToggle = li.querySelector('.toggle-important');
  
  /**
   * HANDLER 0: Collapse Button
   * Toggle visibility of substeps section and corresponding substep timers
   */
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function () {
      const isCollapsed = li.classList.toggle('collapsed');
      collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    });
  }

  if (urgentToggle) {
    urgentToggle.addEventListener('change', function () {
      li.dataset.isUrgent = urgentToggle.checked ? 'true' : 'false';
      li.dataset.matrixTouched = 'true';
      updateStatusIcon(li);
      sortTasks();
    });
  }

  if (importantToggle) {
    importantToggle.addEventListener('change', function () {
      li.dataset.isImportant = importantToggle.checked ? 'true' : 'false';
      li.dataset.matrixTouched = 'true';
      updateStatusIcon(li);
      sortTasks();
    });
  }

  /**
   * HANDLER 1: Task Completion Checkbox
   * When user checks/unchecks the main task checkbox:
   *   - Toggle the 'completed' CSS class
   *   - This class adds strikethrough and gray styling
   *   - Update the completion counters
   *   - Trigger celebration confetti when marking complete
   */
  checkbox.addEventListener('click', function () {
    // .toggle(className, force) adds/removes class based on the force value
    li.classList.toggle('completed', checkbox.checked);
    
    // Trigger confetti celebration when task is marked complete
    if (checkbox.checked) {
      handleTaskCompletion();
    }

    // Sync main task timer completion status
    syncTaskTimerCompletion(li);

    // Move completed task (and its timers) to the bottom
    if (checkbox.checked) {
      moveCompletedTaskToBottom(li);
    }
    
    updateCounters();
  });
  
  /**
   * HANDLER 2: Edit Button
   * When user clicks the edit button:
   *   - Show a browser prompt dialog with current task text
   *   - If user clicks OK, update the task text
   *   - Also uncheck the task and remove 'completed' styling
   *   - Update counters
   */
  taskSpan.addEventListener('dblclick', function () {
    console.log('Edit clicked, current text:', taskSpan.textContent);
    
    // Start inline edit instead of prompt
    startInlineEdit(li, taskSpan, checkbox);
  });
  
  /**
   * HANDLER 4: Deadline Input Change
   * When user changes the deadline date picker:
   *   - Read the new deadline value
   *   - Apply it (update data attribute and display label)
   *   - Re-sort tasks (deadline changes may affect urgency order)
   */
  const deadlineInp = li.querySelector('.deadline-input');
  if (deadlineInp) {
    deadlineInp.addEventListener('change', function () {
      const newDeadline = deadlineInp.value;
      applyDeadline(li, newDeadline);
      // Deadline affects sort order by urgency (as a tie-breaker)
      sortByUrgency();
      renderMatrixView();
    });
  }

  // ETA input inside task: show text and store value as data attribute
  const etaInp = li.querySelector('.eta-input');
  if (etaInp) {
    etaInp.addEventListener('change', function () {
      const v = etaInp.value.trim();
      if (v) {
        const etaVal = parseInt(v, 10);
        li.dataset.etaMin = String(etaVal);
        updateTaskEtaBadge(li, etaVal);
        updateTimerCardETA(li);
        renderMatrixView();
      } else {
        li.removeAttribute('data-eta-min');
        updateTaskEtaBadge(li, null);
        updateTimerCardETA(li);
        renderMatrixView();
      }
    });
  }

  // Drag event handlers for manual reordering
  li.addEventListener('dragstart', function (e) {
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  });
  li.addEventListener('dragend', function () {
    li.classList.remove('dragging');
    rebuildTimerCards();
  });

  // Sub-steps: add, enter-to-add, list, handlers
  const subInput = li.querySelector('.substep-input');
  const addSubBtn = li.querySelector('.add-substep-btn');
  const subList = li.querySelector('.substeps-list');
  // Task description textarea
  const descBox = li.querySelector('.task-desc');
  if (descBox) {
    // Load existing description from data attribute (if any) into textarea
    if (li.dataset.description) descBox.value = li.dataset.description;
    // Auto-resize on load to fit existing content
    autoResizeTextarea(descBox);
    // Save description into data attribute on input change (auto-save)
    descBox.addEventListener('input', function () {
      li.dataset.description = descBox.value;
      autoResizeTextarea(descBox);
    });
  }

  /**
   * HANDLER 5: Sub-steps (Mini-tasks)
   * Users can add small sub-steps/checkpoints within each main task.
   * Each sub-step has its own checkbox and can be deleted independently.
   */
  
  /**
   * Inner function: Add a sub-step from the input box
   * - Trim the input text
   * - Create a sub-step element
   * - Attach handlers to it
   * - Add it to the sub-steps list
   * - Clear the input for the next sub-step
   */
  function addSubFromInput() {
    const text = subInput.value.trim();
    if (!text) return;  // Ignore empty input
    
    // Create the sub-step element
    const s = createSubstepElement(text);
    
    // Assign unique substep ID
    s.dataset.substepId = 'substep-' + (taskIdCounter++);
    
    // Attach handlers (checkbox & delete button & timers) to the sub-step, passing parent li
    attachSubstepHandlers(s, li);
    
    // Add the sub-step to the list under this task
    subList.appendChild(s);
    
    // Update parent summary now that a sub-step was added
    updateSubstepSummary(li);
    
    // Clear the input field for the next sub-step
    subInput.value = '';
  }
  
  // Wire up the "Add Step" button
  if (addSubBtn) addSubBtn.addEventListener('click', addSubFromInput);
  
  // Allow Enter key in the sub-step input to add a sub-step
  if (subInput) {
    subInput.addEventListener('keyup', function (e) {
      if (e.key === 'Enter') addSubFromInput();
    });
  }
  
  /**
   * HANDLER 6: Delete Button
   * When user clicks the delete button:
   *   - Remove the entire task element from the DOM
   *   - This also removes all its sub-steps
   *   - Update the completion counters
   *   - Remove the timer card from right column
   */
  deleteBtn.addEventListener('click', function () {
    // Remove all sub-steps within this task first (explicit cleanup)
    const subList = li.querySelector('.substeps-list');
    if (subList) {
      // Stop any running timers on sub-steps to avoid orphaned intervals
      const subs = Array.from(subList.querySelectorAll('li'));
      subs.forEach(s => {
        if (s._timerInterval) { clearInterval(s._timerInterval); s._timerInterval = null; }
      });
      // Remove child nodes to ensure no orphaned nodes/events remain
      subList.innerHTML = '';
    }
    // Also stop parent's timer if running
    if (li._timerInterval) { clearInterval(li._timerInterval); li._timerInterval = null; }
    // Remove the task itself (this also removes any remaining children)
    li.remove();
    updateCounters();
    // Rebuild timer cards to remove deleted task's timer
    rebuildTimerCards();
    renderMatrixView();
  });

  // Initialize substep summary/progress UI for this task (in case there are no substeps yet)
  updateSubstepSummary(li);
  
  // Assign unique task ID
  if (!li.dataset.taskId) {
    li.dataset.taskId = 'task-' + (taskIdCounter++);
  }
}

/**
 * Update the completion counters displayed in the UI.
 * Counts how many tasks are marked 'completed' and how many are not.
 * 
 * LOGIC:
 *   - Query all elements with 'completed' class (these are done tasks)
 *   - Count total tasks in the list container
 *   - Calculate uncompleted = total - completed
 *   - Update the display elements with these counts
 */
function updateCounters() {
  // Use :scope > li to select only direct children (top-level tasks), so sub-steps don't affect counters
  const topTasks = listContainer.querySelectorAll(':scope > li');
  const totalTasks = topTasks.length;
  const completedTasks = listContainer.querySelectorAll(':scope > li.completed').length;
  const uncompletedTasks = Math.max(0, totalTasks - completedTasks);

  // Update the display counters in the UI (if they exist)
  if (completedCounter) completedCounter.textContent = completedTasks;
  if (uncompletedCounter) uncompletedCounter.textContent = uncompletedTasks;
}

/**
 * Wire up the main input box to support pressing Enter to add a task.
 * This provides a keyboard shortcut alternative to clicking the "Add" button.
 */
inputBox.addEventListener('keyup', function (e) {
  // Check if the Enter key was pressed
  if (e.key === 'Enter') addTask();
});

// Restore tasks on page load
loadTasks();

/**
 * Initialize counters on page load.
 * Even if there are no tasks yet, set the counters to 0.
 */
updateCounters();

// Initialize matrix view interactions
setupMatrixDnD();
renderMatrixView();

// Remove any legacy matrix cards if they appear
const matrixContainer = document.getElementById('matrix-view');
if (matrixContainer) {
  const cleanupMatrixCards = () => {
    matrixContainer.querySelectorAll('.matrix-task-card').forEach(card => card.remove());
  };
  cleanupMatrixCards();
  const observer = new MutationObserver(cleanupMatrixCards);
  observer.observe(matrixContainer, { childList: true, subtree: true });
}

/**
 * Expose addTask globally so the inline onclick in HTML can call it.
 * This is for the "Add" button in the form.
 */
window.addTask = addTask;