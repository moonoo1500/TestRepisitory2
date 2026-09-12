import * as THREE from 'three';
import { BUILDINGS } from '../data/defs.js';
import { dist } from '../core/util.js';
import { createGhost } from '../models/Models.js';

/* =========================================================
   Ввод: выбор, приказы, камера, размещение построек
   ========================================================= */
const _v = new THREE.Vector3();

export class Input {
  constructor(game, dom) {
    this.game = game;
    this.dom = dom;
    this.canvas = dom.canvas;
    this.mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0 };
    this.dragging = false;
    this.dragStart = null;
    this.lastClick = 0;
    this.lastClicked = null;
    this.pendingOrder = null;   // 'attack' | 'patrol' | null
    this.patrolPoints = [];
    this.hovered = null;
    this.edgeMargin = 18;
    this.enabled = false;
    this.bind();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousemove', (e) => this.onMove(e));
    c.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    window.addEventListener('mousemove', (e) => this.onMoveGlobal(e));
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.game.cameraRig.zoom(e.deltaY * 0.0011, this.mouse.ndcX * 0.5 + 0.5, 0.5 - this.mouse.ndcY * 0.5); }, { passive: false });
    c.addEventListener('dblclick', (e) => this.onDblClick(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.game.cameraRig.keys = {}; });

    // миникарта
    const mm = document.getElementById('minimap');
    mm.addEventListener('mousedown', (e) => this.onMinimap(e));
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ================= МЫШЬ ================= */
  onMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    this.mouse.ndcX = (e.clientX / innerWidth) * 2 - 1;
    this.mouse.ndcY = -(e.clientY / innerHeight) * 2 + 1;

    if (this.middleDrag) {
      this.game.cameraRig.rotate(-e.movementX * 0.006);
      this.game.cameraRig.pitchGoal = Math.max(0.35, Math.min(1.35, this.game.cameraRig.pitchGoal + e.movementY * 0.004));
      return;
    }
    if (this.dragging) {
      const b = this.dom.selBox;
      b.classList.remove('hidden');
      const x = Math.min(this.dragStart.x, e.clientX), y = Math.min(this.dragStart.y, e.clientY);
      const w = Math.abs(e.clientX - this.dragStart.x), h = Math.abs(e.clientY - this.dragStart.y);
      b.style.left = `${x}px`; b.style.top = `${y}px`;
      b.style.width = `${w}px`; b.style.height = `${h}px`;
      return;
    }
    if (this.game.placement) this.updatePlacement();
    else this.updateHover();
  }

  onMoveGlobal(e) {
    const m = this.edgeMargin;
    const rig = this.game.cameraRig;
    let ex = 0, ez = 0;
    if (e.clientX < m) ex = -1; else if (e.clientX > innerWidth - m) ex = 1;
    if (e.clientY < m + 52) ez = 1; else if (e.clientY > innerHeight - m - 130) ez = -1;
    // не включаем edge-pan, если курсор над UI
    if (e.clientY > innerHeight - 130 || e.clientY < 54) ez = 0;
    rig.edgePan.x = ex; rig.edgePan.z = ez;
  }

  onDown(e) {
    if (!this.enabled) return;
    this.game.audio.resume();
    if (e.button === 1 || (e.button === 0 && e.shiftKey && e.altKey)) {
      this.middleDrag = true;
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      if (this.game.placement) { this.confirmPlacement(); return; }
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;
      this.dragging = false;
    }
    if (e.button === 2) {
      if (this.game.placement) { this.cancelPlacement(); return; }
      this.rightClick(e);
    }
  }

  onUp(e) {
    if (e.button === 1) { this.middleDrag = false; return; }
    if (e.button !== 0 || !this.dragStart) return;
    const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
    const moved = Math.hypot(dx, dy) > 6;
    this.dom.selBox.classList.add('hidden');
    if (moved) this.boxSelect(this.dragStart.x, this.dragStart.y, e.clientX, e.clientY, e.shiftKey);
    else this.clickSelect(e);
    this.dragging = false;
    this.dragStart = null;
  }

  onDblClick(e) {
    if (!this.enabled) return;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (hit && hit.faction === 'player' && hit.kind === 'unit') this.game.selectAllOfType(hit.typeId);
  }

  /* ================= ВЫБОР ================= */
  project(e) {
    _v.set(e.x, (e.y || 0) + (e.kind === 'building' ? 1.6 : 1.0), e.z).project(this.game.camera);
    if (_v.z > 1) return null;
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight };
  }

  pickAt(px, py, faction = null) {
    let best = null, bd = Infinity;
    for (const e of this.game.entities) {
      if (e.dead || !e.visible) continue;
      if (faction && e.faction !== faction) continue;
      const p = this.project(e);
      if (!p) continue;
      const r = e.kind === 'building' ? 46 : 26;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < r && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateHover() {
    const h = this.pickAt(this.mouse.x, this.mouse.y);
    if (this.hovered && this.hovered !== h) this.hovered.hovered = false;
    this.hovered = h;
    if (h) {
      h.hovered = true;
      this.canvas.style.cursor = h.faction === 'player' ? 'pointer' : 'crosshair';
      this.game.emit('hover', h);
    } else {
      this.canvas.style.cursor = this.game.placement ? 'copy' : 'default';
      this.game.emit('hover', null);
    }
  }

  clickSelect(e) {
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit) { this.game.selectNone(); return; }
    if (hit.faction !== 'player') { this.game.setSelection([hit]); return; }
    if (e.ctrlKey || e.shiftKey) {
      if (this.game.selected.has(hit)) { hit.selected = false; this.game.selected.delete(hit); this.game.emit('selection', [...this.game.selected]); }
      else this.game.addToSelection(hit);
      return;
    }
    this.game.setSelection([hit]);
  }

  boxSelect(x0, y0, x1, y1, additive) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const list = [];
    let hasUnit = false;
    for (const e of this.game.entities) {
      if (e.dead || e.faction !== 'player' || !e.visible) continue;
      const p = this.project(e);
      if (!p) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
      list.push(e);
      if (e.kind === 'unit') hasUnit = true;
    }
    // приоритет юнитам
    const final = hasUnit ? list.filter((e) => e.kind === 'unit') : list;
    if (additive) { for (const e of final) this.game.addToSelection(e); }
    else this.game.setSelection(final);
  }

  /* ================= ПРИКАЗЫ ================= */
  rightClick(e) {
    const sel = [...this.game.selected].filter((x) => x.faction === 'player' && x.kind === 'unit');
    if (!sel.length) return;

    const target = this.pickAt(e.clientX, e.clientY);
    const world = this.groundAt(e.clientX, e.clientY);
    if (!world) return;

    if (this.pendingOrder === 'attack') {
      if (target && target.faction !== 'player') {
        for (const u of sel) u.orderAttack(target);
        this.game.audio.click();
        this.game.fx.ring(target.x, (target.y || 0) + 0.3, target.z, 4, 0xff4d5e);
      }
      this.pendingOrder = null;
      this.game.emit('order-mode', null);
      return;
    }
    if (this.pendingOrder === 'patrol') {
      this.patrolPoints.push(world);
      this.game.fx.ring(world.x, this.game.map.heightAt(world.x, world.z) + 0.3, world.z, 3, 0x5cff9d);
      if (this.patrolPoints.length >= 2) {
        for (const u of sel) u.orderPatrol(this.patrolPoints);
        this.patrolPoints = [];
        this.pendingOrder = null;
        this.game.emit('order-mode', null);
      }
      return;
    }

    // атака врага
    if (target && target.faction !== 'player') {
      const fighters = sel.filter((u) => u.def.weapon);
      for (const u of fighters) u.orderAttack(target);
      this.game.audio.click();
      this.game.fx.ring(target.x, (target.y || 0) + 0.3, target.z, 4, 0xff4d5e);
      if (!fighters.length) this.game.log('Эти юниты не умеют атаковать', 'warn');
      return;
    }

    // точка на жиле — авто-добыча
    const node = this.nearestNode(world.x, world.z, 3.5);
    if (node) {
      const harvesters = sel.filter((u) => u.def.harvest);
      if (harvesters.length) {
        for (const h of harvesters) h.orderHarvest(node);
        this.game.fx.ring(node.x, node.y + 0.3, node.z, 4, 0xb47cff);
        this.game.audio.click();
        return;
      }
    }

    // движение формацией
    this.issueMove(sel, world.x, world.z);
  }

  issueMove(units, x, z) {
    const n = units.length;
    const cols = Math.ceil(Math.sqrt(n));
    const spacing = 2.4;
    const baseAngle = this.game.cameraRig.yaw;
    const cosA = Math.cos(baseAngle), sinA = Math.sin(baseAngle);
    units.forEach((u, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const ox = (col - (cols - 1) / 2) * spacing;
      const oz = (row - (cols - 1) / 2) * spacing;
      const wx = x + ox * cosA - oz * sinA;
      const wz = z + ox * sinA + oz * cosA;
      u.orderMove(wx, wz);
    });
    this.game.audio.click();
    this.game.fx.ring(x, this.game.map.heightAt(x, z) + 0.25, z, 5, 0x00e5ff);
    this.game.minimap?.addPing(x, z, '#00e5ff');
  }

  nearestNode(x, z, r) {
    let best = null, bd = r;
    for (const n of this.game.map.nodes) {
      if (n.amount <= 0) continue;
      const d = dist(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  groundAt(px, py) {
    const ndcX = (px / innerWidth) * 2 - 1;
    const ndcY = -(py / innerHeight) * 2 + 1;
    const rig = this.game.cameraRig;
    // итеративно уточняем высоту земли
    let h = this.game.map.heightAt(rig.target.x, rig.target.z);
    let p = rig.screenToWorld(ndcX, ndcY, h);
    if (!p) return null;
    for (let i = 0; i < 3; i++) {
      h = this.game.map.heightAt(p.x, p.z);
      p = rig.screenToWorld(ndcX, ndcY, h);
      if (!p) return null;
    }
    return p;
  }

  /* ================= РАЗМЕЩЕНИЕ ПОСТРОЕК ================= */
  startPlacement(typeId) {
    this.cancelPlacement();
    const def = BUILDINGS[typeId];
    if (!this.game.terrain) return;
    const ghost = createGhost(typeId);
    this.game.placement = { typeId, def, ghost, valid: false, tx: 0, tz: 0 };
    this.game.scene.add(ghost);
    this.game.terrain.showGrid(true);
    this.dom.placementHud.classList.remove('hidden');
    document.getElementById('cc-grid').querySelectorAll('.cmd').forEach((c) => c.classList.remove('active-order'));
    this.updatePlacement();
    this.game.emit('placement', typeId);
  }

  updatePlacement() {
    const p = this.game.placement;
    if (!p) return;
    const w = this.groundAt(this.mouse.x, this.mouse.y);
    if (!w) return;
    const [tx, tz] = this.game.map.toTile(w.x, w.z);
    p.tx = tx; p.tz = tz;
    const [wx, wz] = this.game.map.toWorld(tx, tz);
    p.ghost.position.set(wx, this.game.map.heightAt(wx, wz) - 0.15, wz);
    p.valid = this.game.map.canPlace(tx, tz, p.def.size) &&
      !this.game.areaHasUnits(tx, tz, p.def.size) &&
      this.game.players.player.crystal >= p.def.cost.crystal;
    const col = p.valid ? 0x00ff88 : 0xff4d5e;
    p.ghost.traverse((o) => { if (o.isMesh) o.material.color.setHex(col); });
  }

  confirmPlacement() {
    const p = this.game.placement;
    if (!p) return;
    if (!p.valid) { this.game.audio.error(); this.game.log('Здесь нельзя строить', 'warn'); return; }
    const player = this.game.players.player;
    if (player.crystal < p.def.cost.crystal) { this.game.audio.error(); return; }
    player.crystal -= p.def.cost.crystal;
    const b = this.game.spawnBuilding(p.typeId, 'player', p.tx, p.tz);
    this.game.audio.click();
    this.game.fx.ring(b.x, b.y + 0.4, b.z, 6, 0x00e5ff);
    this.setSelectionOnly(b);
    if (this.keepPlacing) { this.updatePlacement(); return; }
    this.cancelPlacement();
  }

  setSelectionOnly(b) { this.game.setSelection([b]); }

  cancelPlacement() {
    const p = this.game.placement;
    if (p) {
      this.game.scene.remove(p.ghost);
      p.ghost.traverse((o) => { if (o.isMesh) o.material.dispose(); });
      this.game.terrain?.showGrid(false);
    }
    this.game.placement = null;
    this.dom.placementHud.classList.add('hidden');
    this.game.emit('placement', null);
  }

  /* ================= МИНИКАРТА ================= */
  onMinimap(e) {
    const rect = e.target.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * e.target.width;
    const py = ((e.clientY - rect.top) / rect.height) * e.target.height;
    const w = this.game.minimap.toMap(px, py);
    if (e.button === 0) {
      if (e.shiftKey) {
        this.game.cameraRig.pan(w.x - this.game.cameraRig.goal.x, w.z - this.game.cameraRig.goal.z);
      } else {
        this.game.cameraRig.focus(w.x, w.z);
      }
    } else if (e.button === 2) {
      const sel = [...this.game.selected].filter((x) => x.faction === 'player' && x.kind === 'unit');
      if (sel.length) this.issueMove(sel, w.x, w.z);
    }
  }

  /* ================= КЛАВИАТУРА ================= */
  onKey(e, down) {
    const k = e.key.toLowerCase();
    const rig = this.game.cameraRig;
    if (down && (k === 'escape')) {
      if (this.game.placement) { this.cancelPlacement(); return; }
      if (this.pendingOrder) { this.pendingOrder = null; this.patrolPoints = []; this.game.emit('order-mode', null); return; }
      this.game.emit('toggle-pause');
      return;
    }
    if (!this.enabled) return;
    // Камера: стрелки + края экрана + средняя кнопка мыши.
    // WASD намеренно НЕ заняты камерой — A (атака) и S (стоп) важнее для RTS.
    if (['q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      rig.keys[k] = down;
      if (down) e.preventDefault();
      return;
    }
    if (!down) return;

    const sel = [...this.game.selected].filter((x) => x.faction === 'player');
    const selUnits = sel.filter((x) => x.kind === 'unit');

    switch (k) {
      case 'a': this.pendingOrder = 'attack'; this.game.emit('order-mode', 'attack'); this.game.audio.click(); break;
      case 'p': this.pendingOrder = 'patrol'; this.patrolPoints = []; this.game.emit('order-mode', 'patrol'); break;
      case 's': for (const u of selUnits) u.orderStop(); this.game.audio.click(); break;
      case 'h': for (const u of selUnits) u.orderHold(); this.game.audio.click(); break;
      case 'b': this.game.emit('toggle-build'); break;
      case 'tab': e.preventDefault(); this.game.selectArmy(); break;
      case 'm': this.game.emit('toggle-sound'); break;
      case 'f1': e.preventDefault(); this.game.emit('toggle-help'); break;
      case ' ': e.preventDefault(); this.game.emit('toggle-pause'); break;
      case 'r': if (this.game.placement) this.updatePlacement(); break;
      default: {
        // группы управления
        if (/^[0-9]$/.test(k)) {
          const n = k === '0' ? 10 : +k;
          if (e.ctrlKey) {
            if (selUnits.length) {
              this.game.controlGroups[n] = selUnits;
              this.game.log(`Группа ${n}: ${selUnits.length} юнитов`, '');
              this.game.audio.click();
            }
          } else {
            const grp = (this.game.controlGroups[n] || []).filter((u) => !u.dead && !u._removed);
            this.game.controlGroups[n] = grp;
            if (grp.length) {
              this.game.setSelection(grp);
              const c = grp.reduce((a, u) => ({ x: a.x + u.x / grp.length, z: a.z + u.z / grp.length }), { x: 0, z: 0 });
              this.game.cameraRig.focus(c.x, c.z);
            }
          }
        }
      }
    }
  }
}
