// ธีมสีประจำทีมของฝั่งโค้ช — โทนสีจากโลโก้ทีม พื้นหน้าจอ/ตารางยังเป็นสีสว่างตามเดิมเพื่อให้อ่านง่าย เปลี่ยนเฉพาะส่วนหัว ปุ่มหลัก ป้าย/ไฮไลต์เมนู
// สีกราฟของทีม (TEAM_COLORS ใน ui-utils.js) เป็นอีกชุดหนึ่ง ไม่เกี่ยวกัน — ไม่แก้
// ตัวแปร CSS ที่ตั้ง: --accent / --accent-hover / --accent-tint (ปุ่มหลัก, ป้ายที่เลือก ฯลฯ ใน styles.css ใช้อยู่แล้ว) และ --header-bg / --header-ink / --team-highlight

export const TEAM_THEMES = {
  "THAWEE SC": { header: "#991b1b", accent: "#dc2626", accentHover: "#b91c1c", highlight: "#d4a63a" }, // แดง
  "KHAMPHEE FOOTBALL": { header: "#1e3a8a", accent: "#1d4ed8", accentHover: "#1e40af", highlight: "#d4a63a" }, // น้ำเงิน
  THAMMASATHIT: { header: "#14532d", accent: "#15803d", accentHover: "#166534", highlight: "#d4a63a" } // เขียว
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ความสว่างสัมพัทธ์/อัตราส่วนความเข้มตาม WCAG 2.x — ใช้ตรวจว่าตัวอักษรสีขาวบนสีธีมอ่านได้ (เทสต์บังคับ ≥ 4.5)
export function contrastWithWhite(hex) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(lin);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05);
}

// ตัวแปร CSS ของทีม (null = ไม่รู้จักทีม → ใช้ธีมเริ่มต้นของระบบ)
export function teamThemeVars(team) {
  const t = TEAM_THEMES[team];
  if (!t) return null;
  const [r, g, b] = hexToRgb(t.accent);
  return {
    "--accent": t.accent,
    "--accent-hover": t.accentHover,
    "--accent-tint": `rgba(${r}, ${g}, ${b}, 0.1)`,
    "--header-bg": t.header,
    "--header-ink": "#FFFFFF",
    "--team-highlight": t.highlight
  };
}

const THEME_VAR_NAMES = ["--accent", "--accent-hover", "--accent-tint", "--header-bg", "--header-ink", "--team-highlight"];

// ใส่ธีมของทีม (team = null หรือไม่รู้จัก = ล้างกลับเป็นธีมเริ่มต้น) — data-team-theme ใช้ให้ CSS ปรับรายละเอียดของหัวหน้า (โลโก้บนพื้นเข้ม ฯลฯ)
export function applyTeamTheme(team, root = document.documentElement) {
  const vars = teamThemeVars(team);
  for (const name of THEME_VAR_NAMES) root.style.removeProperty(name);
  if (!vars) {
    root.removeAttribute("data-team-theme");
    return;
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.setAttribute("data-team-theme", team);
}
