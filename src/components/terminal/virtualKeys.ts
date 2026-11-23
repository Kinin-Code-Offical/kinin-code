// On-screen key layouts for touch screens, one per terminal app. The shell
// itself keeps the small arrow/modifier pad; apps get
//  - a slim top bar (title, rarely used keys such as "new game", and the key
//    that leaves the app) in the empty space above the monitor, and
//  - a bottom dock with the app's real controls, sized to the app (a D-pad
//    for snake, transport keys for music, held movement + fire for HELLRUN…)
//    and kept low enough not to cover the terminal screen.

export type TerminalAppId =
  | "editor"
  | "calc"
  | "snake"
  | "pacman"
  | "pong"
  | "chess"
  | "solitaire"
  | "audio"
  | "video"
  | "image"
  | "hellrun";

type Localized = { tr: string; en: string };

export type VirtualKey = {
  /** Grid area name in the dock (or a unique id for top-bar keys). */
  area: string;
  /** KeyboardEvent.key that is sent. */
  key: string;
  /** KeyboardEvent.code (HELLRUN reads physical codes). */
  code?: string;
  ctrlKey?: boolean;
  label: string | Localized;
  aria: Localized;
  /** keydown on press, keyup on release (real-time games read held keys). */
  hold?: boolean;
  /** Repeats while held, like a physical key (cursor and paddle keys). */
  repeat?: boolean;
  /** Primary action of the layout: drawn a little larger. */
  main?: boolean;
  /** Smaller text, for word labels in narrow cells. */
  small?: boolean;
  /** Opens the soft keyboard instead of sending a key. */
  keyboard?: boolean;
};

export type VirtualLayout = {
  title: Localized;
  /** grid-template-columns of the dock */
  columns: string;
  /** grid-template-areas rows of the dock ("." = empty cell) */
  areas: string[];
  /** Dock row height in px: larger for games. */
  rowHeight: number;
  /** Max dock width in px. */
  maxWidth: number;
  /** Extra keys in the top bar, left of the exit key. */
  bar?: VirtualKey[];
  /** Top-bar key that leaves (or pauses) the app. */
  exit: VirtualKey;
  keys: VirtualKey[];
};

const L = (tr: string, en: string): Localized => ({ tr, en });

const quit: VirtualKey = {
  area: "exit",
  key: "Escape",
  code: "Escape",
  label: L("✕ Çık", "✕ Quit"),
  aria: L("Uygulamadan çık", "Quit the app"),
};

const arrow = (
  dir: "Up" | "Down" | "Left" | "Right",
  extra: Partial<VirtualKey> = {},
): VirtualKey => {
  const glyph = { Up: "▲", Down: "▼", Left: "◀", Right: "▶" }[dir];
  const aria = {
    Up: L("Yukarı", "Up"),
    Down: L("Aşağı", "Down"),
    Left: L("Sol", "Left"),
    Right: L("Sağ", "Right"),
  }[dir];
  return {
    area: dir.toLowerCase(),
    key: `Arrow${dir}`,
    code: `Arrow${dir}`,
    label: glyph,
    aria,
    ...extra,
  };
};

const restart: VirtualKey = {
  area: "restart",
  key: "r",
  code: "KeyR",
  label: L("↻ Yeni", "↻ New"),
  aria: L("Yeniden başlat", "Restart"),
};

const keyboardKey: VirtualKey = {
  area: "kbd",
  key: "",
  label: "⌨",
  aria: L("Klavyeyi aç", "Open the keyboard"),
  keyboard: true,
};

const dpad = (repeat: boolean) => [
  arrow("Up", { repeat }),
  arrow("Down", { repeat }),
  arrow("Left", { repeat }),
  arrow("Right", { repeat }),
];

const transport = (what: "track" | "video"): VirtualKey[] => [
  { area: "prev", key: "ArrowUp", code: "ArrowUp", label: "|◀", aria: what === "track" ? L("Önceki parça", "Previous track") : L("Önceki video", "Previous video") },
  { area: "rew", key: "ArrowLeft", code: "ArrowLeft", label: "◀◀", aria: L("Geri sar", "Rewind"), repeat: true },
  { area: "play", key: " ", code: "Space", label: "▶❚❚", aria: L("Oynat / duraklat", "Play / pause"), main: true },
  { area: "fwd", key: "ArrowRight", code: "ArrowRight", label: "▶▶", aria: L("İleri sar", "Fast forward"), repeat: true },
  { area: "next", key: "ArrowDown", code: "ArrowDown", label: "▶|", aria: what === "track" ? L("Sonraki parça", "Next track") : L("Sonraki video", "Next video") },
];

export const VIRTUAL_LAYOUTS: Record<TerminalAppId, VirtualLayout> = {
  hellrun: {
    title: L("HELLRUN", "HELLRUN"),
    columns: "1fr 1fr 1fr 8px 1fr 1fr 1fr",
    areas: ["sl fw sr . use fire fire", "tl bk tr . run fire fire"],
    rowHeight: 50,
    maxWidth: 460,
    bar: [
      ...[1, 2, 3, 4, 5].map((n) => ({
        area: `w${n}`,
        key: String(n),
        code: `Digit${n}`,
        label: String(n),
        aria: L(`Silah ${n}`, `Weapon ${n}`),
      })),
      { area: "map", key: "Tab", code: "Tab", label: L("Harita", "Map"), aria: L("Otomatik harita", "Automap") },
    ],
    exit: {
      area: "exit",
      key: "Escape",
      code: "Escape",
      label: "❚❚",
      aria: L("Duraklat (menüde tekrar: çık)", "Pause (again in the menu: quit)"),
    },
    keys: [
      { area: "fw", key: "w", code: "KeyW", label: "▲", aria: L("İleri", "Forward"), hold: true },
      { area: "bk", key: "s", code: "KeyS", label: "▼", aria: L("Geri", "Back"), hold: true },
      { area: "tl", key: "ArrowLeft", code: "ArrowLeft", label: "↶", aria: L("Sola dön", "Turn left"), hold: true },
      { area: "tr", key: "ArrowRight", code: "ArrowRight", label: "↷", aria: L("Sağa dön", "Turn right"), hold: true },
      { area: "sl", key: "a", code: "KeyA", label: "⇤", aria: L("Sola kay", "Strafe left"), hold: true },
      { area: "sr", key: "d", code: "KeyD", label: "⇥", aria: L("Sağa kay", "Strafe right"), hold: true },
      { area: "fire", key: " ", code: "Space", label: L("ATEŞ", "FIRE"), aria: L("Ateş et / başla", "Fire / start"), hold: true, main: true },
      { area: "use", key: "e", code: "KeyE", label: L("Kullan", "Use"), aria: L("Kapı / şalter", "Door / switch"), small: true },
      { area: "run", key: "Shift", code: "ShiftLeft", label: L("Koş", "Run"), aria: L("Koş (basılı tut)", "Run (hold)"), hold: true, small: true },
    ],
  },
  chess: {
    title: L("Satranç", "Chess"),
    columns: "1fr 1fr 1fr 8px 1fr 1fr 1fr",
    areas: [
      "cancel up select . bot pvp color",
      "left down right . easy medium hard",
    ],
    rowHeight: 48,
    maxWidth: 460,
    bar: [{ ...restart, label: L("↻ Yeni oyun", "↻ New game") }],
    exit: quit,
    keys: [
      ...dpad(true),
      { area: "select", key: "Enter", code: "Enter", label: L("Seç", "Select"), aria: L("Taşı seç / bırak", "Pick / drop a piece"), main: true },
      { area: "cancel", key: "x", code: "KeyX", label: L("İptal", "Cancel"), aria: L("Seçimi bırak", "Clear the selection"), small: true },
      { area: "bot", key: "b", code: "KeyB", label: L("Bot", "Bot"), aria: L("Bota karşı", "Play the bot"), small: true },
      { area: "pvp", key: "p", code: "KeyP", label: L("2 Kişi", "2P"), aria: L("İki oyunculu", "Two players"), small: true },
      { area: "color", key: "c", code: "KeyC", label: L("Renk", "Color"), aria: L("Botun rengini değiştir", "Swap the bot's colour"), small: true },
      { area: "easy", key: "1", code: "Digit1", label: L("Kolay", "Easy"), aria: L("Kolay bot", "Easy bot"), small: true },
      { area: "medium", key: "2", code: "Digit2", label: L("Orta", "Mid"), aria: L("Orta bot", "Medium bot"), small: true },
      { area: "hard", key: "3", code: "Digit3", label: L("Zor", "Hard"), aria: L("Zor bot", "Hard bot"), small: true },
    ],
  },
  snake: {
    title: L("Yılan", "Snake"),
    columns: "1fr 1fr 1fr",
    areas: [". up .", "left down right"],
    rowHeight: 54,
    maxWidth: 280,
    bar: [restart],
    exit: quit,
    keys: dpad(false),
  },
  pacman: {
    title: L("Pac-Man", "Pac-Man"),
    columns: "1fr 1fr 1fr",
    areas: [". up .", "left down right"],
    rowHeight: 54,
    maxWidth: 280,
    bar: [restart],
    exit: quit,
    keys: dpad(false),
  },
  pong: {
    title: L("Pong", "Pong"),
    columns: "1fr 1fr",
    areas: ["left right"],
    rowHeight: 64,
    maxWidth: 380,
    bar: [restart],
    exit: quit,
    keys: [
      arrow("Left", { repeat: true, main: true }),
      arrow("Right", { repeat: true, main: true }),
    ],
  },
  calc: {
    title: L("Hesap makinesi", "Calculator"),
    columns: "1fr 1fr 1fr 8px 1fr 1fr",
    areas: [". up . . back eq", "left down right . ok ok"],
    rowHeight: 48,
    maxWidth: 380,
    bar: [
      keyboardKey,
      { area: "clear", key: "c", code: "KeyC", label: "C", aria: L("Temizle", "Clear") },
    ],
    exit: quit,
    keys: [
      ...dpad(true),
      { area: "ok", key: "Enter", code: "Enter", label: L("Bas", "Press"), aria: L("Seçili tuşa bas", "Press the highlighted key"), main: true },
      { area: "eq", key: "=", label: "=", aria: L("Hesapla", "Evaluate") },
      { area: "back", key: "Backspace", code: "Backspace", label: "⌫", aria: L("Sil", "Delete"), repeat: true },
    ],
  },
  solitaire: {
    title: L("Solitaire", "Solitaire"),
    columns: "repeat(7, 1fr)",
    areas: [
      "p1 p2 p3 p4 p5 p6 p7",
      "draw draw waste waste found found found",
    ],
    rowHeight: 46,
    maxWidth: 440,
    bar: [
      { area: "clear", key: "x", code: "KeyX", label: L("Bırak", "Clear"), aria: L("Seçimi bırak", "Clear the selection") },
      restart,
    ],
    exit: quit,
    keys: [
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({
        area: `p${n}`,
        key: String(n),
        code: `Digit${n}`,
        label: String(n),
        aria: L(`${n}. sütun`, `Pile ${n}`),
      })),
      { area: "draw", key: "d", code: "KeyD", label: L("Kart çek", "Draw"), aria: L("Desteden kart çek", "Draw from the stock"), main: true, small: true },
      { area: "waste", key: "w", code: "KeyW", label: L("Açık kart", "Waste"), aria: L("Açık kartı seç", "Select the waste card"), small: true },
      { area: "found", key: "f", code: "KeyF", label: L("Temele koy", "To base"), aria: L("Seçili kartı temele koy", "Move to a foundation"), small: true },
    ],
  },
  audio: {
    title: L("Müzik", "Music"),
    columns: "1fr 1fr 1.6fr 1fr 1fr",
    areas: ["prev rew play fwd next"],
    rowHeight: 52,
    maxWidth: 380,
    exit: quit,
    keys: transport("track"),
  },
  video: {
    title: L("Video", "Video"),
    columns: "1fr 1fr 1.6fr 1fr 1fr",
    areas: ["prev rew play fwd next"],
    rowHeight: 52,
    maxWidth: 380,
    exit: quit,
    keys: transport("video"),
  },
  image: {
    title: L("Görüntü", "Image"),
    columns: "1.4fr 1fr 1fr 1fr 1.4fr",
    areas: ["prev out reset in next"],
    rowHeight: 52,
    maxWidth: 380,
    exit: quit,
    keys: [
      { area: "prev", key: "ArrowLeft", code: "ArrowLeft", label: "◀", aria: L("Önceki görsel", "Previous image"), main: true },
      { area: "out", key: "-", code: "Minus", label: "−", aria: L("Uzaklaştır", "Zoom out"), repeat: true },
      { area: "reset", key: "0", code: "Digit0", label: "1:1", aria: L("Yakınlığı sıfırla", "Reset zoom"), small: true },
      { area: "in", key: "+", code: "Equal", label: "+", aria: L("Yakınlaştır", "Zoom in"), repeat: true },
      { area: "next", key: "ArrowRight", code: "ArrowRight", label: "▶", aria: L("Sonraki görsel", "Next image"), main: true },
    ],
  },
  editor: {
    title: L("Editör", "Editor"),
    columns: "repeat(5, 1fr)",
    areas: ["kbd up tab save cmd", "left down right help help"],
    rowHeight: 46,
    maxWidth: 400,
    exit: {
      area: "exit",
      key: "q",
      code: "KeyQ",
      ctrlKey: true,
      label: L("✕ Çık", "✕ Quit"),
      aria: L("Editörden çık (Ctrl+Q)", "Quit the editor (Ctrl+Q)"),
    },
    keys: [
      ...dpad(true),
      keyboardKey,
      { area: "tab", key: "Tab", code: "Tab", label: "Tab", aria: L("Girinti", "Indent"), small: true },
      { area: "save", key: "s", code: "KeyS", ctrlKey: true, label: L("Kaydet", "Save"), aria: L("Kaydet (Ctrl+S)", "Save (Ctrl+S)"), main: true, small: true },
      { area: "cmd", key: ":", label: ":", aria: L("Komut satırı", "Command line") },
      { area: "help", key: "g", code: "KeyG", ctrlKey: true, label: L("Yardım", "Help"), aria: L("Kısayollar (Ctrl+G)", "Shortcuts (Ctrl+G)"), small: true },
    ],
  },
};

export function getVirtualLayout(app: TerminalAppId | null): VirtualLayout | null {
  return app ? VIRTUAL_LAYOUTS[app] : null;
}

export function localize(text: string | Localized, language: "tr" | "en"): string {
  return typeof text === "string" ? text : text[language];
}
