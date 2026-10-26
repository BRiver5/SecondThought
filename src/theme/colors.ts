// Палитра Second Thought: оливковый мох (спокойствие "подожду") против тёплого
// абрикосового "хочу". Единственный файл с цветами — экраны берут токены отсюда.

export const light = {
  background: "#EDEFE8",
  backgroundAlt: "#E3E6DC",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F6F1",
  border: "#DCE0D3",
  ink: "#1F2318",
  inkMuted: "#646B58",
  inkFaint: "#9CA28F",
  onAccent: "#FFFFFF",
  accent: "#505D28",
  accentSoft: "#E1E6CF",
  danger: "#B8402B",
  success: "#4F7A3A",
  // Тёплое "хочу": полоска зуда, срок ожидания, кривая желания.
  urge: "#D9774B",
  urgeSoft: "#F8E3D7",
  // Купил после ожидания (честная покупка) — сланцево-синий, не "плохой" цвет.
  planned: "#4D6A8A",
  plannedSoft: "#DDE5EE",
  signal: "#9A5B13",
  scrim: "rgba(31,35,24,0.45)",
  statusDimmed: "#90938A",
};

export const dark = {
  background: "#121410",
  backgroundAlt: "#191C16",
  surface: "#1E211A",
  surfaceAlt: "#262A21",
  border: "#30352A",
  ink: "#EEF0E8",
  inkMuted: "#A6AD98",
  inkFaint: "#6E7562",
  onAccent: "#FFFFFF",
  accent: "#7E8F45",
  accentSoft: "#2C3320",
  danger: "#E0705C",
  success: "#7FAE66",
  urge: "#E89068",
  urgeSoft: "#3A2A22",
  planned: "#7C9BBE",
  plannedSoft: "#243040",
  signal: "#E0A040",
  scrim: "rgba(0,0,0,0.6)",
  statusDimmed: "#080907",
};

export type Palette = typeof light;

// Категории — в фиксированном порядке, чтобы цвет принадлежал категории.
export const CATEGORY_COLORS: Record<string, string> = {
  Clothes: "#B0624A",
  Gadgets: "#4D6A8A",
  Home: "#7A8B3A",
  Beauty: "#B5718F",
  Hobby: "#C28E2E",
  Books: "#6B5B95",
  "Food & drink": "#3E8A7E",
  Other: "#8A8578",
};
