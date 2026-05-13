// ========== LocalStorage 数据结构 ==========
//
// ts_settings    → { focusDuration, shortBreak, longBreak, longBreakInterval }
// ts_goals       → [{ id, title, desc, type:'long'|'short', progress, total,
//                      unit, deadline, parentId, color, createdAt, completedAt }]
// ts_habits      → [{ id, name, icon, color, targetDays:[1-7], createdAt }]
// ts_habit_log   → { '2026-05-13': ['h_xxx','h_yyy'], ... }
// ts_history     → [{ id, goalId, habitId, goalTitle, startTime, duration, type, note }]
// ts_todos       → [{ id, title, type:'short'|'long', deadline, createdAt, completedAt }]

const DEFAULTS = {
  ts_settings: { focusDuration: 25, shortBreak: 5, longBreak: 15, longBreakInterval: 4, theme: 'lavender' },
  ts_goals: [],
  ts_habits: [],
  ts_habit_log: {},
  ts_history: [],
  ts_todos: []
}

function load(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : structuredClone(DEFAULTS[key]) }
  catch { return structuredClone(DEFAULTS[key]) }
}
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)) }

// ---- Settings ----
export function loadSettings() { return load('ts_settings') }
export function saveSettings(s) { save('ts_settings', s) }

// ---- Goals ----
export function loadGoals() { return load('ts_goals') }
export function saveGoals(g) { save('ts_goals', g) }

export function addGoal(goal) {
  const goals = loadGoals()
  goals.push({
    id: 'g_' + Date.now(), title: goal.title, desc: goal.desc || '',
    type: goal.type, progress: 0, total: goal.total || 1,
    unit: goal.unit || '次', deadline: goal.deadline || '',
    parentId: goal.parentId || null, color: goal.color || randomColor(),
    createdAt: today(), completedAt: null
  })
  saveGoals(goals); return goals
}

export function updateGoalProgress(id, delta) {
  const goals = loadGoals()
  const g = goals.find(x => x.id === id)
  if (!g) return
  g.progress = Math.min(g.total, Math.max(0, g.progress + delta))
  if (g.progress >= g.total) g.completedAt = today()
  saveGoals(goals); return g
}

export function deleteGoal(id) { saveGoals(loadGoals().filter(g => g.id !== id)) }

// ---- Habits ----
export function loadHabits() { return load('ts_habits') }
export function saveHabits(h) { save('ts_habits', h) }

export function addHabit(habit) {
  const habits = loadHabits()
  habits.push({
    id: 'h_' + Date.now(), name: habit.name,
    icon: habit.icon || '✅', color: habit.color || randomColor(),
    targetDays: habit.targetDays || [1,2,3,4,5,6,7], createdAt: today()
  })
  saveHabits(habits); return habits
}

export function deleteHabit(id) { saveHabits(loadHabits().filter(h => h.id !== id)) }

// ---- Habit Log ----
export function loadHabitLog() { return load('ts_habit_log') }
export function saveHabitLog(l) { save('ts_habit_log', l) }

export function toggleHabit(habitId) {
  const log = loadHabitLog(), date = today()
  if (!log[date]) log[date] = []
  const idx = log[date].indexOf(habitId)
  idx >= 0 ? log[date].splice(idx, 1) : log[date].push(habitId)
  saveHabitLog(log); return log
}

export function isHabitDone(habitId) {
  return (loadHabitLog()[today()] || []).includes(habitId)
}

export function markHabitDone(habitId) {
  const log = loadHabitLog(), date = today()
  if (!log[date]) log[date] = []
  if (!log[date].includes(habitId)) log[date].push(habitId)
  saveHabitLog(log)
}

export function getStreak(habitId) {
  const log = loadHabitLog(); let streak = 0; const d = new Date()
  while (true) {
    if ((log[dateStr(d)] || []).includes(habitId)) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

// ---- History ----
export function loadHistory() { return load('ts_history') }
export function saveHistory(h) { save('ts_history', h) }

export function addHistory(entry) {
  const history = loadHistory()
  history.unshift({
    id: 'f_' + Date.now(),
    goalId: entry.goalId || null,
    habitId: entry.habitId || null,
    goalTitle: entry.goalTitle || '',
    startTime: new Date().toISOString(),
    duration: entry.duration,
    type: entry.type || 'focus',
    note: entry.note || ''
  })
  saveHistory(history); return history
}

export function getTodayFocusCount() {
  const t = today()
  return loadHistory().filter(h => h.type === 'focus' && h.startTime.startsWith(t)).length
}

export function getTodayFocusMinutes() {
  const t = today()
  return loadHistory().filter(h => h.type === 'focus' && h.startTime.startsWith(t))
    .reduce((sum, h) => sum + h.duration, 0)
}

export function getItemTotalMinutes(type, id) {
  const field = type === 'goal' ? 'goalId' : 'habitId'
  return loadHistory().filter(h => h[field] === id && h.type === 'focus')
    .reduce((sum, h) => sum + h.duration, 0)
}

export function getItemTodayMinutes(type, id) {
  const t = today()
  const field = type === 'goal' ? 'goalId' : 'habitId'
  return loadHistory().filter(h => h[field] === id && h.type === 'focus' && h.startTime.startsWith(t))
    .reduce((sum, h) => sum + h.duration, 0)
}

export function getStatsByRange(startDate, endDate) {
  const history = loadHistory().filter(h => {
    if (h.type !== 'focus') return false
    const d = h.startTime.slice(0, 10)
    return d >= startDate && d <= endDate
  })

  const map = {}
  const days = new Set()
  let totalMin = 0
  history.forEach(h => {
    totalMin += h.duration
    days.add(h.startTime.slice(0, 10))
    const key = h.goalTitle || '未关联项目'
    if (!map[key]) map[key] = { title: key, minutes: 0, sessions: 0 }
    map[key].minutes += h.duration
    map[key].sessions++
  })

  const focusDays = days.size
  return {
    items: Object.values(map).sort((a, b) => b.minutes - a.minutes),
    totalMinutes: totalMin,
    totalSessions: history.length,
    focusDays,
    avgDaily: focusDays > 0 ? Math.round(totalMin / focusDays) : 0
  }
}

export function getDailyFocus(days) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    const minutes = loadHistory()
      .filter(h => h.type === 'focus' && h.startTime.startsWith(ds))
      .reduce((sum, h) => sum + h.duration, 0)
    result.push({ date: ds, day: d.getDay() || 7, minutes })
  }
  return result
}

// ---- Todos ----
export function loadTodos() { return load('ts_todos') }
export function saveTodos(t) { save('ts_todos', t) }

export function addTodo(todo) {
  const todos = loadTodos()
  todos.push({
    id: 't_' + Date.now(),
    title: todo.title,
    type: todo.type, // 'short' | 'long'
    deadline: todo.deadline || '',
    createdAt: today(),
    completedAt: null
  })
  saveTodos(todos)
  return todos
}

export function toggleTodo(id) {
  const todos = loadTodos()
  const t = todos.find(x => x.id === id)
  if (!t) return
  t.completedAt = t.completedAt ? null : today()
  saveTodos(todos)
}

export function deleteTodo(id) {
  saveTodos(loadTodos().filter(t => t.id !== id))
}

export function deadlineText(deadline) {
  if (!deadline) return ''
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const dl = new Date(deadline + 'T00:00:00')
  const diff = Math.round((dl - now) / 86400000)
  if (diff < 0) return `已过期 ${-diff} 天`
  if (diff === 0) return '今天截止'
  if (diff === 1) return '明天截止'
  if (diff <= 7) return `还有 ${diff} 天`
  return `📅 ${deadline}`
}

// ---- Utils ----
export function today() { return dateStr(new Date()) }

function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

function randomColor() {
  const c = ['#e94560','#4ecca3','#f0a500','#6c5ce7','#0984e3','#00b894','#fd79a8']
  return c[Math.floor(Math.random() * c.length)]
}
