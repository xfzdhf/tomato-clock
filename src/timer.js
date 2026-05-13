import {
  loadSettings,
  addHistory, updateGoalProgress, markHabitDone,
  getTodayFocusCount, getTodayFocusMinutes, getItemTodayMinutes
} from './storage.js'

const C = 2 * Math.PI * 88
let chimeCtx = null
let onBackCallback = null

// ---- Wallpaper system ----
const WALLPAPERS = {
  nature: [
    'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=400&q=80',
    'https://images.unsplash.com/photo-1508610041836-7d7b4d5c5b52?w=400&q=80',
    'https://images.unsplash.com/photo-1496062031456-07b4f162a3f1?w=400&q=80',
    'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=400&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80'
  ],
  cozy: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&q=80',
    'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=400&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80'
  ],
  cute: [
    'https://images.unsplash.com/photo-1478098711619-5ab0b478d6e6?w=400&q=80',
    'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&q=80',
    'https://images.unsplash.com/photo-1507149833265-60c372daea22?w=400&q=80',
    'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&q=80',
    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&q=80',
    'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400&q=80'
  ]
}
const WALLPAPER_LABELS = { nature: '清新自然', cozy: '治愈系', cute: '萌宠' }
let currentWallpaperTheme = 'nature'
let lastImageUrl = ''

function applyWallpaper() {
  const imgs = WALLPAPERS[currentWallpaperTheme]
  // pick a random image different from the last one (if multiple available)
  let url
  if (imgs.length > 1) {
    const pool = imgs.filter(u => u !== lastImageUrl)
    url = pool[Math.floor(Math.random() * pool.length)]
  } else {
    url = imgs[0]
  }
  lastImageUrl = url
  const bg = document.getElementById('wallpaper-bg')
  if (!bg) return
  // gradient underneath + image on top; gradient shows while image loads
  bg.style.backgroundImage = 'url(' + url + '), linear-gradient(160deg, #3a5068 0%, #2c4050 40%, #3a4858 100%)'
  // preload for next time
  new Image().src = url
}

function switchWallpaper() {
  const themes = Object.keys(WALLPAPERS)
  const idx = themes.indexOf(currentWallpaperTheme)
  currentWallpaperTheme = themes[(idx + 1) % themes.length]
  applyWallpaper()
  // brief toast
  const btn = document.getElementById('btn-wallpaper')
  if (btn) { btn.textContent = '✨'; setTimeout(() => { btn.textContent = '🖼' }, 600) }
}

export const state = {
  timerMode: 'countdown',  // 'countdown' | 'stopwatch'
  // countdown props
  mode: 'focus',           // 'focus' | 'shortBreak' | 'longBreak'
  totalSec: 25 * 60,
  remaining: 25 * 60,
  completed: 0,
  // stopwatch props
  elapsed: 0,
  // common
  targetTime: null,
  running: false,
  timerId: null,
  focusTarget: null
}

export function onBack(fn) { onBackCallback = fn }

// Preload a wallpaper at app startup so first timer open is instant
export function preloadWallpaper() {
  const imgs = WALLPAPERS[currentWallpaperTheme]
  const url = imgs[Math.floor(Math.random() * imgs.length)]
  lastImageUrl = url
  new Image().src = url
}

export function initTimer() {
  const s = loadSettings()
  state.totalSec = s.focusDuration * 60
  state.remaining = state.totalSec
  state.mode = 'focus'
  state.completed = 0
  state.elapsed = 0
  state.timerMode = 'countdown'
  state.running = false
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null }
  refreshUI()
  bindEvents()
}

export function startFocus(target) {
  state.focusTarget = target
  initTimer()
  document.getElementById('focus-target-name').textContent =
    (target.icon || '') + ' ' + target.name
  applyWallpaper()
  document.getElementById('timer-overlay').style.display = 'flex'
}

export function endFocus() {
  if (state.running) { clearInterval(state.timerId); state.timerId = null; state.running = false }
  document.getElementById('timer-overlay').style.display = 'none'
  state.focusTarget = null
}

// ---- Event Binding ----
let eventsBound = false
function bindEvents() {
  if (eventsBound) return
  eventsBound = true
  document.getElementById('btn-play').addEventListener('click', toggle)
  document.getElementById('btn-skip').addEventListener('click', secondaryAction)
  document.getElementById('btn-back').addEventListener('click', goBack)
  document.getElementById('btn-wallpaper').addEventListener('click', switchWallpaper)
  document.getElementById('btn-dur-minus').addEventListener('click', () => adjustDuration(-5))
  document.getElementById('btn-dur-plus').addEventListener('click', () => adjustDuration(5))

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode))
  })
}

function goBack() {
  if (state.running) {
    if (!confirm('专注进行中，确定返回吗？计时将丢失。')) return
  }
  endFocus()
  if (onBackCallback) onBackCallback()
}

// ---- Mode Switching ----
function switchMode(mode) {
  if (state.running) return
  state.timerMode = mode
  state.elapsed = 0
  const s = loadSettings()
  if (mode === 'countdown') {
    state.totalSec = s.focusDuration * 60
    state.remaining = state.totalSec
  }
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
  document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active')
  resetUI()
  refreshUI()
}

function adjustDuration(delta) {
  if (state.running || state.timerMode !== 'countdown') return
  state.totalSec = Math.max(60, Math.min(120 * 60, state.totalSec + delta * 60))
  state.remaining = state.totalSec
  state.mode = 'focus' // custom duration always treats as focus
  updateDurationDisplay()
  updateDisplay()
  updateRing()
}

function updateDurationDisplay() {
  const m = Math.round(state.totalSec / 60)
  document.getElementById('dur-display').textContent = m + ' 分钟'
}

// ---- Start / Pause / Toggle ----
function toggle() { state.running ? pause() : start() }

function start() {
  state.running = true
  const now = Date.now()

  if (state.timerMode === 'countdown') {
    state.targetTime = now + state.remaining * 1000
  } else {
    state.targetTime = now - state.elapsed * 1000
  }

  state.timerId = setInterval(tick, 200)

  document.querySelector('.timer-container').classList.add('glow')

  const playBtn = document.getElementById('btn-play')
  playBtn.textContent = '⏸ 暂停'
  playBtn.style.background = 'var(--surface2)'; playBtn.style.boxShadow = 'none'

  const secBtn = document.getElementById('btn-skip')
  secBtn.style.display = 'inline-block'
  secBtn.textContent = state.timerMode === 'countdown' ? '⏭ 跳过' : '⏹ 结束'
  secBtn.className = state.timerMode === 'countdown' ? 'btn-round btn-skip' : 'btn-round btn-stop'

  document.getElementById('timer-label').textContent =
    state.timerMode === 'stopwatch' ? '计时中...' :
    state.mode === 'focus' ? '专注中...' :
    state.mode === 'shortBreak' ? '短休息...' : '长休息...'

  document.getElementById('duration-set').style.display = 'none'
  document.getElementById('mode-toggle').style.opacity = '0.4'
  document.getElementById('mode-toggle').style.pointerEvents = 'none'
  refreshUI()
}

function pause() {
  state.running = false; clearInterval(state.timerId); state.timerId = null
  document.querySelector('.timer-container').classList.remove('glow')
  const playBtn = document.getElementById('btn-play')
  playBtn.textContent = '▶ 继续'
  playBtn.style.background = 'var(--primary)'
  playBtn.style.boxShadow = '0 4px 24px var(--primary-glow)'

  const secBtn = document.getElementById('btn-skip')
  secBtn.style.display = state.timerMode === 'countdown' ? 'inline-block' : 'inline-block'
  secBtn.textContent = state.timerMode === 'countdown' ? '⏭ 跳过' : '⏹ 结束'
  secBtn.className = state.timerMode === 'countdown' ? 'btn-round btn-skip' : 'btn-round btn-stop'

  document.getElementById('timer-label').textContent = '已暂停'

  document.getElementById('duration-set').style.display = 'none'
  document.getElementById('mode-toggle').style.opacity = '0.4'
  document.getElementById('mode-toggle').style.pointerEvents = 'none'
  refreshUI()
}

// ---- Tick ----
function tick() {
  const now = Date.now()

  if (state.timerMode === 'countdown') {
    state.remaining = Math.max(0, Math.ceil((state.targetTime - now) / 1000))
  } else {
    state.elapsed = Math.floor((now - state.targetTime) / 1000)
  }

  updateDisplay()
  updateRing()

  if (state.timerMode === 'countdown' && state.remaining <= 0) {
    completeCountdown()
  }
}

// ---- Complete (countdown only) ----
function completeCountdown() {
  clearInterval(state.timerId); state.timerId = null; state.running = false
  playChime()
  notify()

  if (state.mode === 'focus') {
    const t = state.focusTarget
    const duration = Math.round(state.totalSec / 60)
    addHistory({
      goalId: t && t.type === 'goal' ? t.id : null,
      habitId: t && t.type === 'habit' ? t.id : null,
      goalTitle: t ? t.name : '',
      duration, type: 'focus'
    })
    if (t && t.type === 'goal') updateGoalProgress(t.id, 1)
    if (t && t.type === 'habit') markHabitDone(t.id)

    state.completed++
    const s = loadSettings()
    if (state.completed % s.longBreakInterval === 0) {
      state.mode = 'longBreak'; state.totalSec = s.longBreak * 60
    } else {
      state.mode = 'shortBreak'; state.totalSec = s.shortBreak * 60
    }
    state.remaining = state.totalSec
    document.getElementById('timer-label').textContent =
      state.mode === 'longBreak' ? '长休息' : '休息一下'
  } else {
    const s = loadSettings()
    state.mode = 'focus'; state.totalSec = s.focusDuration * 60
    state.remaining = state.totalSec
    document.getElementById('timer-label').textContent = '准备专注'
  }

  resetUI()
  refreshUI()
}

// ---- Secondary action (skip / stop) ----
function secondaryAction() {
  if (state.timerMode === 'countdown') {
    skipCountdown()
  } else {
    finishStopwatch()
  }
}

function skipCountdown() {
  state.running = false
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null }
  resetAllCountdown()
}

function resetAllCountdown() {
  const s = loadSettings()
  if (state.mode === 'focus')       state.totalSec = s.focusDuration * 60
  else if (state.mode === 'shortBreak') state.totalSec = s.shortBreak * 60
  else                              state.totalSec = s.longBreak * 60
  state.remaining = state.totalSec
  resetUI()
  refreshUI()
}

function finishStopwatch() {
  state.running = false
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null }

  const duration = Math.max(1, Math.round(state.elapsed / 60))
  const t = state.focusTarget
  addHistory({
    goalId: t && t.type === 'goal' ? t.id : null,
    habitId: t && t.type === 'habit' ? t.id : null,
    goalTitle: t ? t.name : '',
    duration, type: 'focus'
  })
  if (t && t.type === 'goal') updateGoalProgress(t.id, 1)
  if (t && t.type === 'habit') markHabitDone(t.id)

  playChime()

  if (Notification.permission === 'granted' && t) {
    new Notification('⏹ 计时结束', {
      body: `${t.name} · 专注 ${duration} 分钟`,
      icon: '/icon.svg', silent: true
    })
  }

  state.elapsed = 0
  resetUI()
  refreshUI()
}

// ---- Reset UI state after completion/stop ----
function resetUI() {
  document.querySelector('.timer-container').classList.remove('glow')
  document.getElementById('mode-toggle').style.opacity = '1'
  document.getElementById('mode-toggle').style.pointerEvents = 'auto'

  const playBtn = document.getElementById('btn-play')
  playBtn.textContent = '▶ 开始'
  playBtn.style.background = 'var(--primary)'
  playBtn.style.boxShadow = '0 4px 24px var(--primary-glow)'

  const secBtn = document.getElementById('btn-skip')
  secBtn.style.display = 'none'

  if (state.timerMode === 'countdown') {
    document.getElementById('duration-set').style.display = 'flex'
    updateDurationDisplay()
    document.getElementById('timer-label').textContent =
      state.mode === 'focus' ? '准备专注' :
      state.mode === 'shortBreak' ? '准备短休息' : '准备长休息'
  } else {
    document.getElementById('duration-set').style.display = 'none'
    document.getElementById('timer-label').textContent = '准备计时'
  }
}

// ---- UI Updates ----
function updateDisplay() {
  const total = state.timerMode === 'countdown' ? state.remaining : state.elapsed
  const m = Math.floor(total / 60), s = total % 60
  document.getElementById('timer-display').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

function updateRing() {
  let progress
  if (state.timerMode === 'countdown') {
    progress = state.totalSec > 0 ? 1 - state.remaining / state.totalSec : 0
  } else {
    progress = Math.min(1, state.elapsed / 3600) // cap ring fill at 60 min
  }
  document.getElementById('ring-progress')
    .setAttribute('stroke-dashoffset', String(C * progress))
}

function refreshUI() {
  updateDisplay()
  updateRing()

  const ring = document.getElementById('ring-progress')
  // white ring for glassmorphism look; vary glow intensity by mode
  const glowColor = state.timerMode === 'stopwatch' ? 'rgba(200,180,255,0.6)'
    : state.mode === 'focus' ? 'rgba(255,255,255,0.6)'
    : state.mode === 'shortBreak' ? 'rgba(180,255,220,0.6)'
    : 'rgba(255,220,180,0.6)'
  ring.style.stroke = '#fff'
  ring.style.filter = 'drop-shadow(0 0 14px ' + glowColor + ')'

  // session dots (countdown only)
  const dots = document.getElementById('session-dots')
  const durSet = document.getElementById('duration-set')
  if (state.timerMode === 'stopwatch') {
    dots.style.display = 'none'
    durSet.style.display = state.running ? 'none' : 'none'
  } else {
    dots.style.display = 'flex'
    durSet.style.display = state.running ? 'none' : 'flex'
    const s = loadSettings()
    dots.innerHTML = Array.from({ length: s.longBreakInterval }, (_, i) =>
      `<div class="session-dot ${i < state.completed % s.longBreakInterval ? 'done' : ''}"></div>`).join('')
  }

  // stats
  document.getElementById('today-stats').innerHTML =
    `今日完成 <strong>${getTodayFocusCount()}</strong> 个番茄 · 共 <strong>${getTodayFocusMinutes()}</strong> 分钟`

  const t = state.focusTarget
  const itemStats = document.getElementById('item-focus-stats')
  if (t) {
    const mins = getItemTodayMinutes(t.type, t.id)
    itemStats.textContent = mins > 0 ? `该项目今日专注 ${mins} 分钟` : ''
  } else {
    itemStats.textContent = ''
  }
}

// ---- Sound ----
function playChime() {
  try {
    if (!chimeCtx) chimeCtx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = state.timerMode === 'stopwatch' || state.mode === 'focus'
      ? [523, 659, 784] : [784, 659, 523]
    notes.forEach((f, i) => {
      const o = chimeCtx.createOscillator(), g = chimeCtx.createGain()
      o.connect(g); g.connect(chimeCtx.destination)
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.15, chimeCtx.currentTime + i * 0.15)
      g.gain.exponentialRampToValueAtTime(0.001, chimeCtx.currentTime + i * 0.15 + 0.3)
      o.start(chimeCtx.currentTime + i * 0.15)
      o.stop(chimeCtx.currentTime + i * 0.15 + 0.3)
    })
  } catch { /* ignore */ }
}

function notify() {
  if (Notification.permission !== 'granted') return
  const t = state.focusTarget
  new Notification(state.mode === 'focus' ? '🍅 专注完成！' : '☕ 休息结束！', {
    body: state.mode === 'focus'
      ? (t ? t.name + ' · ' : '') + '做得很好，休息一下吧~'
      : '准备开始新的番茄钟吧~',
    icon: '/icon.svg', silent: true
  })
}
