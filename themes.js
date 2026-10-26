// Board themes for custom and scheduled puzzles (the Create page's Theme menu; &th= in
// a link). A theme recolors only the board — its well, the target zone, the tiles, the
// letters and the nine piece colours — the same in light and dark mode, so a
// holiday puzzle always looks the way its creator made it. Piece colours stay light
// enough for dark letters (Halloween's letters stay dark on light tiles too).
const THEMES = {
  halloween: { label: 'Halloween', vars: {
    '--well': '#2A1B3A', '--well-outer': '#211530', '--zone': '#3A2850', '--tile': '#FFF1DC',
    '--tile-line': '#8C6A9E', '--ink': '#20131F',
    '--o1': '#F59B42', '--o2': '#B693E0', '--o3': '#A4D77F', '--o4': '#F2D06B', '--o5': '#EC8E7C',
    '--o6': '#D8C7B4', '--o7': '#F8BE8D', '--o8': '#B4ABC6', '--o9': '#DCEFA6' },
    confetti: ['#F59B42', '#8E5CC2', '#6BBF59', '#F2D06B', '#2A1B3A'] },
  winter: { label: 'Winter', vars: {
    '--well': '#CFE2F1', '--well-outer': '#BFD6EA', '--zone': '#E3EFF8', '--tile': '#FFFFFF',
    '--tile-line': '#A3C0D8', '--ink': '#18293A',
    '--o1': '#A9D2F2', '--o2': '#C7E8E2', '--o3': '#D7DCF5', '--o4': '#F2C2C7', '--o5': '#BFDDB8',
    '--o6': '#E3E8EE', '--o7': '#F5D9A8', '--o8': '#C9C3E8', '--o9': '#B5E3F0' },
    confetti: ['#FFFFFF', '#A9D2F2', '#D9334A', '#2E8B57', '#C9D6E3'] },
  valentine: { label: 'Valentine', vars: {
    '--well': '#F4CDD8', '--well-outer': '#EDBCCB', '--zone': '#FADFE6', '--tile': '#FFF8FA',
    '--tile-line': '#DE9FB2', '--ink': '#3A1424',
    '--o1': '#F59AB1', '--o2': '#F7C1CF', '--o3': '#E5B4E8', '--o4': '#FFD2B8', '--o5': '#F28C8C',
    '--o6': '#F5E1E6', '--o7': '#D9B8F0', '--o8': '#FFB3C6', '--o9': '#F9D8E0' },
    confetti: ['#E63B5E', '#F59AB1', '#FFFFFF', '#B5179E', '#FFB3C6'] },
  ocean: { label: 'Ocean', vars: {
    '--well': '#BEE3E6', '--well-outer': '#ADD9DD', '--zone': '#D6EEF0', '--tile': '#F8FCFC',
    '--tile-line': '#8EC3C8', '--ink': '#123038',
    '--o1': '#8FD3D9', '--o2': '#F3D9A4', '--o3': '#A7C4F2', '--o4': '#F5B3A0', '--o5': '#B8E4C9',
    '--o6': '#DCE9EC', '--o7': '#C9E2F5', '--o8': '#9EC9E0', '--o9': '#F7E6C4' },
    confetti: ['#1C9AA8', '#F3D9A4', '#F28C7C', '#3E6FD8', '#FFFFFF'] },
  forest: { label: 'Forest', vars: {
    '--well': '#C9D8BE', '--well-outer': '#BACDAD', '--zone': '#DCE6D3', '--tile': '#FBFBF3',
    '--tile-line': '#9DB28C', '--ink': '#1F2A17',
    '--o1': '#A9CF8F', '--o2': '#D9C09A', '--o3': '#C4DDA8', '--o4': '#E8C78F', '--o5': '#D6A58C',
    '--o6': '#E3E5D3', '--o7': '#B9D3B0', '--o8': '#CDBFA6', '--o9': '#E6E0A8' },
    confetti: ['#4C8C3F', '#A9CF8F', '#B07A4F', '#E8C78F', '#2F5A27'] },
  midnight: { label: 'Midnight', vars: {
    '--well': '#151B33', '--well-outer': '#10152A', '--zone': '#1E2647', '--tile': '#EEF0FA',
    '--tile-line': '#5D6A9E', '--ink': '#12162B',
    '--o1': '#9FB3F5', '--o2': '#C4A8F0', '--o3': '#8FD6E3', '--o4': '#F3E19A', '--o5': '#F2A9C8',
    '--o6': '#D5DAEC', '--o7': '#B7C9F7', '--o8': '#A9B2D6', '--o9': '#D9C9F7' },
    confetti: ['#F3E19A', '#9FB3F5', '#FFFFFF', '#C4A8F0', '#6E7FCC'] },
};
// ---- custom colours: the creator picks every board colour, separately for light and
// dark mode. In a link: th=custom, tc= (light) and td= (dark), each the 14 colours
// of THEME_KEYS as 6 hex digits, run together (84 characters).
const THEME_KEYS = ['--well', '--zone', '--tile', '--tile-line', '--ink',
                    '--o1', '--o2', '--o3', '--o4', '--o5', '--o6', '--o7', '--o8', '--o9'];
const CLASSIC = {                               // the game's own colours (styles.css)
  light: { '--well': '#D8E0E7', '--zone': '#E6ECF1', '--tile': '#FCFDFC', '--tile-line': '#B9C6D0',
           '--ink': '#22303F', '--o1': '#F5C48C', '--o2': '#A9D9BE', '--o3': '#B5C7F0', '--o4': '#DDBEE8',
           '--o5': '#EFDE9C', '--o6': '#E8B3A6', '--o7': '#F2B8C8', '--o8': '#CBD3DA', '--o9': '#C9E39E' },
  dark:  { '--well': '#1E262E', '--zone': '#232C35', '--tile': '#2A343E', '--tile-line': '#3B4854',
           '--ink': '#E4E9EE', '--o1': '#7C5A35', '--o2': '#335E49', '--o3': '#3A4B7A', '--o4': '#5E4470',
           '--o5': '#6E6230', '--o6': '#74443B', '--o7': '#7A3E55', '--o8': '#4A545E', '--o9': '#4E6A2C' },
};
const encodeColors = mode => THEME_KEYS.map(k => (mode[k] || '#000000').slice(1).toLowerCase()).join('');
function decodeColors(str) {
  if (!/^[0-9a-f]{84}$/i.test(str || '')) return null;
  const out = {};
  THEME_KEYS.forEach((k, i) => { out[k] = '#' + str.slice(i * 6, i * 6 + 6).toLowerCase(); });
  return out;
}
// a theme's colours for both modes (presets look the same in both)
function themeModes(key) {
  if (THEMES[key]) {
    const m = {}; THEME_KEYS.forEach(k => { m[k] = THEMES[key].vars[k]; });
    return { light: { ...m }, dark: { ...m } };
  }
  return { light: { ...CLASSIC.light }, dark: { ...CLASSIC.dark } };
}
function shade(hex, f) {                        // f < 0 darker, f > 0 lighter
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255]
    .map(c => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return '#' + ch.map(c => c.toString(16).padStart(2, '0')).join('');
}
// apply (or clear, with no key) a theme's colours on an element and everything in it.
// custom: {light, dark} for key 'custom'; dark: which mode (default: the page's)
function applyBoardTheme(el, key, custom, dark) {
  const all = new Set([...Object.values(THEMES).flatMap(t => Object.keys(t.vars)), ...THEME_KEYS, '--well-outer']);
  all.forEach(v => el.style.removeProperty(v));
  if (key === 'custom' && custom) {
    if (dark === undefined) dark = document.documentElement.classList.contains('dark');
    const m = custom[dark ? 'dark' : 'light'] || custom.light;
    THEME_KEYS.forEach(k => { if (m[k]) el.style.setProperty(k, m[k]); });
    if (m['--well']) el.style.setProperty('--well-outer', shade(m['--well'], -0.07));
    return;
  }
  const t = THEMES[key];
  if (t) Object.entries(t.vars).forEach(([v, c]) => el.style.setProperty(v, c));
}
