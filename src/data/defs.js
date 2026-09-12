/* =========================================================
   DOMINION — справочники юнитов, построек и баланса
   ========================================================= */

export const TILE = 2.0;          // размер клетки в мировых единицах
export const MAP_SIZE = 96;       // клеток по стороне
export const WORLD_SIZE = MAP_SIZE * TILE;

/** Типы брони/урона: rock-paper-scissors */
export const DMG_TABLE = {
  // атакующий тип -> множитель по типу брони
  bullet:  { light: 1.0, medium: 0.85, heavy: 0.6, air: 0.75, structure: 0.9 },
  cannon:  { light: 1.15, medium: 1.0,  heavy: 1.1, air: 0.35, structure: 1.3 },
  missile: { light: 0.9,  medium: 1.1,  heavy: 1.2, air: 1.6,  structure: 1.0 },
  laser:   { light: 1.0,  medium: 1.0,  heavy: 0.95, air: 1.2, structure: 1.15 },
  bomb:    { light: 1.4,  medium: 1.2,  heavy: 1.0, air: 0.5,  structure: 1.5 },
};

export const dmgMult = (type, armor) => (DMG_TABLE[type]?.[armor] ?? 1);

/* ============================== ЮНИТЫ ============================== */
export const UNITS = {
  harvester: {
    id: 'harvester', name: 'Сборщик «Муравей»', icon: '⬢', cat: 'unit',
    cost: { crystal: 60, energy: 0 }, buildTime: 9, hp: 120, armor: 'light', armorVal: 0,
    speed: 7.2, radius: 0.85, sight: 8, pop: 1, flying: false,
    harvest: { capacity: 28, rate: 7, seek: 11 },
    desc: 'Добывает кристаллы из жил и свозит их в командный центр. Беззащитен — прикрывай.',
    producedBy: 'command',
  },
  ranger: {
    id: 'ranger', name: 'Рейнджер', icon: '⌖', cat: 'unit',
    cost: { crystal: 50, energy: 12 }, buildTime: 11, hp: 150, armor: 'light', armorVal: 1,
    speed: 6.4, radius: 0.8, sight: 11, pop: 1, flying: false,
    weapon: { name: 'Импульсная винтовка', type: 'bullet', dmg: 13, rate: 1.35, range: 8.5, speed: 42, spread: 0.06 },
    desc: 'Универсальная пехота. Дёшев, быстр, хорош против лёгких целей и толпой.',
    producedBy: 'barracks',
  },
  lancer: {
    id: 'lancer', name: 'Лансер', icon: '✦', cat: 'unit',
    cost: { crystal: 80, energy: 25 }, buildTime: 15, hp: 130, armor: 'light', armorVal: 1,
    speed: 6.0, radius: 0.8, sight: 13, pop: 1, flying: false,
    weapon: { name: 'ПТРК «Игла»', type: 'missile', dmg: 46, rate: 0.42, range: 12, speed: 26, splash: 1.4 },
    desc: 'Ракетчик. Медленно перезаряжается, но прошивает танки и сбивает авиацию.',
    producedBy: 'barracks',
  },
  bastion: {
    id: 'bastion', name: 'Бастион', icon: '⬣', cat: 'unit',
    cost: { crystal: 160, energy: 55 }, buildTime: 26, hp: 620, armor: 'heavy', armorVal: 4,
    speed: 4.1, radius: 1.5, sight: 12, pop: 2, flying: false,
    weapon: { name: 'Осадное орудие', type: 'cannon', dmg: 58, rate: 0.55, range: 11, speed: 34, splash: 2.6 },
    desc: 'Тяжёлый танк. Медленный, но держит удар и сносит укрепления залпом.',
    producedBy: 'factory',
  },
  mortar: {
    id: 'mortar', name: 'Мортира', icon: '◉', cat: 'unit',
    cost: { crystal: 190, energy: 70 }, buildTime: 28, hp: 240, armor: 'medium', armorVal: 2,
    speed: 3.0, radius: 1.25, sight: 16, pop: 2, flying: false,
    weapon: { name: 'Навесной миномёт', type: 'cannon', dmg: 74, rate: 0.32, range: 19, speed: 24, splash: 3.4, arc: true, minRange: 5 },
    desc: 'Артиллерия дальнего боя. Разбирает базу с безопасной дистанции, но хрупка вблизи.',
    producedBy: 'factory',
  },
  wasp: {
    id: 'wasp', name: 'Оса', icon: '✈', cat: 'unit',
    cost: { crystal: 140, energy: 60 }, buildTime: 20, hp: 210, armor: 'air', armorVal: 1,
    speed: 11.5, radius: 1.0, sight: 15, pop: 2, flying: true, flyHeight: 4.2,
    weapon: { name: 'Сдвоенная пушка', type: 'bullet', dmg: 11, rate: 3.2, range: 8, speed: 46, spread: 0.09 },
    desc: 'Штурмовик. Игнорирует наземные препятствия, уничтожается только ПВО.',
    producedBy: 'airpad',
  },
  seraph: {
    id: 'seraph', name: 'Серафим', icon: '✧', cat: 'unit',
    cost: { crystal: 210, energy: 95 }, buildTime: 30, hp: 320, armor: 'air', armorVal: 2,
    speed: 9.0, radius: 1.3, sight: 16, pop: 3, flying: true, flyHeight: 5.0,
    weapon: { name: 'Плазменные бомбы', type: 'bomb', dmg: 88, rate: 0.5, range: 9, speed: 22, splash: 4.0, arc: true },
    desc: 'Тяжёлый бомбардировщик. Ковровые удары по скоплениям и укреплениям.',
    producedBy: 'airpad',
  },
  guardian: {
    id: 'guardian', name: 'Хранитель', icon: '◈', cat: 'unit',
    cost: { crystal: 240, energy: 110 }, buildTime: 34, hp: 900, armor: 'heavy', armorVal: 6,
    speed: 3.2, radius: 1.8, sight: 13, pop: 3, flying: false,
    weapon: { name: 'Ионный излучатель', type: 'laser', dmg: 34, rate: 1.9, range: 9.5, speed: 60, beam: true },
    desc: 'Экспериментальный мех. Ионный луч игнорирует броню и выжигает всё подряд.',
    producedBy: 'techlab',
  },
};

/* ============================== ПОСТРОЙКИ ============================== */
export const BUILDINGS = {
  command: {
    id: 'command', name: 'Командный центр', icon: '⬢', size: 3, hp: 3000, armor: 'structure', armorVal: 6,
    cost: { crystal: 400, energy: 0 }, buildTime: 46, sight: 16, power: 12, popCap: 14,
    produces: ['harvester'], dropoff: true, rally: true,
    desc: 'Сердце базы. Принимает кристаллы, производит сборщиков, даёт энергию и +14 к лимиту армии. Можно ставить несколько — это ваши экспансии.',
  },
  barracks: {
    id: 'barracks', name: 'Казармы', icon: '⌖', size: 3, hp: 1100, armor: 'structure', armorVal: 2,
    cost: { crystal: 150, energy: 40 }, buildTime: 24, sight: 9, power: -6,
    produces: ['ranger', 'lancer'], rally: true,
    desc: 'Готовит пехоту: рейнджеров и ракетчиков.',
  },
  factory: {
    id: 'factory', name: 'Завод тяжёлой техники', icon: '⬣', size: 3, hp: 1600, armor: 'structure', armorVal: 4,
    cost: { crystal: 260, energy: 90 }, buildTime: 36, sight: 9, power: -12,
    produces: ['bastion', 'mortar'], rally: true, requires: ['barracks'],
    desc: 'Сборочный цех танков «Бастион» и мортир.',
  },
  airpad: {
    id: 'airpad', name: 'Аэродром', icon: '✈', size: 3, hp: 1200, armor: 'structure', armorVal: 2,
    cost: { crystal: 300, energy: 120 }, buildTime: 40, sight: 12, power: -14,
    produces: ['wasp', 'seraph'], rally: true, requires: ['factory'],
    desc: 'Выпускает «Ос» и бомбардировщики «Серафим».',
  },
  techlab: {
    id: 'techlab', name: 'Технолаборатория', icon: '◈', size: 3, hp: 1000, armor: 'structure', armorVal: 2,
    cost: { crystal: 340, energy: 150 }, buildTime: 44, sight: 10, power: -16,
    produces: ['guardian'], rally: true, requires: ['airpad'],
    desc: 'Секретные разработки: боевой мех «Хранитель».',
  },
  reactor: {
    id: 'reactor', name: 'Реактор', icon: '⚡', size: 2, hp: 700, armor: 'structure', armorVal: 1,
    cost: { crystal: 130, energy: 0 }, buildTime: 20, sight: 7, power: 22,
    desc: 'Даёт +22 к мощности. Без энергии производство и турели работают вдвое хуже.',
  },
  turret: {
    id: 'turret', name: 'Оборонная турель', icon: '⌗', size: 2, hp: 850, armor: 'structure', armorVal: 5,
    cost: { crystal: 110, energy: 50 }, buildTime: 18, sight: 13, power: -4,
    weapon: { name: 'Автопушка', type: 'bullet', dmg: 20, rate: 2.4, range: 13, speed: 48, airCapable: true },
    desc: 'Автономная защита периметра. Бьёт и по земле, и по воздуху.',
  },
  tesla: {
    id: 'tesla', name: 'Тесла-вышка', icon: 'ϟ', size: 2, hp: 700, armor: 'structure', armorVal: 3,
    cost: { crystal: 220, energy: 110 }, buildTime: 26, sight: 12, power: -10, requires: ['reactor'],
    weapon: { name: 'Разрядник', type: 'laser', dmg: 70, rate: 0.85, range: 11.5, chain: 3, beam: true, airCapable: true },
    desc: 'Молния перескакивает на 3 цели подряд. Идеальна против роя.',
  },
  pylon: {
    id: 'pylon', name: 'Генератор щита', icon: '◎', size: 2, hp: 620, armor: 'structure', armorVal: 2,
    cost: { crystal: 180, energy: 60 }, buildTime: 22, sight: 9, power: -8,
    aura: { radius: 16, regen: 6 },
    desc: 'Восстанавливает 6 HP/с всем союзникам в радиусе 16.',
  },
  wall: {
    id: 'wall', name: 'Барьер', icon: '▤', size: 1, hp: 500, armor: 'structure', armorVal: 8,
    cost: { crystal: 22, energy: 0 }, buildTime: 4, sight: 3, power: 0, blocks: true,
    desc: 'Дешёвая преграда. Канализирует атаку в удобные коридоры.',
  },
};

/** Порядок в карточке команд при постройке */
export const BUILD_ORDER = ['command', 'reactor', 'barracks', 'turret', 'wall', 'pylon', 'factory', 'tesla', 'airpad', 'techlab'];

/* ============================== ФРАКЦИИ ============================== */
export const FACTIONS = {
  player: { id: 'player', name: 'Альянс Вегой', color: 0x35d0ff, accent: '#35d0ff', emissive: 0x0af5ff },
  enemy:  { id: 'enemy',  name: 'Рой Каоса',     color: 0xff4d5e, accent: '#ff4d5e', emissive: 0xff2040 },
  neutral:{ id: 'neutral',name: 'Нейтралы',      color: 0x9aa7b4, accent: '#9aa7b4', emissive: 0x8899aa },
};

/** Множители сложности: [доход, скорость постройки, размер волн, интервал волн] */
export const DIFFICULTY = [
  { name: 'Разведка',   income: 0.85, buildSpeed: 0.8, waveScale: 0.7, waveTime: 150, aggro: 0.6, startUnits: 2 },
  { name: 'Вторжение',  income: 1.0,  buildSpeed: 1.0, waveScale: 1.0, waveTime: 125, aggro: 1.0, startUnits: 3 },
  { name: 'Истребление',income: 1.25, buildSpeed: 1.3, waveScale: 1.4, waveTime: 95,  aggro: 1.5, startUnits: 5 },
];

export const MAP_PRESETS = [
  { name: 'Равнины Ариона', seed: 1337,  roughness: 0.35, waterFrac: 0.07, crystals: 16, islands: false },
  { name: 'Кратеры Каоса',  seed: 90210, roughness: 0.85, waterFrac: 0.05, crystals: 14, islands: false, craters: 14 },
  { name: 'Острова Тейи',   seed: 4242,  roughness: 0.50, waterFrac: 0.30, crystals: 18, islands: true },
];

export const fmtCost = (c) => {
  const parts = [];
  if (c.crystal) parts.push(`${c.crystal}◆`);
  if (c.energy) parts.push(`${c.energy}⚡`);
  return parts.join(' ') || 'бесплатно';
};

export const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
