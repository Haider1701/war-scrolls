import { useState } from "react";
import type { CodexData } from "@/lib/codexData";
import { toEntries } from "@/lib/codexData";
import { abilityMod, fmtMod, formatMulticlass, totalLevel, type Abilities } from "@/lib/types";
import { Chapter, Emblem, Line, Medallion, Panel, Prose, Rule, Stat } from "./Ornaments";

const ABIL: { key: keyof Abilities; label: string; short: string }[] = [
  { key: "strength", label: "Strength", short: "STR" },
  { key: "dexterity", label: "Dexterity", short: "DEX" },
  { key: "constitution", label: "Constitution", short: "CON" },
  { key: "intelligence", label: "Intelligence", short: "INT" },
  { key: "wisdom", label: "Wisdom", short: "WIS" },
  { key: "charisma", label: "Charisma", short: "CHA" },
];

const CLASS_GLYPHS: [RegExp, string][] = [
  [/cleric|priest/i, "✝"], [/wizard|mage|sorcer/i, "✶"], [/rogue|thief|assassin/i, "⚔"],
  [/fighter|knight|warrior/i, "⚔"], [/paladin/i, "⚜"], [/ranger|hunter/i, "➶"],
  [/druid/i, "❀"], [/bard/i, "♫"], [/monk/i, "☯"], [/warlock/i, "☾"], [/barbarian/i, "⛨"],
];
function classGlyph(cls?: string | null) {
  for (const [re, g] of CLASS_GLYPHS) if (cls && re.test(cls)) return g;
  return "❖";
}

/* ---------------- Page 1 — Cover ---------------- */
export function CoverPage({ d }: { d: CodexData }) {
  const c = d.character;
  const lvl = totalLevel(c);
  return (
    <div className="cdx-cover">
      <div className="cdx-cover-frame">
        <p className="cdx-eyebrow">A Chronicle of</p>
        <h1 className="cdx-cover-title">{c.name || "Unnamed Wanderer"}</h1>
        <Emblem glyph={classGlyph(c.class_level)} />
        <p className="cdx-cover-class">{formatMulticlass(c.class_level, c.class_level_2) || "Adventurer"}</p>
        <Rule label="✦" />
        <div className="cdx-cover-grid">
          <Stat label="Level" value={lvl || "—"} />
          <Stat label="Race" value={c.race || "—"} />
          <Stat label="Background" value={c.background || "—"} />
          <Stat label="Alignment" value={c.alignment || "—"} />
          <Stat label="Campaign" value={c.campaign_name || "—"} />
          <Stat label="Player" value={c.player_name || "—"} />
        </div>
        <p className="cdx-cover-foot">Volume I · The Codex of Deeds</p>
      </div>
    </div>
  );
}

/* ---------------- Page 2 — Portrait ---------------- */
export function PortraitPage({ d }: { d: CodexData }) {
  const c = d.character;
  const hero = d.images.find((i) => i.is_primary)?.image_url || c.image_url || d.images[0]?.image_url || "";
  return (
    <div>
      <Chapter eyebrow="Chapter I" title="The Protagonist" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <figure className="cdx-portrait">
          {hero ? (
            <img src={hero} alt={`Portrait of ${c.name || "the character"}`} loading="lazy" />
          ) : (
            <div className="cdx-portrait-empty">No portrait bound to this tome yet.</div>
          )}
        </figure>
        <div className="flex flex-col gap-4 min-w-0">
          <Panel accent>
            <blockquote className="cdx-quote">
              {(c.character_quote || c.subtitle || "“Every scar is a chapter.”").replace(/^"|"$/g, "")}
            </blockquote>
          </Panel>
          <Panel title="Manifest">
            <Line k="Race" v={c.race} />
            <Line k="Class" v={formatMulticlass(c.class_level, c.class_level_2)} />
            <Line k="Level" v={totalLevel(c) || "—"} />
            <Line k="Alignment" v={c.alignment} />
            <Line k="Background" v={c.background} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page 3 — Overview ---------------- */
export function OverviewPage({ d }: { d: CodexData }) {
  const c = d.character;
  const saves = d.skills.filter((s) => s.kind === "save");
  const skills = d.skills.filter((s) => s.kind !== "save");
  return (
    <div>
      <Chapter eyebrow="Chapter II" title="Character Overview" />

      <div className="cdx-medallion-row">
        <Medallion label="Armor Class" value={c.armor_class ?? "—"} />
        <Medallion label="Initiative" value={fmtMod(c.initiative ?? 0)} />
        <Medallion label="Speed" value={`${c.speed ?? 0} ft`} />
        <Medallion label="Hit Points" value={`${c.hp_current ?? 0}/${c.hp_max ?? 0}`} sub={c.hit_dice || undefined} />
        <Medallion label="Proficiency" value={fmtMod(c.proficiency_bonus ?? 2)} />
        <Medallion label="Passive Perception" value={c.passive_perception ?? "—"} />
      </div>

      <Rule />

      <div className="cdx-ability-row">
        {ABIL.map((a) => {
          const score = (d.abilities?.[a.key] as number) ?? 10;
          return (
            <div key={a.key} className="cdx-ability">
              <span className="cdx-ability-name">{a.short}</span>
              <span className="cdx-ability-score">{score}</span>
              <span className="cdx-ability-mod">{fmtMod(abilityMod(score))}</span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Panel title="Saving Throws">
          {saves.length === 0 ? <p className="cdx-empty">Unrecorded.</p> : saves.map((s) => (
            <Line key={s.id} k={`${s.proficient ? "◆" : "◇"} ${s.name}`} v={fmtMod(s.modifier ?? 0)} />
          ))}
        </Panel>
        <Panel title="Skill Proficiencies">
          {skills.length === 0 ? <p className="cdx-empty">Unrecorded.</p> : skills.map((s) => (
            <Line key={s.id} k={`${s.proficient ? "◆" : "◇"} ${s.name}`} v={fmtMod(s.modifier ?? 0)} />
          ))}
        </Panel>
      </div>

      <Panel title="Death Saves" className="mt-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="cdx-stat-label">Successes</div>
            <div className="flex gap-2 mt-1">
              {[0, 1, 2].map((i) => <span key={i} className={`cdx-pip ${i < (c.death_save_successes ?? 0) ? "on" : ""}`} />)}
            </div>
          </div>
          <div>
            <div className="cdx-stat-label">Failures</div>
            <div className="flex gap-2 mt-1">
              {[0, 1, 2].map((i) => <span key={i} className={`cdx-pip fail ${i < (c.death_save_failures ?? 0) ? "on" : ""}`} />)}
            </div>
          </div>
        </div>
        {c.affliction_note ? <p className="cdx-affliction mt-3">{c.affliction_note}</p> : null}
      </Panel>
    </div>
  );
}

/* ---------------- Page 4 — Combat ---------------- */
export function CombatPage({ d }: { d: CodexData }) {
  const c = d.character;
  return (
    <div>
      <Chapter eyebrow="Chapter III" title="The Art of War" />
      <div className="cdx-medallion-row">
        <Medallion label="Armor Class" value={c.armor_class ?? "—"} />
        <Medallion label="Initiative" value={fmtMod(c.initiative ?? 0)} />
        <Medallion label="Spell Save DC" value={d.spellMeta?.spell_save_dc || "—"} />
        <Medallion label="Spell Attack" value={d.spellMeta ? fmtMod(d.spellMeta.spell_attack_bonus ?? 0) : "—"} />
      </div>

      <Rule label="⚔" />

      <div className="grid gap-4 md:grid-cols-2">
        {d.attacks.length === 0 ? (
          <p className="cdx-empty">No weapons inscribed.</p>
        ) : d.attacks.map((a) => (
          <article key={a.id} className="cdx-weapon">
            <h4 className="cdx-weapon-name">{a.weapon_name || "Unnamed Arm"}</h4>
            <div className="cdx-weapon-stats">
              <span><em>To hit</em> {a.attack_bonus || "—"}</span>
              <span><em>Damage</em> {a.damage_dice || "—"}</span>
              <span><em>Type</em> {a.damage_type || "—"}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Panel title="Armor & Defenses">
          <Prose text={c.armor_notes || c.armor_prof} empty="No armor noted." />
        </Panel>
        <Panel title="Combat Notes">
          <Prose text={c.combat_notes} empty="No tactics recorded." />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Page 5 — Inventory ---------------- */
export function InventoryPage({ d }: { d: CodexData }) {
  const c = d.character;
  const money = d.currency;
  const coins: { k: string; label: string; v: number }[] = [
    { k: "pp", label: "Platinum", v: money?.pp ?? 0 },
    { k: "gp", label: "Gold", v: money?.gp ?? 0 },
    { k: "ep", label: "Electrum", v: money?.ep ?? 0 },
    { k: "sp", label: "Silver", v: money?.sp ?? 0 },
    { k: "cp", label: "Copper", v: money?.cp ?? 0 },
  ];
  return (
    <div>
      <Chapter eyebrow="Chapter IV" title="Pack & Treasure" />
      <div className="cdx-coin-row">
        {coins.map((c2) => (
          <div key={c2.k} className={`cdx-coin cdx-coin-${c2.k}`}>
            <span className="cdx-coin-v">{c2.v}</span>
            <span className="cdx-coin-l">{c2.label}</span>
          </div>
        ))}
      </div>
      <Rule label="⚱" />
      <Panel title="Carried Equipment">
        {d.equipment.length === 0 ? <p className="cdx-empty">The pack is empty.</p> : (
          <ul className="cdx-item-grid">
            {d.equipment.map((e) => (
              <li key={e.id} className="cdx-item">
                <span className="cdx-item-name">{e.emoji_icon ? `${e.emoji_icon} ` : ""}{e.name}</span>
                {e.quantity > 1 ? <span className="cdx-item-qty">×{e.quantity}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <Panel title="Backpack"><Prose text={c.backpack} empty="Nothing stowed." /></Panel>
        <Panel title="Magic Items" accent><Prose text={c.magic_items} empty="No wonders yet." /></Panel>
        <Panel title="Consumables"><Prose text={c.consumables} empty="No potions or scrolls." /></Panel>
      </div>
    </div>
  );
}

/* ---------------- Page 6 — Features & Traits ---------------- */
export function FeaturesPage({ d }: { d: CodexData }) {
  const c = d.character;
  return (
    <div>
      <Chapter eyebrow="Chapter V" title="Features & Traits" />
      <Panel title="Class Features">
        {(c.features ?? []).length === 0 ? <p className="cdx-empty">No features recorded.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {(c.features ?? []).map((f, i) => (
              <article key={i} className="cdx-feature">
                <h4 className="cdx-feature-title">{f.title}</h4>
                <p>{f.description}</p>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Panel title="Racial Traits"><Prose text={c.racial_traits} empty="None inscribed." /></Panel>
        <Panel title="Feats"><Prose text={c.feats} empty="None taken." /></Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <Panel title="Languages">
          {toEntries(c.languages).length === 0 ? <p className="cdx-empty">Common tongue only.</p> : (
            <ul className="cdx-tags">{toEntries(c.languages).map((l, i) => <li key={i}>{l}</li>)}</ul>
          )}
        </Panel>
        <Panel title="Tool Proficiencies">
          {toEntries(c.tools_prof).length === 0 ? <p className="cdx-empty">None.</p> : (
            <ul className="cdx-tags">{toEntries(c.tools_prof).map((l, i) => <li key={i}>{l}</li>)}</ul>
          )}
        </Panel>
        <Panel title="Weapon & Armor Training">
          <Prose text={[c.weapons_prof, c.armor_prof].filter(Boolean).join("\n")} empty="Untrained." />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Page 7 — Spellbook ---------------- */
export function SpellbookPage({ d }: { d: CodexData }) {
  const byLevel = new Map<number, typeof d.spells>();
  d.spells.forEach((s) => {
    const arr = byLevel.get(s.spell_level) ?? [];
    arr.push(s);
    byLevel.set(s.spell_level, arr);
  });
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const meta = d.spellMeta;
  return (
    <div>
      <Chapter eyebrow="Chapter VI" title="The Spellbook" />
      <div className="cdx-medallion-row">
        <Medallion label="Ability" value={meta?.spellcasting_ability || "—"} />
        <Medallion label="Save DC" value={meta?.spell_save_dc || "—"} />
        <Medallion label="Attack" value={meta ? fmtMod(meta.spell_attack_bonus ?? 0) : "—"} />
      </div>
      {meta?.slot_counts ? (
        <Panel title="Spell Slots" className="mt-4">
          <div className="flex flex-wrap gap-4">
            {Object.entries(meta.slot_counts).filter(([, n]) => Number(n) > 0).map(([lv, n]) => (
              <div key={lv} className="text-center">
                <div className="cdx-stat-label">Level {lv}</div>
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: Number(n) }).map((_, i) => (
                    <span key={i} className={`cdx-pip ${i < Number(meta.slots_used?.[lv] ?? 0) ? "on" : ""}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Rule label="✶" />

      {levels.length === 0 ? <p className="cdx-empty">This character weaves no magic.</p> : levels.map((lv) => (
        <section key={lv} className="mb-6">
          <h3 className="cdx-spell-level">{lv === 0 ? "Cantrips" : `Level ${lv} Spells`}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {(byLevel.get(lv) ?? []).map((s) => (
              <article key={s.id} className="cdx-spell">
                <h4 className="cdx-spell-name">{s.name || "Unnamed Rite"}</h4>
                <p className="cdx-spell-meta">
                  {[s.school, s.casting_time, s.range, s.components, s.duration].filter(Boolean).join(" · ") || "Details unrecorded"}
                </p>
                {s.description ? <p className="cdx-spell-desc">{s.description}</p> : null}
                {s.upcast_note ? <p className="cdx-spell-upcast">At Higher Levels: {s.upcast_note}</p> : null}
                {s.is_homebrew ? <span className="cdx-badge">Homebrew{s.gm_approved ? " · approved" : s.gm_denied ? " · denied" : " · pending"}</span> : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Page 8 — Story ---------------- */
export function StoryPage({ d }: { d: CodexData }) {
  const c = d.character;
  const t = d.traits;
  return (
    <div>
      <Chapter eyebrow="Chapter VII" title="The Character's Story" />
      <Panel accent>
        <div className="cdx-storybook">
          <Prose text={c.backstory} empty="The tale is yet unwritten." />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Panel title="Personality Traits"><Prose text={t?.personality} empty="—" /></Panel>
        <Panel title="Ideals"><Prose text={t?.ideal} empty="—" /></Panel>
        <Panel title="Bonds"><Prose text={t?.bond} empty="—" /></Panel>
        <Panel title="Flaws"><Prose text={t?.flaw} empty="—" /></Panel>
      </div>
      <Panel title="Goals & Ambitions" className="mt-4">
        <Prose text={c.goals} empty="No stated ambitions." />
      </Panel>
    </div>
  );
}

/* ---------------- Page 9 — Gallery & Summary ---------------- */
export function GalleryPage({ d }: { d: CodexData }) {
  const c = d.character;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const companions = d.npcs.filter((n) => /companion|familiar|pet|mount/i.test(n.role || ""));
  return (
    <div>
      <Chapter eyebrow="Epilogue" title="Gallery & Summary" />
      {d.images.length === 0 ? <p className="cdx-empty">No artwork bound to this volume.</p> : (
        <div className="cdx-gallery">
          {d.images.map((img) => (
            <button key={img.id} className="cdx-gallery-frame" onClick={() => setLightbox(img.image_url)}>
              <img src={img.image_url} alt={`${c.name || "Character"} artwork`} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {companions.length > 0 && (
        <Panel title="Companions & Familiars" className="mt-4">
          <ul className="cdx-tags">{companions.map((n) => <li key={n.id}>{n.name}{n.role ? ` — ${n.role}` : ""}</li>)}</ul>
        </Panel>
      )}

      <Rule label="✦" />

      <Panel title="Summary" accent>
        <div className="grid gap-x-8 md:grid-cols-2">
          <Line k="Name" v={c.name} />
          <Line k="Race" v={c.race} />
          <Line k="Class" v={formatMulticlass(c.class_level, c.class_level_2)} />
          <Line k="Level" v={totalLevel(c) || "—"} />
          <Line k="Campaign" v={c.campaign_name} />
          <Line k="Player" v={c.player_name} />
        </div>
        <Rule />
        <Prose text={c.subtitle || c.character_quote} empty="A story still unfolding." />
        {c.important_notes ? (
          <>
            <h4 className="cdx-panel-title mt-4">Important Notes</h4>
            <Prose text={c.important_notes} />
          </>
        ) : null}
      </Panel>

      <p className="cdx-ending">Here ends the codex of {c.name || "an unnamed hero"} — until the next dawn.</p>

      {lightbox && (
        <div className="cdx-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Artwork viewer">
          <img src={lightbox} alt="Character artwork enlarged" />
        </div>
      )}
    </div>
  );
}
