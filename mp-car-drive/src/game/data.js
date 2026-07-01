export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 720;
export const TOTAL_ACRES = 168;
export const TOTAL_PARCELS = 13;

export const PLAYER_START = { x: 7.45, y: 0.6, z: 4.65 };

export const LAND_PARCELS = [
  { id: 'unhel', name: 'Unhel', acres: 12, x: -5.9, z: -2.45, kind: 'road', magnetRadius: 1.85, grabRadius: 0.48 },
  { id: 'kasba-ujjain', name: 'Kasba Ujjain', acres: 16, x: -3.8, z: -0.6, kind: 'land-use', magnetRadius: 1.9, grabRadius: 0.5 },
  { id: 'pandyakhedi', name: 'Pandyakhedi', acres: 14, x: -1.15, z: -3.45, kind: 'land-use', magnetRadius: 1.9, grabRadius: 0.5 },
  { id: 'karondya', name: 'Karondya', acres: 13, x: 1.45, z: -1.75, kind: 'road', magnetRadius: 1.85, grabRadius: 0.48 },
  { id: 'kesoni', name: 'Kesoni', acres: 10, x: 4.2, z: -3.25, kind: 'other', magnetRadius: 1.7, grabRadius: 0.46 },
  { id: 'manpura', name: 'Manpura', acres: 11, x: 6.0, z: -1.15, kind: 'other', magnetRadius: 1.7, grabRadius: 0.46 },
  { id: 'chandesara', name: 'Chandesara', acres: 14, x: 4.9, z: 2.1, kind: 'road', magnetRadius: 1.85, grabRadius: 0.48 },
  { id: 'gothda', name: 'Gothda', acres: 11, x: 2.05, z: 3.35, kind: 'other', magnetRadius: 1.7, grabRadius: 0.46 },
  { id: 'dhediya', name: 'Dhediya', acres: 12, x: -0.55, z: 1.05, kind: 'land-use', magnetRadius: 1.85, grabRadius: 0.48 },
  { id: 'karadiya', name: 'Karadiya', acres: 14, x: -2.25, z: 3.85, kind: 'road', magnetRadius: 1.85, grabRadius: 0.48 },
  { id: 'sikandari', name: 'Sikandari', acres: 10, x: -5.2, z: 2.35, kind: 'other', magnetRadius: 1.7, grabRadius: 0.46 },
  { id: 'sawarakhedi', name: 'Sawarakhedi', acres: 18, x: -6.55, z: 0.65, kind: 'land-use', magnetRadius: 1.95, grabRadius: 0.52 },
  { id: 'narsinga', name: 'Narsinga', acres: 13, x: 6.55, z: 3.85, kind: 'other', magnetRadius: 1.8, grabRadius: 0.48 }
];

export const PUBLIC_GOALS = [
  { id: 'roads', label: 'Roads', color: '#46c2ff', x: -7.2, z: -4.25 },
  { id: 'schools', label: 'Schools', color: '#7ee081', x: -3.7, z: -4.55 },
  { id: 'hospitals', label: 'Hospitals', color: '#ffffff', x: 0.1, z: -4.35 },
  { id: 'water', label: 'Drinking Water', color: '#76d7ff', x: 4.1, z: -4.55 },
  { id: 'jobs', label: 'Jobs', color: '#9ff0bc', x: 7.05, z: -3.5 },
  { id: 'irrigation', label: 'Irrigation', color: '#eafff1', x: -7.25, z: -0.9 },
  { id: 'transport', label: 'Public Transport', color: '#46c2ff', x: -4.45, z: 0.9 },
  { id: 'housing', label: 'Housing', color: '#7ee081', x: -0.1, z: -0.25 },
  { id: 'digital', label: 'Digital Services', color: '#ffffff', x: 3.75, z: 0.45 },
  { id: 'farmers', label: 'Farmer Support', color: '#76d7ff', x: 7.25, z: 0.85 },
  { id: 'energy', label: 'Clean Energy', color: '#9ff0bc', x: -5.8, z: 4.15 },
  { id: 'safety', label: 'Women Safety', color: '#eafff1', x: -1.25, z: 4.55 },
  { id: 'skills', label: 'Skill Training', color: '#46c2ff', x: 4.8, z: 4.2 }
];

export const BAIT_FLAGS = PUBLIC_GOALS.map((goal) => ({
  id: goal.id,
  label: goal.label,
  x: goal.x,
  z: goal.z,
  color: goal.color
}));

export const REGIONS = LAND_PARCELS;

export const REGION_KIND_META = {
  road: { label: 'New road links', color: '#b48b42', hex: 0xb48b42 },
  'land-use': { label: 'Land-use zone', color: '#9f7a3f', hex: 0x9f7a3f },
  other: { label: 'Other key area', color: '#78804b', hex: 0x78804b }
};

export function isInsideUjjainMap(x, y) {
  const cx = 510;
  const cy = 398;
  const nx = (x - cx) / 390;
  const ny = (y - cy) / 300;
  const base = nx * nx + ny * ny;
  const topLeftBite = x < 170 && y < 230;
  const bottomRightBite = x > 865 && y > 620;
  return base < 1.18 && !topLeftBite && !bottomRightBite;
}
