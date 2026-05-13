import {
  loadGoals, saveGoals, addGoal, deleteGoal,
  loadHabits, addHabit, deleteHabit, toggleHabit,
  isHabitDone, getStreak, today,
  getItemTotalMinutes, getItemTodayMinutes,
  loadSettings, saveSettings,
  getStatsByRange, getDailyFocus,
  loadTodos, addTodo, toggleTodo, deleteTodo, deadlineText,
  loadHistory
} from './storage.js'
import { initTimer, startFocus, onBack } from './timer.js'

const wl = ['一','二','三','四','五','六','日']
const emojis = ['📚','💪','🏃','🧘','💧','✍️','🎯','🌱','🎵','🍎','💤','🧹','📝','💡','🎨','🤝']

// ===== Themes =====
const THEMES = {
  lavender:{ name:'淡雅', bg:'#f4edf8', surface:'#ffffff', surface2:'#f0eaf6', border:'#e6daf0', text:'#3d3055', textDim:'#a898c0', primary:'#e8788a', primaryGlow:'rgba(232,120,138,0.25)', success:'#5cc9b0', warning:'#f0c060', purple:'#b8a0d8' },
  dark:   { name:'暗夜', bg:'#0f0f1a', surface:'#1a1a2e', surface2:'#222240', border:'#2a2a3e', text:'#eaeaea', textDim:'#8888aa', primary:'#e94560', primaryGlow:'rgba(233,69,96,0.35)', success:'#4ecca3', warning:'#f0a500', purple:'#6c5ce7' },
  forest: { name:'森林', bg:'#0d1a12', surface:'#172e1f', surface2:'#1f4029', border:'#2a4a30', text:'#e0f0e0', textDim:'#7a9a7a', primary:'#4ecca3', primaryGlow:'rgba(78,204,163,0.35)', success:'#2ecc71', warning:'#f0c040', purple:'#27ae60' },
  ocean:  { name:'海洋', bg:'#0a1628', surface:'#162d50', surface2:'#1a3a6a', border:'#2a4a7a', text:'#e0ecff', textDim:'#7a9ac0', primary:'#0984e3', primaryGlow:'rgba(9,132,227,0.35)', success:'#00cec9', warning:'#fdcb6e', purple:'#6c5ce7' },
  warm:   { name:'暖橙', bg:'#1a1410', surface:'#2e2218', surface2:'#3d2e20', border:'#4a3828', text:'#f0e8e0', textDim:'#a09080', primary:'#f0a500', primaryGlow:'rgba(240,165,0,0.35)', success:'#e17055', warning:'#fab1a0', purple:'#d63031' },
  sakura: { name:'樱花', bg:'#1a1018', surface:'#2e1a2a', surface2:'#3d2438', border:'#4a3042', text:'#f0e0ec', textDim:'#a08098', primary:'#fd79a8', primaryGlow:'rgba(253,121,168,0.35)', success:'#ffeaa7', warning:'#dfe6e9', purple:'#a29bfe' },
  light:  { name:'极简', bg:'#f5f6fa', surface:'#fff', surface2:'#e8e9f0', border:'#d0d2d8', text:'#2d3436', textDim:'#888', primary:'#e94560', primaryGlow:'rgba(233,69,96,0.25)', success:'#00b894', warning:'#e17055', purple:'#6c5ce7' }
}

function applyTheme(key) {
  const t = THEMES[key] || THEMES.lavender
  const root = document.documentElement.style
  root.setProperty('--bg', t.bg)
  root.setProperty('--surface', t.surface)
  root.setProperty('--surface2', t.surface2)
  root.setProperty('--border', t.border)
  root.setProperty('--text', t.text)
  root.setProperty('--text-dim', t.textDim)
  root.setProperty('--primary', t.primary)
  root.setProperty('--primary-glow', t.primaryGlow)
  root.setProperty('--success', t.success)
  root.setProperty('--warning', t.warning)
  root.setProperty('--purple', t.purple)
  document.querySelector('meta[name="theme-color"]').setAttribute('content', t.bg)
}

// ===== Init =====
let currentRange = 'day'

document.addEventListener('DOMContentLoaded', () => {
  initTimer()
  setupTabs()
  setupFilterBar()
  setupPlusMenu()
  setupSettings()
  setupLongPress()
  onBack(() => { renderAll(); renderStats(currentRange) })

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }

  const s = loadSettings()
  applyTheme(s.theme || 'lavender')

  renderAll()
  renderStats('day')
})

// ===== Unified List Render =====
let currentFilter = 'all'
const filterBarBound = false

function getAllItems() {
  const items = []
  loadGoals().forEach(g => {
    items.push({
      id: g.id, source: 'goal', title: g.title, subtype: g.type,
      category: g.type === 'long' ? '长期目标' : '短期目标',
      tag: g.type === 'long' ? '长期' : '短期',
      color: g.color, deadline: g.deadline,
      progress: g.progress, total: g.total, unit: g.unit,
      done: !!g.completedAt, desc: g.desc,
      focusMin: getItemTotalMinutes('goal', g.id),
      todayMin: getItemTodayMinutes('goal', g.id),
      createdAt: g.createdAt, completedAt: g.completedAt
    })
  })
  loadHabits().forEach(h => {
    items.push({
      id: h.id, source: 'habit', title: h.name, subtype: 'habit',
      category: '习惯', tag: '习惯', icon: h.icon, color: h.color,
      deadline: '', done: isHabitDone(h.id),
      streak: getStreak(h.id),
      focusMin: getItemTotalMinutes('habit', h.id),
      todayMin: getItemTodayMinutes('habit', h.id),
      createdAt: h.createdAt
    })
  })
  loadTodos().forEach(t => {
    items.push({
      id: t.id, source: 'todo', title: t.title, subtype: t.type,
      category: t.type === 'short' ? '短期待办' : '长期目标',
      tag: t.type === 'short' ? '短期' : '长期',
      color: t.type === 'short' ? '#f0a500' : '#6c5ce7',
      deadline: t.deadline, done: !!t.completedAt,
      focusMin: 0, todayMin: 0,
      createdAt: t.createdAt, completedAt: t.completedAt
    })
  })
  // active first, then done; within active, by deadline urgency
  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline.localeCompare(b.deadline)
  })
  return items
}

function renderAll() {
  const all = getAllItems()
  const filtered = currentFilter === 'all' ? all.filter(i => !i.done)
    : currentFilter === 'long' ? all.filter(i => !i.done && i.subtype === 'long')
    : currentFilter === 'short' ? all.filter(i => !i.done && i.subtype === 'short')
    : all.filter(i => i.done) // 'done'

  const container = document.getElementById('unified-list')

  if (all.length === 0) {
    container.innerHTML = `<div class="empty-all">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">开始你的专注之旅</div>
      <div class="empty-desc">点击右上角 <span style="color:var(--primary);font-weight:600">＋</span> 创建待办或习惯</div>
    </div>`
    return
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-section" style="padding:32px 0;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">📭</div>
      <div>${currentFilter === 'done' ? '暂无已完成事项' : '暂无匹配事项'}</div>
    </div>`
    return
  }

  container.innerHTML = filtered.map(item => {
    const dl = deadlineText(item.deadline)
    const dlCls = item.done ? '' : (
      dl.includes('过期') ? 'overdue' : dl.includes('今天') || dl.includes('明天') ? 'urgent' : 'normal'
    )
    const metaParts = []
    if (item.source === 'goal') metaParts.push(`${item.progress}/${item.total} ${item.unit}`)
    if (item.source === 'habit' && item.streak) metaParts.push(`🔥 ${item.streak}天`)
    if (item.todayMin > 0) metaParts.push(`今日 ${fmtMin(item.todayMin)}`)
    if (item.focusMin > 0) metaParts.push(`累计 ${fmtMin(item.focusMin)}`)
    const meta = metaParts.join(' · ')

    return `<div class="u-item ${item.done ? 'done' : ''}" data-source="${item.source}" data-id="${item.id}">
      <div class="u-body">
        <div class="u-title">${item.source === 'habit' ? (item.icon || '') + ' ' : ''}${esc(item.title)}</div>
        <div class="u-meta">
          ${dl ? `<span class="u-deadline ${dlCls}">${dl}</span>` : ''}
          ${meta ? `<span style="font-size:11px;color:var(--text-dim)">${meta}</span>` : ''}
          <span class="u-tag" style="background:${item.color}">${item.tag}</span>
        </div>
      </div>
    </div>`
  }).join('')
}

// ===== Filter Bar =====
function setupFilterBar() {
  document.querySelectorAll('#filter-bar .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter
      document.querySelectorAll('#filter-bar .filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderAll()
    })
  })
}

// Long press → detail popup
let longPressTimer2, longPressItem
function setupLongPress() {
  ;['unified-list', 'todo-list'].forEach(listId => {
    const el = document.getElementById(listId)
    if (!el) return
    el.addEventListener('pointerdown', e => {
      const item = e.target.closest('.u-item')
      if (!item) return
      longPressItem = item
      longPressTimer2 = setTimeout(() => {
        showDetailPopup(item.dataset.source, item.dataset.id)
        longPressItem = null
      }, 500)
    })
    el.addEventListener('pointerup', e => {
      if (longPressItem && longPressTimer2) {
        // Short tap → start focus
        clearTimeout(longPressTimer2)
        const item = longPressItem
        longPressItem = null
        startFocusOnItem(item.dataset.source, item.dataset.id)
      }
    })
    el.addEventListener('pointerleave', () => { clearTimeout(longPressTimer2); longPressItem = null })
    el.addEventListener('pointermove', () => { clearTimeout(longPressTimer2); longPressItem = null })
  })
}

function startFocusOnItem(source, id) {
  if (source === 'goal') {
    const g = loadGoals().find(x => x.id === id)
    if (g) startFocus({ type: 'goal', id, name: g.title, icon: g.type === 'long' ? '🎯' : '📋', color: g.color })
  } else if (source === 'habit') {
    const h = loadHabits().find(x => x.id === id)
    if (h) startFocus({ type: 'habit', id, name: h.name, icon: h.icon, color: h.color })
  } else if (source === 'todo') {
    const t = loadTodos().find(x => x.id === id)
    if (t) startFocus({ type: 'todo', id, name: t.title, icon: '📝', color: '#6c5ce7' })
  }
}

function showDetailPopup(source, id) {
  let item
  if (source === 'goal') {
    const g = loadGoals().find(x => x.id === id)
    if (!g) return
    const pct = g.total > 0 ? Math.round((g.progress / g.total) * 100) : 0
    item = {
      title: g.title, category: g.type === 'long' ? '长期目标' : '短期目标',
      color: g.color, deadline: g.deadline,
      desc: g.desc, focusMin: getItemTotalMinutes('goal', id),
      progress: g.progress, total: g.total, unit: g.unit,
      done: !!g.completedAt, completedAt: g.completedAt,
      createdAt: g.createdAt, pct
    }
  } else if (source === 'habit') {
    const h = loadHabits().find(x => x.id === id)
    if (!h) return
    item = {
      title: (h.icon || '') + ' ' + h.name, category: '习惯',
      color: h.color, deadline: '',
      streak: getStreak(id), focusMin: getItemTotalMinutes('habit', id),
      done: isHabitDone(id), createdAt: h.createdAt
    }
  } else if (source === 'todo') {
    const t = loadTodos().find(x => x.id === id)
    if (!t) return
    // find focus time by matching history entries with this todo title
    const history = loadHistory().filter(h => !h.goalId && !h.habitId && h.goalTitle === t.title && h.type === 'focus')
    const focusMin = history.reduce((s, h) => s + h.duration, 0)
    item = {
      title: t.title, category: t.type === 'short' ? '短期待办' : '长期目标',
      color: t.type === 'short' ? '#f0a500' : '#6c5ce7',
      deadline: t.deadline, focusMin,
      done: !!t.completedAt, completedAt: t.completedAt,
      createdAt: t.createdAt
    }
  }
  if (!item) return

  const dl = deadlineText(item.deadline)
  const rows = [
    ['类型', item.category],
    item.deadline ? ['期限', item.deadline + (dl ? ' (' + dl + ')' : '')] : null,
    item.progress !== undefined ? ['总目标', item.total + ' ' + (item.unit || '次')] : null,
    item.progress !== undefined ? ['当前进度', item.progress + ' ' + (item.unit || '次')] : null,
    item.pct !== undefined ? ['完成度', item.pct + '%'] : null,
    item.streak !== undefined ? ['坚持天数', item.streak + ' 天'] : null,
    item.focusMin > 0 ? ['累计专注', fmtMin(item.focusMin)] : null,
    ['状态', item.done ? '已完成' + (item.completedAt ? ' · ' + item.completedAt : '') : '进行中'],
    ['创建', item.createdAt],
  ].filter(Boolean)

  const overlay = document.createElement('div')
  overlay.className = 'detail-overlay'
  overlay.innerHTML = `<div class="detail-card">
    <div class="d-title" style="color:${item.color}">${esc(item.title)}</div>
    ${rows.map(([l, v]) => `<div class="d-row"><span class="d-label">${l}</span><span class="d-val">${v}</span></div>`).join('')}
    <div class="d-actions">
      <button class="d-focus" id="d-focus">开始专注</button>
      <button class="d-delete" id="d-delete">删除</button>
    </div>
  </div>`
  document.body.appendChild(overlay)

  overlay.querySelector('#d-focus').onclick = () => {
    overlay.remove()
    if (source === 'goal') {
      const g = loadGoals().find(x => x.id === id)
      if (g) startFocus({ type: 'goal', id, name: g.title, icon: g.type === 'long' ? '🎯' : '📋', color: g.color })
    } else if (source === 'habit') {
      const h = loadHabits().find(x => x.id === id)
      if (h) startFocus({ type: 'habit', id, name: h.name, icon: h.icon, color: h.color })
    } else if (source === 'todo') {
      const t = loadTodos().find(x => x.id === id)
      if (t) startFocus({ type: 'todo', id, name: t.title, icon: '📝', color: '#6c5ce7' })
    }
  }

  overlay.querySelector('#d-delete').onclick = () => {
    if (!confirm('确定删除？')) return
    if (source === 'goal') deleteGoal(id)
    else if (source === 'habit') deleteHabit(id)
    else if (source === 'todo') deleteTodo(id)
    overlay.remove()
    renderAll()
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
}

// ===== Plus Menu =====
function setupPlusMenu() {
  const btn = document.getElementById('btn-plus')
  const menu = document.getElementById('plus-menu')

  btn.addEventListener('click', e => {
    e.stopPropagation()
    if (menu.style.display === 'block') { menu.style.display = 'none'; return }

    const activeTab = document.querySelector('#tab-bar .tab.active')?.dataset?.tab
    if (activeTab === 'todos') {
      menu.innerHTML = '<button data-action="todo">📝 新建待办</button>'
    } else {
      menu.innerHTML = '<button data-action="long">🎯 新建长期目标</button>' +
        '<button data-action="short">📋 新建短期目标</button>' +
        '<button data-action="habit">✅ 新建习惯</button>'
    }
    menu.style.display = 'block'
  })

  menu.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const a = btn.dataset.action
    menu.style.display = 'none'
    if (a === 'todo') showTodoForm()
    else if (a === 'long') showGoalForm('long')
    else if (a === 'short') showGoalForm('short')
    else if (a === 'habit') showHabitForm()
  })

  document.addEventListener('click', () => { menu.style.display = 'none' })
}

// ===== Tab Navigation =====
function setupTabs() {
  document.querySelectorAll('#tab-bar .tab').forEach(t => {
    t.addEventListener('click', () => {
      const target = t.dataset.tab
      document.querySelectorAll('#tab-bar .tab').forEach(b => b.classList.remove('active'))
      t.classList.add('active')
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
      document.getElementById('screen-' + target).classList.add('active')

      if (target === 'todos') renderTodos()
      if (target === 'stats') renderStats(currentRange)
    })
  })
}

// ===== Settings =====
function setupSettings() {
  document.getElementById('btn-settings').addEventListener('click', () => {
    const s = loadSettings()

    // build theme dots outside template literal to avoid nesting issues
    let dots = ''
    Object.entries(THEMES).forEach(([k, t]) => {
      dots += '<button class="theme-dot' + (s.theme === k ? ' active' : '') +
        '" data-theme="' + k + '" style="background:' + t.primary +
        '" title="' + t.name + '"></button>'
    })

    showModal(
      '<h3>⚙️ 设置</h3>' +
      '<div class="setting-row"><span class="s-label">专注时长（分钟）</span>' +
      '  <input type="number" id="s-focus" value="' + s.focusDuration + '" min="1" max="120"></div>' +
      '<div class="setting-row"><span class="s-label">短休息（分钟）</span>' +
      '  <input type="number" id="s-short" value="' + s.shortBreak + '" min="1" max="30"></div>' +
      '<div class="setting-row"><span class="s-label">长休息（分钟）</span>' +
      '  <input type="number" id="s-long" value="' + s.longBreak + '" min="1" max="60"></div>' +
      '<div class="setting-row"><span class="s-label">长休息间隔（次）</span>' +
      '  <input type="number" id="s-interval" value="' + s.longBreakInterval + '" min="1" max="10"></div>' +
      '<div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:8px">' +
      '  <span class="s-label">背景氛围</span>' +
      '  <div class="theme-picker">' + dots + '</div>' +
      '</div>' +
      '<div class="btn-row">' +
      '  <button class="btn-cancel" id="btn-cancel">取消</button>' +
      '  <button class="btn-confirm" id="btn-confirm">保存</button>' +
      '</div>', () => {
        const themeKey = document.querySelector('.theme-dot.active')?.dataset?.theme || 'lavender'
        saveSettings({
          focusDuration: +document.getElementById('s-focus').value || 25,
          shortBreak: +document.getElementById('s-short').value || 5,
          longBreak: +document.getElementById('s-long').value || 15,
          longBreakInterval: +document.getElementById('s-interval').value || 4,
          theme: themeKey
        })
        applyTheme(themeKey)
        initTimer()
      })

    // theme picker click
    setTimeout(() => {
      document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'))
          dot.classList.add('active')
        })
      })
    }, 0)
  })
}

// ===== Goal Form =====
function showGoalForm(type) {
  showModal(`
    <h3>新建${type === 'long' ? '长期' : '短期'}目标</h3>
    <label>名称</label><input id="f-title" placeholder="例如：读完10本书" autofocus>
    <label>描述</label><input id="f-desc" placeholder="可选">
    <label>目标总量</label><input id="f-total" type="number" value="30" min="1">
    <label>单位</label><select id="f-unit"><option value="分钟">分钟</option><option value="小时" selected>小时</option></select>
    ${type === 'short' ? `
      <label>关联长期目标</label>
      <select id="f-parent"><option value="">不关联</option>
        ${loadGoals().filter(g => g.type === 'long' && !g.completedAt).map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}
      </select>` : ''}
    <label>截止日期</label><input id="f-deadline" type="date">
    <div class="btn-row">
      <button class="btn-cancel" id="btn-cancel">取消</button>
      <button class="btn-confirm" id="btn-confirm">创建</button>
    </div>`, () => {
      const title = document.getElementById('f-title').value.trim()
      if (!title) { alert('请输入名称'); return false }
      addGoal({
        title,
        desc: document.getElementById('f-desc').value.trim(),
        type,
        total: +document.getElementById('f-total').value || 30,
        unit: document.getElementById('f-unit').value.trim() || '次',
        parentId: type === 'short' ? (document.getElementById('f-parent')?.value || null) : null,
        deadline: document.getElementById('f-deadline').value
      })
      renderAll()
    })
}

// ===== Habit Form =====
function showHabitForm() {
  const selected = new Set([1, 2, 3, 4, 5, 6, 7])

  showModal(`
    <h3>新建习惯</h3>
    <label>名称</label><input id="f-name" placeholder="例如：每日阅读 30 分钟" autofocus>
    <label>图标</label><input id="f-icon" placeholder="输入 emoji，留空随机" maxlength="2">
    <label>重复日</label>
    <div class="dow-select" id="dow">
      ${wl.map((d, i) => `<button data-dow="${i + 1}" class="on">${d}</button>`).join('')}
    </div>
    <div class="btn-row">
      <button class="btn-cancel" id="btn-cancel">取消</button>
      <button class="btn-confirm" id="btn-confirm">创建</button>
    </div>`, () => {
      const name = document.getElementById('f-name').value.trim()
      if (!name) { alert('请输入名称'); return false }
      if (selected.size === 0) { alert('请至少选择一天'); return false }
      addHabit({
        name,
        icon: document.getElementById('f-icon').value.trim() || emojis[Math.floor(Math.random() * emojis.length)],
        targetDays: [...selected].sort()
      })
      renderAll()
    })

  // must setup dow events AFTER modal is in DOM
  setTimeout(() => {
    document.querySelectorAll('#dow button').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = +btn.dataset.dow
        selected.has(d) ? selected.delete(d) : selected.add(d)
        btn.classList.toggle('on')
      })
    })
  }, 0)
}

// ===== Modal Helper =====
function showModal(html, onConfirm) {
  const overlay = document.getElementById('modal-overlay')
  document.getElementById('modal-content').innerHTML = html
  overlay.style.display = 'flex'

  const cancel = document.getElementById('btn-cancel')
  if (cancel) cancel.onclick = () => { overlay.style.display = 'none' }

  const confirm = document.getElementById('btn-confirm')
  if (confirm) confirm.onclick = () => {
    const result = onConfirm()
    if (result !== false) overlay.style.display = 'none'
  }

  overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none' }
}

// ===== Todo Form =====
function showTodoForm() {
  showModal(`
    <h3>新建待办</h3>
    <label>类型</label>
    <select id="f-type"><option value="short">短期待办</option><option value="long">长期目标</option></select>
    <label>名称</label><input id="f-title" placeholder="例如：完成项目报告" autofocus>
    <label>截止日期（可选）</label><input id="f-deadline" type="date">
    <div class="btn-row">
      <button class="btn-cancel" id="btn-cancel">取消</button>
      <button class="btn-confirm" id="btn-confirm">创建</button>
    </div>`, () => {
      const title = document.getElementById('f-title').value.trim()
      if (!title) { alert('请输入名称'); return false }
      addTodo({
        title,
        type: document.getElementById('f-type').value,
        deadline: document.getElementById('f-deadline').value
      })
      renderAll()
    })
}

// ===== Todo List (独立待办集 tab) =====
function renderTodos() {
  // click to toggle done
  const list = document.getElementById('todo-list')
  if (!list._bound) {
    list._bound = true
    list.addEventListener('click', e => {
      const item = e.target.closest('.u-item')
      if (item) {
        const t = loadTodos().find(x => x.id === item.dataset.id)
        if (t) toggleTodo(t.id); renderTodos()
      }
    })
  }

  const todos = loadTodos()
  const container = document.getElementById('todo-list')
  if (todos.length === 0) {
    container.innerHTML = `<div class="empty-all">
      <div class="empty-icon">📝</div>
      <div class="empty-title">暂无待办事项</div>
    </div>`
    return
  }

  const active = todos.filter(t => !t.completedAt)
  const done = todos.filter(t => t.completedAt)
  container.innerHTML = [...active, ...done].map(t => {
    const d = deadlineText(t.deadline)
    const cls = t.completedAt ? '' : (d.includes('过期') ? 'overdue' : d.includes('今天') || d.includes('明天') ? 'urgent' : 'normal')
    return `<div class="u-item ${t.completedAt ? 'done' : ''}" data-source="todo" data-id="${t.id}">
      <div class="u-body">
        <div class="u-title">${esc(t.title)}</div>
        <div class="u-meta">
          ${d ? `<span class="u-deadline ${cls}">${d}</span>` : ''}
          <span class="u-tag" style="background:${t.type === 'short' ? '#f0a500' : '#6c5ce7'}">${t.type === 'short' ? '短期' : '长期'}</span>
          ${t.completedAt ? '<span style="font-size:11px;color:var(--success)">✓ 已完成</span>' : ''}
        </div>
      </div>
    </div>`
  }).join('')
}

// ===== Stats =====
function getDateRange(range) {
  const now = new Date()
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  if (range === 'day') {
    const s = fmt(now); return { start: s, end: s, label: '今日' }
  }
  if (range === 'week') {
    const start = new Date(now)
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
    return { start: fmt(start), end: fmt(now), label: '本周' }
  }
  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: fmt(start), end: fmt(now), label: '本月' }
  }
}

function setupStatsRange() {
  document.querySelectorAll('#stats-range .range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRange = btn.dataset.range
      document.querySelectorAll('#stats-range .range-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderStats(currentRange)
    })
  })
}

let statsRangeBound = false

function renderStats(range) {
  if (!statsRangeBound) { setupStatsRange(); statsRangeBound = true }

  const { start, end, label } = getDateRange(range)
  const stats = getStatsByRange(start, end)

  // Summary cards
  document.getElementById('stats-summary').innerHTML =
    '<div class="ss-item"><div class="ss-val">' + fmtMin(stats.totalMinutes) + '</div><div class="ss-label">' + label + '总专注</div></div>' +
    '<div class="ss-item"><div class="ss-val">' + stats.focusDays + '</div><div class="ss-label">专注天数</div></div>' +
    '<div class="ss-item"><div class="ss-val">' + fmtMin(stats.avgDaily) + '</div><div class="ss-label">日均专注</div></div>'

  // Progress list
  renderProgressList(stats)

  // Bar chart
  renderBarChart()
}

function renderProgressList(stats) {
  const container = document.getElementById('progress-list')
  if (stats.items.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px 0;font-size:13px">暂无专注记录</div>'
    return
  }

  const palette = ['#e8788a', '#5cc9b0']
  const maxMin = stats.items[0]?.minutes || 1

  container.innerHTML = stats.items.map((item, i) => {
    const pct = Math.round((item.minutes / (stats.totalMinutes || 1)) * 100)
    return '<div class="pl-item">' +
      '<span class="pl-name" title="' + esc(item.title) + '">' + esc(item.title) + '</span>' +
      '<div class="pl-track"><div class="pl-fill" style="--w:' + pct + '%;background:' + palette[i % 2] + '" data-pct="' + pct + '"></div></div>' +
      '<span class="pl-time">' + fmtMin(item.minutes) + '</span>' +
      '</div>'
  }).join('')

  // Animate bars in
  requestAnimationFrame(() => {
    container.querySelectorAll('.pl-fill').forEach(bar => {
      bar.classList.add('in')
    })
  })
}

// ---- Daily focus bar chart ----
function renderBarChart() {
  const data = getDailyFocus(7)
  const maxMin = Math.max(1, ...data.map(d => d.minutes))
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']

  document.getElementById('bar-chart').innerHTML = data.map(d => {
    const pct = Math.round((d.minutes / maxMin) * 100)
    return '<div class="bar-row">' +
      '<span class="bar-label">' + dayNames[d.day] + ' ' + d.date.slice(5) + '</span>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%">' +
      (d.minutes > 0 ? fmtMin(d.minutes) : '') +
      '</div></div></div>'
  }).join('')
}

// ===== Helpers =====
function fmtMin(min) {
  if (min <= 0) return '0min'
  if (min < 60) return min + 'min'
  const h = Math.floor(min / 60), m = min % 60
  return h + 'h' + (m > 0 ? ' ' + m + 'min' : '')
}

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
