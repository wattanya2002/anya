# Design tokens used (calibrated against MASTER_UI_REFERENCE.png)

Values sampled from the master image and tuned by side-by-side screenshots at 1448×1086 CSS px. They are not claimed to be pixel-exact (the master is a rendered image).

| Token | Value | Source / note |
|---|---|---|
| Page glow | radial `#bee4fa` left, `#cdecfc` top-left, `#e8eaf6` bottom-right over `#e3f2fb → #f1f2f8` | master edge samples `#d1eefc`, `#cbe8f8`, `#eef1f8` |
| Frame | `rgba(236,244,251,.72)`, radius 40, white 1px edge, very soft 80px shadow | master outer frame `#e3f0f9` |
| Content panel | `rgba(249,250,253,.86)`, radius 40 | master `#f3f2f8`–`#f7f5f8` |
| Card | `rgba(255,255,255,.84)`, edge `rgba(255,255,255,.9)`, blur 18px, radius 24 | master card `#fcfbff` |
| Card shadow | `0 12px 34px rgba(80,104,150,.075), 0 2px 8px rgba(80,100,140,.035)` | diffuse, no hard edge |
| Ink / muted | `#1f2230` / `#8b8d98` | |
| Pink accent | `#f0699a`, strong `#e45b8c`, greeting ink `#d65a89`, soft `#fdeef4` | master rail `#f784a3`, checkbox `#ea6793`, dot `#fe669f` |
| Rail active | gradient `#fa8fae → #f0709c`, 55px circle, pink glow shadow | |
| Positive delta | text `#3f9a57` on `#e5f8e9` | master `#4c965b` on `#e7fceb` |
| Donut | pink `#f8a9c8`, blue `#c4e4fb`, purple `#dccff0` | master `#ffc9e0`, `#c7e7fe`, `#d4c7e5` |
| Font | Noto Sans Thai Looped 400–700 (Latin + Thai) | looped Thai matches the master |
| Sizes (PC) | hero title 27, KPI value 29, panel title 19, body 15–16, captions 13–14 | inputs always ≥16px (iOS) |
| Layout (PC ≥1280) | rail 79px; KPI 4 × 1fr; panels 1.1 : 1 : 1.03; lower 463 : 793 | master geometry |
| iPad 768–1279 | rail kept; KPI 2×2; panels 2-col (≥1024) or 1-col; tiles 2-col (<1024) | |
| iPhone <768 | no rail; bottom nav (Home, Marketing, Content, Inventory, More) with safe-area padding; KPI 2×2; single column | |
