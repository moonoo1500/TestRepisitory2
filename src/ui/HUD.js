import { UNITS, BUILDINGS, BUILD_ORDER, fmtCost, fmtTime, DIFFICULTY } from '../data/defs.js';

/* =========================================================
   HUD: ресурсы, панель выбора, карточка команд, лог, экраны
   ========================================================= */
export class HUD {
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.el = {
      crystal: document.querySelector('#res-crystal'),
      power: document.querySelector('#res-power'),
      pop: document.querySelector('#res-pop'),
      clock: document.querySelector('#res-clock'),
      powerFill: document.querySelector('.power-fill'),
      spTitle: document.getElementById('sp-title'),
      spSub: document.getElementById('sp-sub'),
      spPortrait: document.getElementById('sp-portrait'),
      spQueue: document.getElementById('sp-queue'),
      ccGrid: document.getElementById('cc-grid'),
      ccHint: document.getElementById('cc-hint'),
      log: document.getElementById('event-log'),
      toasts: document.getElementById('toast-layer'),
      tooltip: document.getElementById('tooltip'),
      mpTime: document.getElementById('mp-time'),
      mpSector: document.getElementById('mp-sector'),
      build: document.getElementById('placement-hud'),
    };
    this.buildMode = false;
    this.timer = 0;
    this.lastSelSig = '';
    this.bindEvents();
    this.fillHelp();
  }

  /* ================= СОБЫТИЯ ИГРЫ ================= */
  bindEvents() {
    const g = this.game;
    g.on('log', (d) => this.pushLog(d.msg, d.kind));
    g.on('toast', (d) => this.pushToast(d.title, d.sub, d.red));
    g.on('selection', () => { this.lastSelSig = ''; });
    g.on('hover', (e) => this.showEntityTooltip(e));
    g.on('order-mode', (m) => this.setOrderMode(m));
    g.on('placement', (t) => { this.buildMode = !!t; this.renderCommandCard(); });
    g.on('toggle-build', () => {
      if (g.placement) { this.input.cancelPlacement(); this.buildMode = false; }
      else this.buildMode = !this.buildMode;
      this.renderCommandCard();
    });
    g.on('toggle-sound', () => this.toggleSound());
    g.on('toggle-pause', () => this.togglePause());
    g.on('toggle-help', () => this.toggleHelp());
    g.on('game-over', (d) => this.showEnd(d));
    g.on('new-game', (d) => { this.el.mpSector.textContent = d.map.name.toUpperCase().slice(0, 12); });

    document.getElementById('btn-sound').onclick = () => this.toggleSound();
    document.getElementById('btn-bloom').onclick = () => this.toggleBloom();
    document.getElementById('btn-speed').onclick = () => this.cycleSpeed();
    document.getElementById('btn-help').onclick = () => this.toggleHelp();
    document.getElementById('btn-menu').onclick = () => this.togglePause();
    document.getElementById('btn-help-close').onclick = () => this.toggleHelp(false);
    document.getElementById('btn-resume').onclick = () => this.togglePause(false);
    document.getElementById('btn-restart2').onclick = () => { this.togglePause(false); this.game.emit('restart'); };
  }

  toggleSound() {
    const on = this.game.audio.toggle();
    document.getElementById('btn-sound').classList.toggle('off', !on);
  }

  async toggleBloom() {
    const g = this.game;
    if (!g.composer && g.bloomEnabled) await g.setupComposer();
    g.bloomEnabled = !g.bloomEnabled;
    document.getElementById('btn-bloom').classList.toggle('off', !g.bloomEnabled);
  }

  cycleSpeed() {
    const speeds = [1, 1.5, 2, 3];
    const i = speeds.indexOf(this.game.speed);
    this.game.speed = speeds[(i + 1) % speeds.length];
    document.getElementById('btn-speed').textContent = `${this.game.speed}×`;
  }

  togglePause(force) {
    const g = this.game;
    if (!g.running) return;
    g.paused = force === undefined ? !g.paused : force;
    document.getElementById('screen-pause').classList.toggle('hidden', !g.paused);
  }

  toggleHelp(force) {
    const el = document.getElementById('screen-help');
    const show = force === undefined ? el.classList.contains('hidden') : force;
    el.classList.toggle('hidden', !show);
    this.game.paused = show;
  }

  /* ================= ЛОГ / ТОСТЫ ================= */
  pushLog(msg, kind = '') {
    const d = document.createElement('div');
    d.className = `ev ${kind}`;
    d.textContent = msg;
    this.el.log.appendChild(d);
    while (this.el.log.children.length > 6) this.el.log.firstChild.remove();
    setTimeout(() => {
      d.style.transition = 'opacity .5s, transform .5s';
      d.style.opacity = '0';
      d.style.transform = 'translateX(20px)';
      setTimeout(() => d.remove(), 520);
    }, 6200);
  }

  pushToast(title, sub = '', red = false) {
    const d = document.createElement('div');
    d.className = `toast ${red ? 'red' : ''}`;
    d.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2700);
  }

  /* ================= ТУЛТИПЫ ================= */
  showEntityTooltip(e) {
    const t = this.el.tooltip;
    if (!e || this.buildMode) { t.classList.add('hidden'); return; }
    t.classList.remove('hidden');
    const name = e.def.name;
    t.innerHTML = `<h4>${name}</h4>
      <div class="tt-stats">HP ${Math.ceil(e.hp)}/${e.maxHp}${e.def.weapon ? ` · ${e.def.weapon.name}` : ''}</div>
      <div class="tt-desc">${e.def.desc || ''}</div>`;
    this.moveTooltip();
  }

  moveTooltip() {
    const t = this.el.tooltip;
    if (t.classList.contains('hidden')) return;
    const x = Math.min(innerWidth - 290, this.input.mouse.x + 18);
    const y = Math.min(innerHeight - 120, this.input.mouse.y + 16);
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  }

  showDefTooltip(def) {
    const t = this.el.tooltip;
    t.classList.remove('hidden');
    const stats = [];
    if (def.hp) stats.push(`Прочность ${def.hp}`);
    if (def.weapon) stats.push(`${def.weapon.name}: ${def.weapon.dmg} урона, ${def.weapon.range} дальность`);
    if (def.power) stats.push(`Энергия ${def.power > 0 ? '+' : ''}${def.power}`);
    if (def.popCap) stats.push(`Лимит армии +${def.popCap}`);
    if (def.aura) stats.push(`Регенерация ${def.aura.regen} HP/с в радиусе ${def.aura.radius}`);
    if (def.produces) stats.push(`Производит: ${def.produces.map((p) => UNITS[p].name).join(', ')}`);
    t.innerHTML = `<h4>${def.name}</h4>
      <div class="tt-cost">${fmtCost(def.cost)}${def.buildTime ? ` · ${def.buildTime}с` : ''}</div>
      <div class="tt-stats">${stats.join(' · ')}</div>
      <div class="tt-desc">${def.desc}</div>`;
    this.moveTooltip();
  }

  /* ================= ПАНЕЛЬ ВЫБОРА ================= */
  renderSelection() {
    const g = this.game;
    const sel = [...g.selected].filter((e) => !e.dead);
    if (!sel.length) {
      this.el.spTitle.textContent = 'Ничего не выбрано';
      this.el.spSub.textContent = 'ЛКМ или рамка — выбор';
      this.el.spPortrait.innerHTML = '';
      this.el.spQueue.innerHTML = '';
      return;
    }
    const sig = sel.map((e) => e.id).join(',');
    if (sig === this.lastSelSig) { this.updateSelectionLive(sel); return; }
    this.lastSelSig = sig;

    if (sel.length === 1) {
      const e = sel[0];
      this.el.spTitle.textContent = e.def.name;
      this.el.spSub.textContent = e.kind === 'building'
        ? (e.constructing ? `Строительство ${Math.floor(e.buildProgress * 100)}%` : 'Постройка')
        : `HP ${Math.ceil(e.hp)}/${e.maxHp}`;
      this.el.spPortrait.innerHTML = `
        <div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:30px;
          background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.25)">${e.def.icon}</div>
        <div style="flex:1">
          <div class="sp-bar ${e.hpRatio > 0.6 ? '' : e.hpRatio > 0.3 ? 'mid' : 'low'}"><i style="transform:scaleX(${e.hpRatio})"></i></div>
          <div class="sp-stat" style="margin-top:6px">${this.statLine(e)}</div>
        </div>`;
    } else {
      const counts = {};
      for (const e of sel) counts[e.def.name] = (counts[e.def.name] || 0) + 1;
      this.el.spTitle.textContent = `Выбрано: ${sel.length}`;
      this.el.spSub.textContent = Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join(' · ');
      const icons = [...new Set(sel.map((e) => e.def.icon))].slice(0, 12);
      this.el.spPortrait.innerHTML = `<div class="sp-icons">${icons.map((i) => `<div class="sp-icon">${i}</div>`).join('')}</div>`;
    }
    this.updateSelectionLive(sel);
  }

  statLine(e) {
    const p = [];
    if (e.def.weapon) p.push(`<span>Урон <b>${e.def.weapon.dmg}</b></span>`);
    if (e.def.weapon) p.push(`<span>Дальн. <b>${e.def.weapon.range}</b></span>`);
    if (e.speed) p.push(`<span>Скорость <b>${e.speed.toFixed(1)}</b></span>`);
    if (e.def.harvest) p.push(`<span>Груз <b>${Math.floor(e.harvest.carrying)}/${e.def.harvest.capacity}</b></span>`);
    if (e.def.power) p.push(`<span>Энергия <b>${e.def.power > 0 ? '+' : ''}${e.def.power}</b></span>`);
    return p.join('');
  }

  updateSelectionLive(sel) {
    if (sel.length === 1) {
      const e = sel[0];
      const bar = this.el.spPortrait.querySelector('.sp-bar i');
      if (bar) {
        const r = e.constructing ? e.buildProgress : e.hpRatio;
        bar.style.transform = `scaleX(${r})`;
      }
      const stat = this.el.spPortrait.querySelector('.sp-stat');
      if (stat) stat.innerHTML = this.statLine(e);
      this.el.spSub.textContent = e.kind === 'building'
        ? (e.constructing ? `Строительство ${Math.floor(e.buildProgress * 100)}%` : 'Постройка')
        : `${this.stateName(e)} · HP ${Math.ceil(e.hp)}/${e.maxHp}`;
    }
    // очередь производства
    const prod = sel.find((e) => e.kind === 'building' && e.def.produces);
    this.el.spQueue.innerHTML = '';
    if (prod) {
      prod.queue.forEach((q, i) => {
        const d = document.createElement('div');
        d.className = 'q-item';
        d.innerHTML = `${UNITS[q.id].icon}<div class="q-prog" style="width:${i === 0 ? prod.progress * 100 : 0}%"></div>`;
        d.title = `${UNITS[q.id].name} — ПКМ чтобы отменить`;
        d.onclick = () => {
          if (i === 0) { this.game.players.player.crystal += UNITS[q.id].cost.crystal * 0.75; }
          prod.queue.splice(i, 1);
          this.game.audio.click();
        };
        this.el.spQueue.appendChild(d);
      });
      if (!prod.queue.length) {
        const h = document.createElement('div');
        h.style.cssText = 'font-size:10px;color:var(--c-dim)';
        h.textContent = 'Очередь пуста';
        this.el.spQueue.appendChild(h);
      }
    }
  }

  stateName(u) {
    switch (u.state) {
      case 'move': return 'В пути';
      case 'attack': return u.target ? 'В бою' : 'Атака';
      case 'harvest': return { toNode: 'К жиле', mining: 'Добыча', toDrop: 'Возврат', deposit: 'Разгрузка', seek: 'Поиск жилы' }[u.harvest.phase] || 'Добыча';
      case 'hold': return 'Держать позицию';
      default: return u.def.weapon && u.target ? 'В бою' : 'Ожидание';
    }
  }

  /* ================= КАРТОЧКА КОМАНД ================= */
  renderCommandCard() {
    const g = this.game;
    const grid = this.el.ccGrid;
    grid.innerHTML = '';
    const sel = [...g.selected].filter((e) => !e.dead);

    if (this.buildMode || g.placement) {
      this.renderBuildMenu(grid);
      this.el.ccHint.textContent = 'Выберите постройку · Esc/B — закрыть';
      return;
    }

    const units = sel.filter((e) => e.kind === 'unit' && e.faction === 'player');
    const buildings = sel.filter((e) => e.kind === 'building' && e.faction === 'player');

    if (units.length) {
      this.cmd(grid, { ico: '⌖', nm: 'Атака', hk: 'A', order: 'attack', tip: 'Режим атаки: затем кликните цель' });
      this.cmd(grid, { ico: '✥', nm: 'Патруль', hk: 'P', order: 'patrol', tip: 'Режим патруля: укажите 2+ точки' });
      this.cmd(grid, { ico: '■', nm: 'Стоп', hk: 'S', act: () => { for (const u of units) u.orderStop(); g.audio.click(); } });
      this.cmd(grid, { ico: '⚑', nm: 'Держать', hk: 'H', act: () => { for (const u of units) u.orderHold(); g.audio.click(); } });
      if (units.some((u) => u.def.harvest)) {
        this.cmd(grid, {
          ico: '⬢', nm: 'К жиле', tip: 'Отправить сборщиков к ближайшей кристальной жиле',
          act: () => {
            const hs = units.filter((u) => u.def.harvest);
            if (!hs.length) return;
            const c = hs.reduce((a, u) => ({ x: a.x + u.x / hs.length, z: a.z + u.z / hs.length }), { x: 0, z: 0 });
            const node = g.findNearestNode(c.x, c.z);
            if (node) { for (const h of hs) h.orderHarvest(node); g.audio.click(); }
          },
        });
      }
      this.cmd(grid, { ico: '⌂', nm: 'К базе', tip: 'Вернуться к командному центру', act: () => {
        const cc = g.players.player.buildings.find((b) => b.typeId === 'command' && !b.dead);
        if (cc) this.input.issueMove(units, cc.x, cc.z + 8);
      } });
      this.cmd(grid, { ico: '🏗', nm: 'Строить', hk: 'B', build: true, tip: 'Меню построек' });
    }

    for (const b of buildings) {
      if (b.def.produces) {
        for (const uid of b.def.produces) {
          const d = UNITS[uid];
          const afford = g.players.player.crystal >= d.cost.crystal;
          this.cmd(grid, {
            ico: d.icon, nm: d.name.split(' ')[0], cost: d.cost.crystal, disabled: !afford || b.constructing,
            tip: this.unitTip(d),
            act: () => g.tryProduce(b, uid),
          });
        }
      }
      if (b.def.rally) {
        this.cmd(grid, {
          ico: '➤', nm: 'Точка сбора', tip: 'Затем кликните точку на карте',
          act: () => { this.rallyBuilding = b; this.setOrderMode('rally'); },
        });
      }
      if (b.def.dropoff) {
        this.cmd(grid, { ico: '🏗', nm: 'Строить', hk: 'B', build: true, tip: 'Меню построек' });
      }
    }

    if (!sel.length) {
      this.cmd(grid, { ico: '🏗', nm: 'Строить', hk: 'B', build: true, tip: 'Меню построек' });
      this.cmd(grid, { ico: '⚔', nm: 'Вся армия', hk: 'Tab', act: () => g.selectArmy() });
    }
    this.el.ccHint.textContent = units.length
      ? 'ПКМ — приказ · A — атака · S — стоп · Ctrl+1..9 — группа'
      : 'Выберите юнитов или постройку';
  }

  unitTip(d) {
    const w = d.weapon;
    return `<h4>${d.name}</h4>
      <div class="tt-cost">${fmtCost(d.cost)} · ${d.buildTime}с · лимит ${d.pop}</div>
      <div class="tt-stats">HP ${d.hp}${w ? ` · ${w.name}: ${w.dmg} урона / ${w.range} дальн.` : ' · без оружия'}</div>
      <div class="tt-desc">${d.desc}</div>`;
  }

  renderBuildMenu(grid) {
    const g = this.game;
    const p = g.players.player;
    const counts = {};
    for (const b of p.buildings) if (!b.dead) counts[b.typeId] = (counts[b.typeId] || 0) + 1;

    for (const id of BUILD_ORDER) {
      const d = BUILDINGS[id];
      const reqOk = !d.requires || d.requires.every((r) => (counts[r] || 0) > 0);
      const afford = p.crystal >= d.cost.crystal;
      const blocked = d.unique && (counts[id] || 0) > 0;
      this.cmd(grid, {
        ico: d.icon, nm: d.name.split(' ')[0], cost: d.cost.crystal, build: true,
        disabled: !afford || !reqOk || blocked,
        tip: `${this.defTipHTML(d)}${!reqOk ? `<div class="tt-desc" style="color:#ff8a95">Требуется: ${d.requires.map((r) => BUILDINGS[r].name).join(', ')}</div>` : ''}`,
        act: () => { this.input.startPlacement(id); },
      });
    }
  }

  defTipHTML(d) {
    const stats = [];
    stats.push(`Прочность ${d.hp}`);
    if (d.weapon) stats.push(`${d.weapon.name}: ${d.weapon.dmg} / ${d.weapon.range}`);
    if (d.power) stats.push(`Энергия ${d.power > 0 ? '+' : ''}${d.power}`);
    if (d.popCap) stats.push(`+${d.popCap} лимит армии`);
    if (d.aura) stats.push(`Реген ${d.aura.regen} HP/с / ${d.aura.radius}м`);
    return `<h4>${d.name}</h4>
      <div class="tt-cost">${fmtCost(d.cost)} · ${d.buildTime}с · размер ${d.size}×${d.size}</div>
      <div class="tt-stats">${stats.join(' · ')}</div>
      <div class="tt-desc">${d.desc}</div>`;
  }

  cmd(grid, cfg) {
    const b = document.createElement('button');
    b.className = `cmd ${cfg.build ? 'build' : ''} ${cfg.disabled ? 'disabled' : ''}`;
    b.innerHTML = `<span class="ico">${cfg.ico}</span><span class="nm">${cfg.nm}</span>
      ${cfg.hk ? `<span class="hk">${cfg.hk}</span>` : ''}
      ${cfg.cost ? `<span class="cost">${cfg.cost}◆</span>` : ''}`;
    if (cfg.disabled) b.classList.add('disabled');
    b.onmouseenter = () => {
      if (cfg.tip) { this.el.tooltip.innerHTML = cfg.tip.startsWith('<h4>') ? cfg.tip : `<div class="tt-desc">${cfg.tip}</div>`; this.el.tooltip.classList.remove('hidden'); this.moveTooltip(); }
    };
    b.onmousemove = () => this.moveTooltip();
    b.onmouseleave = () => this.el.tooltip.classList.add('hidden');
    b.onclick = () => {
      if (cfg.disabled) { this.game.audio.error(); return; }
      if (cfg.order) { this.input.pendingOrder = cfg.order; if (cfg.order === 'patrol') this.input.patrolPoints = []; this.setOrderMode(cfg.order); this.game.audio.click(); return; }
      if (cfg.build) { this.buildMode = true; this.renderCommandCard(); this.game.audio.click(); return; }
      cfg.act?.();
      this.renderCommandCard();
    };
    grid.appendChild(b);
    return b;
  }

  setOrderMode(mode) {
    document.querySelectorAll('.cmd').forEach((c) => c.classList.remove('active-order'));
    if (!mode) { this.el.ccHint.textContent = 'ПКМ — приказ'; return; }
    const map = { attack: 'A', patrol: 'P' };
    if (map[mode]) {
      document.querySelectorAll('.cmd').forEach((c) => {
        if (c.querySelector('.hk')?.textContent === map[mode]) c.classList.add('active-order');
      });
    }
    this.el.ccHint.textContent = mode === 'attack' ? 'Кликните цель для атаки · Esc — отмена'
      : mode === 'patrol' ? 'Укажите точки патруля (2+) · Esc — отмена'
      : 'Укажите точку сбора';
  }

  /* ================= ВЕРХНЯЯ ПАНЕЛЬ ================= */
  update(dt) {
    this.timer += dt;
    this.moveTooltip();
    const g = this.game;
    const p = g.players?.player;
    if (!p) return;

    this.el.crystal.querySelector('.res-val').textContent = Math.floor(p.crystal);
    this.el.crystal.querySelector('.res-rate').textContent = `+${g.crystalRate('player').toFixed(1)}/с`;

    this.el.power.querySelector('.res-val').textContent = `${Math.round(p.power)}/${Math.round(p.powerUsed)}`;
    const ratio = p.powerUsed > 0 ? p.power / p.powerUsed : 1;
    this.el.powerFill.style.width = `${Math.min(100, ratio * 100)}%`;
    this.el.powerFill.classList.toggle('over', ratio < 1);

    this.el.pop.querySelector('.res-val').textContent = `${p.pop}/${p.popCap}`;
    this.el.clock.querySelector('.res-val').textContent = fmtTime(g.simTime);

    const phase = g.dayPhase;
    this.el.mpTime.textContent = phase < 0.22 ? 'НОЧЬ' : phase < 0.32 ? 'РАССВЕТ' : phase < 0.68 ? 'ДЕНЬ' : phase < 0.8 ? 'ЗАКАТ' : 'НОЧЬ';

    if (this.timer > 0.12) {
      this.timer = 0;
      this.renderSelection();
      this.renderCommandCard();
    }
  }

  /* ================= ЭКРАНЫ ================= */
  fillHelp() {
    const cols = [
      ['УПРАВЛЕНИЕ', [
        ['Стрелки / края экрана', 'панорама камеры'], ['Колесо', 'зум к курсору'],
        ['Средняя кнопка (тянуть)', 'поворот и наклон'], ['Q / E', 'поворот камеры'],
        ['ЛКМ', 'выбор'], ['ЛКМ + тянуть', 'рамка'], ['Двойной клик', 'все того же типа'],
        ['ПКМ', 'приказ'], ['A / P / S / H', 'атака / патруль / стоп / держать'],
        ['Ctrl + 1..9', 'назначить группу'], ['1..9', 'выбрать группу'], ['Tab', 'вся армия'],
        ['Esc / Пробел', 'пауза'], ['F1', 'справка'], ['M', 'звук'],
      ]],
      ['ЭКОНОМИКА И БОЙ', [
        ['Кристаллы ◆', 'сборщики возят из жил'],
        ['Энергия ⚡', 'реакторы; дефицит = −58% скорости'],
        ['Лимит армии', '+12 за командный центр'],
        ['Типы урона', 'ракеты > танки > пушки > пехота'],
        ['Лансер / Хранитель', 'сбивают авиацию'],
        ['Турель / Тесла', 'бьют по воздуху'],
        ['Туман войны', 'нужны разведчики'],
        ['Цель', 'уничтожить все постройки врага'],
      ]],
    ];
    document.getElementById('help-cols').innerHTML = cols.map(([title, rows]) => `
      <div><h3>${title}</h3>${rows.map(([a, b]) => `<div class="k"><span>${b}</span><b>${a}</b></div>`).join('')}</div>
    `).join('');
  }

  showEnd(d) {
    const el = document.getElementById('screen-end');
    document.getElementById('end-title').textContent = d.victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    document.getElementById('end-title').style.color = d.victory ? '' : '#ff5566';
    document.getElementById('end-text').textContent = d.victory
      ? 'Ядро Роя Каоса разрушено. Сектор под контролем Альянса.'
      : 'Ваш командный центр пал. Сектор потерян.';
    document.getElementById('end-stats').innerHTML = `
      <div class="stat-box"><div class="v">${fmtTime(d.time)}</div><div class="k">ВРЕМЯ</div></div>
      <div class="stat-box"><div class="v">${d.crystals}</div><div class="k">ДОБЫТО КРИСТАЛЛОВ</div></div>
      <div class="stat-box"><div class="v">${d.stats.kills.player}</div><div class="k">УНИЧТОЖЕНО ВРАГОВ</div></div>
      <div class="stat-box"><div class="v">${d.stats.losses.player}</div><div class="k">ПОТЕРИ</div></div>
      <div class="stat-box"><div class="v">${d.stats.buildingsDestroyed.enemy}</div><div class="k">СНЕСЕНО ЗДАНИЙ ВРАГА</div></div>
      <div class="stat-box"><div class="v">${d.units}</div><div class="k">ВЫПУЩЕНО ЮНИТОВ</div></div>`;
    el.classList.remove('hidden');
  }
}
