---
name: Rolê
description: Every rolê is a cartridge you plug into a Game Boy Color era console.
colors:
  berry: "#ff3d8b"
  grape: "#6c3ce0"
  kiwi: "#8fd42a"
  sun: "#ffd23f"
  teal: "#13b3c4"
  ink: "#000000"
  shell: "#ffffff"
  shell-2: "#f3eefe"
  muted: "#4f4670"
  label-muted: "#3b3355"
  shell-night: "#241452"
  shell-2-night: "#33206e"
  muted-night: "#d4c9ff"
typography:
  display:
    fontFamily: "Anybody, 'Arial Narrow', sans-serif"
    fontSize: "clamp(56px, 7vw, 84px)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 150"
  headline:
    fontFamily: "Anybody, 'Arial Narrow', sans-serif"
    fontSize: "clamp(26px, 3vw, 32px)"
    fontWeight: 850
    lineHeight: 1.02
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Anybody, 'Arial Narrow', sans-serif"
    fontSize: "22px"
    fontWeight: 850
    lineHeight: 1.05
    fontVariation: "'wdth' 125"
  button:
    fontFamily: "Anybody, 'Arial Narrow', sans-serif"
    fontSize: "15px"
    fontWeight: 800
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
  chip:
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
rounded:
  label: "6px"
  cart: "10px"
  control: "12px"
  sheet: "16px"
  panel: "22px"
  panel-notch: "56px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  panel: "26px"
components:
  button-primary:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-big:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "56px"
    width: "100%"
  button-default:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-icon:
    rounded: "{rounded.control}"
    size: "48px"
  button-link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0 6px"
    height: "40px"
  input-field:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "52px"
  segment-selected:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
  chip:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  chip-live:
    backgroundColor: "{colors.kiwi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  console-panel:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "26px 26px 30px"
    width: "min(440px, 100%)"
  cartridge:
    backgroundColor: "{colors.grape}"
    rounded: "{rounded.cart}"
    padding: "20px 10px 10px"
  cartridge-label:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
  toast:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
---

# Design System: Rolê

## Overview

**Creative North Star: "The Cartridge Console"**

The interface is the body of a Game Boy Color era handheld laid over a living pixel-art room. Panels are the console shell, each rolê and each place is a cartridge, and every button is a physical key that sinks when pressed. Structure is neo-brutalist (pure black 3px outlines, hard offset shadows, flat fills) and colour is spent on key points: berry for the action that moves you forward, sun for selection and system voice, kiwi for live.

Density is low and thumb-sized. One console panel sits over the scene (left on desktop, bottom sheet on mobile); in the room the UI shrinks to a top chip strip, a right column of keys and a bottom chat dock, so the pixel world stays the hero. Pixel lives in the world canvas and in a hand-drawn 10x10 pixel icon set, never in type: titles are wide, heavy Anybody, body copy is Atkinson Hyperlegible Next.

The shell follows the scene's clock: white bodies by day, deep grape bodies by night. Outlines, shadows and the accent palette never change.

**Key Characteristics:**
- 3px pure black outlines on every interactive or containing surface.
- Hard, unblurred offset shadows that collapse to zero on press.
- Cartridge silhouette: grip ridges on top, notched top-right corner, white label carrying scene art.
- Day/night shell swap driven by the scene, not by OS preference.
- Wide display type (Anybody, 112 to 150% width) against a hyperlegible body face.
- Pixel-grid SVG icons rendered crisp, inheriting text colour.

## Colors

Saturated handheld-shell colours on a white or grape body, bound by black.

### Primary
- **Berry** (berry): the forward action. Full-width primary buttons, the selected wardrobe tab, the event-name chip, the wordmark fill, the steps indicator and range accent. Text on berry is always black.

### Secondary
- **Sun** (sun): selection and system voice. Selected segments and options, focus rings, toasts, error and info banners, system chat lines, the wardrobe header, text selection.
- **Kiwi** (kiwi): live and on. The "Ao vivo" chip, pressed toggles in the room HUD, the wardrobe stage floor, the SMS icon tile.

### Tertiary
- **Grape** (grape): default cartridge shell and night chip.
- **Teal** (teal): wardrobe stage backdrop only.
- Cartridge shells take a per-scene colour (`--cc`, mapped per place in app.js); grape is the fallback.

### Neutral
- **Ink** (ink): every outline, every shadow, all text on coloured fills.
- **Shell / Shell 2** (shell, shell-2): day panel body and its recessed tier (inactive segments, wardrobe rail, step pips).
- **Shell Night / Shell 2 Night** (shell-night, shell-2-night): the same two tiers by night; shell-night is also the page background behind the canvas.
- **Muted / Muted Night** (muted, muted-night): secondary copy on the panel body, swapped with the shell.
- **Label Muted** (label-muted): secondary copy on always-white surfaces (cartridge labels, SMS), which do not flip at night.

### Named Rules
**The Black-On-Colour Rule.** Text on berry, sun, kiwi and white labels is pure black. White text appears only on grape and night shells.

**The Clock Rule.** Only `--shell`, `--shell-2`, `--text` and `--muted` change between day and night (`body[data-time]`). Cartridge labels, chips, fields, toasts and the SMS stay white or coloured in both.

## Typography

**Display Font:** Anybody (with Arial Narrow, sans-serif)
**Body Font:** Atkinson Hyperlegible Next (with system-ui, sans-serif)

**Character:** A wide, black-weight 2000s game-box face for anything you read as a name or a key, against a calm, unambiguous body face for everything you read as sentences.

### Hierarchy
- **Display** (900, 150% width, clamp 56–84px, 0.82): the Rolê wordmark only, berry with a 2px ink stroke and 4px hard text shadow. Small variant 30px.
- **Headline** (850, 125% width, clamp 26–32px, 1.02, balanced): panel questions ("Qual é o rolê?").
- **Title** (850, 118–130% width, 15–22px): cartridge names, section titles, wardrobe header, profile name (30px).
- **Button** (Anybody 800, 112% width, 15px; 17px on big buttons): all key labels and segments.
- **Body** (400, 16px, 1.45): copy; inputs at 17px.
- **Label** (800, 15px): form labels; chips at 13px/800.

### Named Rules
**The Pixel-Lives-In-The-World Rule.** No pixel or bitmap font in UI type. Pixel appears in the canvas and the icon set only.

**The Width-Is-Rank Rule.** Anybody's width axis encodes importance: 150% wordmark, 125% headlines, 112–118% keys and card names. Body face never stretches.

## Layout

Full-bleed canvas (`position:fixed; inset:0`) with UI floating above it. Screens place one console panel (440px, 620px wide variant) vertically centred on the left with `max(20px, 6vw)` side padding; at 760px and below it becomes a bottom-anchored sheet with 14px gutter. Panel content is a single column at 18px gap; forms at 14px; button rows at 10px.

The room HUD uses three anchored clusters: top-left chip strip, right key column (172px wide with labels on desktop, 48px icon-only squares on mobile), bottom-left chat dock (540px max). All edges respect `env(safe-area-inset-*)`. The wardrobe is a 470px right drawer (full width on mobile) with a 70px icon rail and a scrolling main column. Touch targets are 44px minimum, 48px for icon keys.

## Elevation & Depth

Depth is purely structural: flat fills, black outlines and hard offset shadows with zero blur, as if every surface were a moulded plastic part. Shadow length signals how far a part stands off the body, and pressing a key drives it flush.

### Shadow Vocabulary
- **Key** (`box-shadow: 4px 4px 0 #000`): buttons, cartridges, fields in the dock, toasts, SMS, stage.
- **Panel** (`box-shadow: 7px 7px 0 #000`): console panels and the insert-cartridge animation.
- **Hover lift** (`5px 5px 0 #000` with `translate(-1px,-1px)`): keys and place cartridges on hover.
- **Pressed** (`0 0 0 #000` with `translate(4px,4px)`): any key on `:active`.
- **Chosen** (`8px 8px 0 #000`, `translate(-3px,-3px)`, 4px sun outline): selected place cartridge.
- **Small** (`2px 2px 0` / `3px 3px 0`): chat bubbles, swatches, wardrobe options and rail tabs.
- **Drawer edge** (`-6px 0 0 #000`): wardrobe.

### Named Rules
**The Press-In Rule.** A raised key moves exactly the length of its shadow on press, and the shadow goes to zero. 80ms ease-out. No blur, ever.

## Shapes

Soft-cornered plastic: 12px on keys, fields and segments; 22px on panels with the bottom-right corner exaggerated (56px, 44px on mobile) like a handheld's grip, plus a diagonal speaker-grille hatch in that corner. Cartridges are 10px on top and 6px at the bottom, with a ridged grip strip across the top and a notched top-right corner cut through the outline. Chips are full pills. The wardrobe stage repeats the panel's exaggerated bottom-right corner (40px). Step pips and the live dot are square.

## Components

### Buttons
Chunky keys that physically sink.
- **Shape:** 12px corners, 3px ink outline, key shadow.
- **Primary:** berry, black text; `big` variant full width at 56px for the one forward action per panel.
- **Default / Sun:** shell body (flips at night) or sun for secondary positive actions (Copiar).
- **Icon:** 48px square with a 20px pixel icon; labelled keys hide text on mobile and become icon squares.
- **Hover / Active / Focus:** lift 1px with 5px shadow; press in fully; 3px sun outline offset 3px on focus-visible.
- **Link:** no box, body font 600, 2px underline offset 4px; for dismissive actions (Agora não, Voltar, Sair).
- **Toggle:** `aria-pressed="true"` turns kiwi in the room HUD.

### Chips
- **Style:** 2px ink outline, pill, white fill, 13px/800 black.
- **State:** live = kiwi with a blinking square dot (steps animation); name = berry; day = sun; night = grape with white text.

### Cards / Containers
- **Console panel:** shell body, 3px outline, 22px corners with the 56px grip corner and grille hatch, panel shadow, 26px padding, 18px internal gap.
- **Banners:** sun fill, 2px outline, 12px corners (info) or 10px (error), black 600–700 text.
- **Empty state:** 3px dashed ink outline, 14px corners, centred muted text.

### Inputs / Fields
- **Style:** white, 3px ink outline, 12px corners, 52px tall, 17px text, faint inset top shadow (`inset 0 3px 0 rgba(0,0,0,.08)`).
- **Focus:** outline removed, replaced by a 4px sun ring (`0 0 0 4px`).
- **Error:** sun banner beneath the form, not a red field.
- **Code entry:** Anybody 900 at 34px, 0.4em tracking, 68px tall.
- **Segments:** two-up grid of 46px keys on shell-2; selected turns sun with key shadow.

### Navigation
- **Wardrobe rail:** vertical 48px square tabs on shell-2, pixel icon per slot; selected = berry with 3px shadow; hover tooltip in black, hidden on mobile.
- **Room HUD:** right column of keys, top strip of chips; no persistent nav bar.

### Cartridge (signature)
Each rolê and each place is a cartridge: shell coloured by its scene (`--cc`), ridged grip strip, notched corner, white 2px-outlined label holding the scene thumbnail (6:5) and the name in title type. As a picker it behaves like a key (hover lift, chosen state with sun outline). Entering a room drops a 180x210 cartridge into a black slot and flashes the scene colour (420ms overshoot drop, 300ms flash), skipped under reduced motion.

### Pixel Icons
10x10 hand-drawn grids rendered as crisp SVG rects (`shape-rendering: crispEdges`, `fill: currentColor`), 18px default, 20px in icon keys and the rail. New icons must be drawn on the same 10x10 grid.

## Do's and Don'ts

### Do:
- **Do** outline every interactive and containing surface in 3px pure black; 2px only for nested parts (labels, chips, bubbles, options).
- **Do** use the hard offset shadow scale (4px keys, 7px panels) and collapse it on press with a matching translate.
- **Do** give each panel one berry forward action; use sun for selection, focus and system messages, kiwi for live/on.
- **Do** colour new cartridges from the scene map via `--cc`, keeping the white label and black text.
- **Do** keep text on colour black, and touch targets at 44px minimum (48px for icon keys).
- **Do** honour `prefers-reduced-motion`: no drawer slide, no blink, no key motion, no insert animation.

### Don't:
- **Don't** use blurred or tinted shadows, glass, or translucency on UI surfaces.
- **Don't** set UI type in a pixel or bitmap font; pixel belongs to the canvas and the icon grid.
- **Don't** use stroke-style line icons; icons are filled 10x10 pixel grids.
- **Don't** use warm dark panels or a dark glass HUD; night is the grape shell, not black glass.
- **Don't** let the panel or HUD cover the room's centre; UI anchors to edges.
