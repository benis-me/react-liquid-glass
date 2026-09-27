// CJK glyph subsets add ~100 KB of @font-face rules; load them only for the Chinese interface.
let chinese: Promise<unknown> | undefined;
export const loadChineseFont = () => (chinese ??= import("@fontsource-variable/noto-sans-sc"));
