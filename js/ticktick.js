/**
 * TickTick API Client for Voice Task PWA
 * Handles direct REST communication with TickTick Open API v1
 */

const TICKTICK_CONFIG = {
  apiBase: 'https://api.ticktick.com/open/v1',
  projects: {
    '0-Радар': { id: '5f4eb2848f08450b91e39d81', color: '#2F80ED', icon: '📡', short: 'Радар' },
    '1-Лабс':  { id: '5f4eb2848f08450b91e39d84', color: '#9B51E0', icon: '🧪', short: 'Лабс' },
    '2-Лиды':  { id: '5f4eb2858f08450b91e39da9', color: '#F2994A', icon: '🎯', short: 'Лиды' },
    '3-Вайб':  { id: '5f4eb2838f08450b91e39d5c', color: '#27AE60', icon: '⚡', short: 'Вайб' },
    '4-Разное':{ id: '5f4eb2858f08450b91e39d93', color: '#828282', icon: '📦', short: 'Разное' },
    '5-Роза':  { id: '5f4eb2848f08450b91e39d78', color: '#EB5757', icon: '🌹', short: 'Роза' },
    '6-Купить':{ id: '93b74535a17b687b071ce09d', color: '#F2C94C', icon: '🛒', short: 'Купить' },
    '7-Тело':  { id: '1e234df6becf5fef03498050', color: '#219653', icon: '🍏', short: 'Тело' }
  },
  columns: [
    '0-Вход',
    '1-План',
    '2-Сейчас',
    '3-Потом',
    '4-Инфо'
  ],
  columnMap: {
    '5f4eb2848f08450b91e39d81': { 0: '6af08fae8f080cb36f764c57', 1: '6af08faf8f086e9230b39a8a', 2: '6af08fb08f082b1308153254', 3: '6af08fb18f086e9230b39ad0', 4: '6af08fb28f080cb36f764cd8' },
    '5f4eb2848f08450b91e39d84': { 0: '6af08fb48f0899596f1d9129', 1: '6af08fb58f082b13081532e2', 2: '6af08fb68f082b130815330e', 3: '6af08fb78f082b130815333e', 4: '6af08fb88f0866ff5ff7641b' },
    '5f4eb2858f08450b91e39da9': { 0: '6af08fba8f080cb36f764dc4', 1: '6af08fbb8f0899596f1d9210', 2: '6af08fbc8f082b13081534c7', 3: '6af08fbd8f080cb36f764e13', 4: '6af08fbe8f0899596f1d926f' },
    '5f4eb2838f08450b91e39d5c': { 0: '6af08fc08f0899596f1d92b1', 1: '6af08fc18f086e9230b39ce3', 2: '6af08fc48f086e9230b39d43', 3: '6af08fc58f080cb36f764eef', 4: '6af08fc68f080cb36f764f09' },
    '5f4eb2858f08450b91e39d93': { 0: '6af08fc88f0866ff5ff765bc', 1: '6af08fc98f0866ff5ff765e1', 2: '6af08fca8f082b13081537b6', 3: '6af08fcb8f086e9230b39e02', 4: '6af08fcc8f080cb36f764f95' },
    '5f4eb2848f08450b91e39d78': { 0: '6af08fce8f0866ff5ff766f7', 1: '6af08fcf8f0866ff5ff76726', 2: '6af08fd08f080cb36f765010', 3: '6af08fd18f0899596f1d94af', 4: '6af08fd28f080cb36f765054' },
    '93b74535a17b687b071ce09d': { 0: '6af08fd48f0866ff5ff76792', 1: '6af08fd58f082b1308153a17', 2: '6af08fd68f0899596f1d9538', 3: '6af08fd78f080cb36f765129', 4: '6af08fd88f086e9230b39fd3' },
    '1e234df6becf5fef03498050': { 0: '6af08fda8f0866ff5ff76848', 1: '6af08fdb8f082b1308153c45', 2: '6af08fdc8f0899596f1d95f0', 3: '6af08fdd8f0899596f1d9624', 4: '6af08fde8f082b1308153cae' }
  },
  tags: {
    red: '🏀красный',
    yellow: '🥎жолтый',
    small: 'мелкий',
    big: 'большой'
  }
};

class TickTickClient {
  constructor(token) {
    this.token = token || this.getToken();
  }

  getToken() {
    // 1. Check URL hash (e.g. #token=tp_...)
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/token=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const t = match[1];
        localStorage.setItem('ticktick_token', t);
        history.replaceState(null, null, window.location.pathname);
        return t;
      }
    }
    // 2. Read from localStorage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('ticktick_token');
      if (stored) return stored;
    }
    // 3. Fallback: no token configured yet
    return null;
  }

  setToken(token) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ticktick_token', token);
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'VoiceTaskPWA/1.0'
    };
  }

  /**
   * Create a task directly in TickTick
   */
  async createTask({ categoryKey, columnIdx = 0, title, content = '', priority = 0, tags = [] }) {
    if (!this.token) {
      throw new Error('Токен TickTick не задан. Нажмите ⚙️ для настройки.');
    }
    const projMeta = TICKTICK_CONFIG.projects[categoryKey] || TICKTICK_CONFIG.projects['4-Разное'];
    const projectId = projMeta.id;
    
    // Resolve columnId from pre-cached map
    const projectCols = TICKTICK_CONFIG.columnMap[projectId] || {};
    const columnId = projectCols[columnIdx] || null;

    const payload = {
      title: title.trim(),
      projectId: projectId,
      priority: priority // 0, 3, or 5
    };

    if (columnId) {
      payload.columnId = columnId;
    }

    if (content) {
      payload.content = content;
    }

    if (tags && tags.length > 0) {
      payload.tags = tags;
    }

    const response = await fetch(`${TICKTICK_CONFIG.apiBase}/task`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`TickTick API error (${response.status}): ${errText}`);
    }

    return await response.json();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { TickTickClient, TICKTICK_CONFIG };
}
