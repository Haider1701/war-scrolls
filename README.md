# Ember Chronicle

Build a full-stack D&D Character Journal web app with a dark fiery War Cleric aesthetic. Here are all the requirements:

---

## TECH STACK

- React + TypeScript frontend

- Supabase for database (auth + storage + postgres)

- Tailwind CSS for styling

- No UI component library — custom styled everything

- Google Fonts: "Uncial Antiqua" (headings), "IM Fell English" (body text)

---

## THEME & VIBE

Dark fantasy journal. Color palette:

- Background: #100b03 (near-black coal)

- Page surface: #1b1205 to #241808 gradient  

- Ember orange accent: #ff6a00

- Flame gold: #ffb830 / #ffd060

- Ink text: #f0d8a8

- Muted text: #7a5a30

- Blood red (HP/danger): #c43030

- Glowing fire effects via CSS box-shadow and radial gradients

- Floating ember particle animations (small orange dots rising upward)

- Spine effect on left edge of every page (dark strip + orange border)

---

## AUTH

- Simple email/password login via Supabase Auth

- One user = one character journal (or multiple characters per user)

- No social login needed

---

## DATABASE SCHEMA (Supabase)

Table: characters

- id, user_id, created_at

- name (text)

- subtitle (text) — e.g. "Knight of the Wasting Light · Servant of Torm"

- class_level (text) — e.g. "War Cleric 1"

- race (text)

- alignment (text)

- background (text)

- proficiency_bonus (int)

- passive_perception (int)

- affliction_note (text) — special flavor banner text

- image_url (text) — Supabase Storage URL

Table: ability_scores

- id, character_id

- strength, dexterity, constitution, intelligence, wisdom, charisma (all int)

Table: skills

- id, character_id

- name (text), modifier (int), proficient (boolean)

Table: attacks

- id, character_id

- weapon_name (text), attack_bonus (text), damage_dice (text), damage_type (text)

Table: spells

- id, character_id

- spell_level (int — 0 = cantrip)

- name, school, casting_time, range, components, duration, description, upcast_note (all text)

Table: spell_meta

- id, character_id

- spellcasting_ability (text)

- spell_save_dc (int)

- spell_attack_bonus (int)

- slot_counts (jsonb) — e.g. {"1": 2, "2": 0, "3": 0}

Table: sessions

- id, character_id, created_at

- session_number (int)

- title (text)

- date_played (text)

- notes (text[]) — array of note lines

- encounter_notes (text)

Table: npcs

- id, character_id

- name (text), role (text), description (text)

- disposition (text) — "ally" | "neutral" | "hostile" | "missing"

- emoji_icon (text)

Table: equipment

- id, character_id

- name (text), emoji_icon (text), quantity (int)

Table: currency

- id, character_id

- cp, sp, ep, gp, pp (all int)

Table: traits

- id, character_id

- personality (text), ideal (text), bond (text), flaw (text)

Table: free_notes

- id, character_id

- content (text) — rich text / markdown

---

## PAGES / TABS

The app has a tabbed journal layout. Each tab = one "page" of the journal. Left edge always shows a spine (dark strip with ember glow).

### Tab 1 — COVER

- Upload area for character image (drag & drop or click, uploads to Supabase Storage, stores URL)

- Image displays full-width with fire vignette overlay (gradient from bottom)

- Character name in large Uncial Antiqua font with gold glow

- Subtitle line in italic IM Fell English

- 3-column grid of detail boxes: Class/Level, Race, Alignment, Background, Proficiency Bonus, Passive Perception

- Affliction banner at bottom (red-bordered italic warning text, editable)

- All fields editable inline or via a sidebar edit panel

### Tab 2 — STATS

- HP row: large flickering blood-red HP number + animated bar + AC and Speed displayed inline

- 3x2 grid of ability score boxes (STR DEX CON INT WIS CHA) — each shows emoji, modifier (large), raw score (small)

- Attacks table: weapon name, attack bonus, damage dice, damage type — add/remove rows

- Skills list: 2-column grid, each row has proficiency dot (orange glow if proficient), modifier, emoji + skill name

- Saving throws: same style as skills

- Proficiencies section: languages, armor, weapons, other tools

### Tab 3 — BACKSTORY

- Long-form text area for backstory (styled as handwritten journal text, justified, indented paragraphs)

- 4 trait cards in 2x2 grid: Personality, Ideal, Bond, Flaw — each colored differently (ember, gold, green, red border)

- Features & Feats section: add/remove cards with title + description

### Tab 4 — SPELLS

- Spell meta bar: Spellcasting Ability | Spell Save DC | Spell Attack Bonus | Slot counts

- Font sizes must be large and readable (spell name ~1.1rem, description ~0.95rem, tier headers ~1rem)

- Cantrips section header, then 1st level section header, etc.

- Each spell card: name (gold), school/type (italic muted), casting time/range/components/duration (small meta), description (readable body text)

- Add spell button opens a modal/form to fill all spell fields

- Slot tracker: clickable circles per level (fill orange when used, click to toggle)

### Tab 5 — SESSIONS

- List of session blocks, each with: session number badge, editable title, date played

- Each session has 5 editable log lines (bullet points with fire emoji prefix)

- Blank encounter notes area (lined)

- "Add New Session" button at bottom

- Sessions saved to DB, persist across visits

### Tab 6 — NPCs & GEAR

- NPC cards: emoji avatar, name, role, description, disposition badge (colored: ally=green, neutral=gold, hostile=red, missing=dark red)

- Add/remove NPC button

- Equipment grid: 2 columns, each item has emoji + name + quantity

- Add/remove equipment

- Coin purse: 5 circular coin displays (CP SP EP GP PP) — GP highlighted in ember gold, all editable

- All saves to DB

### Tab 7 — NOTES

- Full-width lined page (CSS repeating gradient lines matching the theme)

- Rich text or markdown editor (use a lightweight one like react-simple-wysiwyg or just contenteditable with formatting toolbar)

- Auto-saves to DB with debounce

---

## EDIT MODE vs PREVIEW MODE

### Edit Mode (default)

- All fields are editable (contenteditable or input fields styled to match the journal)

- Add/remove buttons visible

- Save button in top right corner (saves all changes to Supabase)

- Small floating "Save" toast notification on success

### Preview Mode (toggle button — e.g. book icon in nav)

- All inputs become read-only

- Page TURN animation between tabs — CSS 3D flip like turning a real book page (rotateY transform, backface-visibility hidden, perspective on parent)

- The journal looks like a physical book being read

- No edit controls visible in preview mode

- Toggle back to Edit Mode with same button

---

## NAVIGATION

- Tab bar at top styled as angled journal tabs (clip-path polygon shape)

- Active tab highlighted with ember color + subtle glow + fire underline bar

- On mobile: tabs scroll horizontally

---

## CHARACTER CREATION FLOW

- On first login (no character exists): show a "Create Your Character" wizard

- Step 1: Name, subtitle, class/level, race, alignment, background

- Step 2: Ability scores (input 6 numbers, modifiers auto-calculate)

- Step 3: Upload character image

- Step 4: Review & Save

- After creation, lands on full journal

---

## GENERAL UI RULES

- Never use plain dashes as separators — use styled dividers or spacing

- No broken/orphaned symbols in empty states

- Empty fields show placeholder text in muted style, not raw dashes

- All icons use emoji (no icon libraries needed)

- Hover states on all interactive elements (subtle ember glow)

- Smooth transitions on all state changes (0.2s ease)

- Font sizes must be large enough to read comfortably — minimum 0.85rem for body, 1.0rem+ for spell descriptions

- The entire app should feel like a handcrafted leather journal enchanted with divine fire

---

## SAMPLE DATA (pre-fill for dev/demo)

Character: Sir Johnathen Frenzball

Class: War Domain Cleric 1

Race: Human (Variant)

Alignment: Lawful Good

Background: Noble

STR 16 (+3), DEX 8 (−1), CON 14 (+2), INT 8 (−1), WIS 16 (+3), CHA 12 (+1)

HP: 10, AC: 18, Speed: 30 ft

Proficiency Bonus: +2, Passive Perception: 13

Cantrips: Light, Thaumaturgy, Spare the Dying

Level 1 Spells (2 slots): Bless, Guiding Bolt, Command, Healing Word

GP: 25

Retainers: Larstin (gnome cook), Nitsaril (gnome violinist), Tomgrol (dwarf armorer — missing)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://war-scrolls.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a3d6a824-05eb-47e1-b6fc-b8c53439ea0a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
