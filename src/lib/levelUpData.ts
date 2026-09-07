// D&D 5e SRD-derived level-up reference data (condensed for the Level Up Assistant).

export type FeatureChoice =
  | { kind: "asi" }
  | { kind: "subclass" }
  | { kind: "spell"; count: number };

export type ClassFeature = {
  name: string;
  description: string;
  choice?: FeatureChoice;
};

export const ASI_LEVELS = [4, 8, 12, 16, 19];

const ASI: ClassFeature = {
  name: "Ability Score Improvement",
  description:
    "You can increase one ability score by 2, or two ability scores by 1 each. You can't increase a score above 20.",
  choice: { kind: "asi" },
};

const F = (name: string, description: string, choice?: FeatureChoice): ClassFeature => ({ name, description, choice });

// Subclass options per class (name + short description).
export const SUBCLASSES: Record<string, { name: string; description: string }[]> = {
  Barbarian: [
    { name: "Path of the Berserker", description: "Frenzy lets you make a bonus action attack each round while raging, at the cost of exhaustion." },
    { name: "Path of the Totem Warrior", description: "Choose a spirit animal (bear, eagle, wolf) for resilience, mobility, or pack tactics." },
  ],
  Bard: [
    { name: "College of Lore", description: "Cutting Words and extra skills; the scholar-bard who bends fate with knowledge." },
    { name: "College of Valor", description: "Combat Inspiration, martial weapons, medium armor; a battle skald." },
  ],
  Cleric: [
    { name: "Life Domain", description: "The premier healer: bonus healing on every cure spell and heavy armor." },
    { name: "War Domain", description: "War Priest bonus attacks, Guided Strike, and heavy armor — a holy warrior." },
    { name: "Light Domain", description: "Warding Flare and radiant fire magic that blinds and burns." },
    { name: "Trickery Domain", description: "Blessing of the Trickster and illusory duplicates." },
    { name: "Knowledge Domain", description: "Languages, expertise, and mind-reading divination." },
    { name: "Nature Domain", description: "Druid spells, heavy armor, and command over beasts and plants." },
    { name: "Tempest Domain", description: "Thunder and lightning; Wrath of the Storm punishes attackers." },
  ],
  Druid: [
    { name: "Circle of the Land", description: "Extra cantrip, bonus terrain spells, and natural recovery of slots." },
    { name: "Circle of the Moon", description: "Combat Wild Shape — transform as a bonus action into fiercer beasts." },
  ],
  Fighter: [
    { name: "Champion", description: "Improved Critical and Remarkable Athlete — simple, brutal reliability." },
    { name: "Battle Master", description: "Combat Superiority dice fuel maneuvers like Trip Attack and Riposte." },
    { name: "Eldritch Knight", description: "Wizard spells, weapon bond, and War Magic." },
  ],
  Monk: [
    { name: "Way of the Open Hand", description: "Flurry of Blows knocks prone, pushes, or denies reactions." },
    { name: "Way of Shadow", description: "Shadow Arts and Shadow Step — a ninja of darkness." },
    { name: "Way of the Four Elements", description: "Spend ki to shape elemental disciplines." },
  ],
  Paladin: [
    { name: "Oath of Devotion", description: "Sacred Weapon and Turn the Unholy; the paragon of virtue." },
    { name: "Oath of the Ancients", description: "Nature's Wrath and Turn the Faithless; light against despair." },
    { name: "Oath of Vengeance", description: "Vow of Enmity and Abjure Enemy; a relentless hunter of the wicked." },
  ],
  Ranger: [
    { name: "Hunter", description: "Choose prey-slaying options like Colossus Slayer or Horde Breaker." },
    { name: "Beast Master", description: "Bond with an animal companion that fights at your command." },
  ],
  Rogue: [
    { name: "Thief", description: "Fast Hands and Second-Story Work; the classic burglar." },
    { name: "Assassin", description: "Assassinate grants advantage and auto-crits on surprised foes." },
    { name: "Arcane Trickster", description: "Wizard spells, Mage Hand Legerdemain, and magical ambush." },
  ],
  Sorcerer: [
    { name: "Draconic Bloodline", description: "Extra HP, draconic resilience, and elemental affinity." },
    { name: "Wild Magic", description: "Tides of Chaos and unpredictable surges of raw magic." },
  ],
  Warlock: [
    { name: "The Fiend", description: "Dark One's Blessing grants temp HP on every kill; fire and ruin." },
    { name: "The Archfey", description: "Fey Presence charms or frightens; misty escape." },
    { name: "The Great Old One", description: "Awakened Mind telepathy and Entropic Ward." },
  ],
  Wizard: [
    { name: "School of Evocation", description: "Sculpt Spells and Potent Cantrip; the blaster wizard." },
    { name: "School of Abjuration", description: "Arcane Ward absorbs damage; the protective mage." },
    { name: "School of Divination", description: "Portent replaces rolls with foreseen results." },
    { name: "School of Necromancy", description: "Grim Harvest and undead thralls." },
    { name: "School of Illusion", description: "Improved Minor Illusion and malleable illusions." },
    { name: "School of Transmutation", description: "Transmuter's stone and shapechanging magic." },
    { name: "School of Enchantment", description: "Hypnotic Gaze and instinctive charm." },
    { name: "School of Conjuration", description: "Minor Conjuration and benign transposition." },
  ],
  Artificer: [
    { name: "Alchemist", description: "Experimental Elixirs and healing-focused infusions." },
    { name: "Artillerist", description: "Eldritch Cannon — a portable engine of destruction." },
    { name: "Battle Smith", description: "Steel Defender companion and arcane weapon fighting." },
  ],
  "Blood Hunter": [
    { name: "Order of the Ghostslayer", description: "Rite of the Dawn and undead-slaying curses." },
    { name: "Order of the Profane Soul", description: "Warlock pact magic fused with hemocraft." },
    { name: "Order of the Mutant", description: "Brew mutagens that reshape your body mid-battle." },
    { name: "Order of the Lycan", description: "Embrace a controlled hybrid transformation." },
  ],
};

// Level at which each class picks its subclass.
export const SUBCLASS_LEVEL: Record<string, number> = {
  Barbarian: 3, Bard: 3, Cleric: 1, Druid: 2, Fighter: 3, Monk: 3, Paladin: 3,
  Ranger: 3, Rogue: 3, Sorcerer: 1, Warlock: 1, Wizard: 2, Artificer: 3, "Blood Hunter": 3,
};

// Class features by level (levels 2-20; level 1 handled at creation).
export const CLASS_FEATURES: Record<string, Record<number, ClassFeature[]>> = {
  Barbarian: {
    2: [F("Reckless Attack", "You can throw aside all concern for defense to attack with advantage on Strength attacks this turn; attacks against you have advantage until your next turn."), F("Danger Sense", "Advantage on Dexterity saving throws against effects you can see, such as traps and spells.")],
    3: [F("Primal Path", "Choose a path that shapes the nature of your rage.")],
    4: [ASI],
    5: [F("Extra Attack", "You can attack twice, instead of once, whenever you take the Attack action."), F("Fast Movement", "Your speed increases by 10 feet while you aren't wearing heavy armor.")],
    6: [F("Path Feature", "You gain a feature from your Primal Path.")],
    7: [F("Feral Instinct", "Advantage on initiative rolls, and you can act normally on a surprise round if you rage first.")],
    8: [ASI],
    9: [F("Brutal Critical (1 die)", "You can roll one additional weapon damage die when determining extra damage for a critical hit.")],
    10: [F("Path Feature", "You gain a feature from your Primal Path.")],
    11: [F("Relentless Rage", "If you drop to 0 hit points while raging, make a DC 10 Constitution save to drop to 1 instead.")],
    12: [ASI],
  },
  Bard: {
    2: [F("Jack of All Trades", "Add half your proficiency bonus, rounded down, to any ability check that doesn't already include it."), F("Song of Rest", "During a short rest, allies who spend Hit Dice regain an extra 1d6 hit points.")],
    3: [F("Bard College", "Choose a college that shapes your art."), F("Expertise", "Choose two skill proficiencies; your proficiency bonus is doubled for those checks.")],
    4: [ASI],
    5: [F("Font of Inspiration", "You regain all expended uses of Bardic Inspiration on a short or long rest.")],
    6: [F("Countercharm", "As an action, start a performance that gives you and allies within 30 feet advantage on saves against being frightened or charmed."), F("College Feature", "You gain a feature from your Bard College.")],
    7: [],
    8: [ASI],
    9: [F("Song of Rest (d8)", "Your Song of Rest die improves to a d8.")],
    10: [F("Expertise", "Choose two more skills for Expertise."), F("Magical Secrets", "Learn two spells from any class."), F("Bardic Versatility", "Replace a cantrip or an Expertise choice when you gain a level.")],
    11: [],
    12: [ASI],
  },
  Cleric: {
    2: [F("Channel Divinity (1/rest)", "You can channel divine energy to fuel magical effects: Turn Undead plus a domain effect."), F("Divine Domain Feature", "You gain a Channel Divinity option from your domain.")],
    3: [],
    4: [ASI],
    5: [F("Destroy Undead (CR 1/2)", "When an undead of CR 1/2 or lower fails its save against your Turn Undead, it is instantly destroyed.")],
    6: [F("Channel Divinity (2/rest)", "You can use Channel Divinity twice between rests."), F("Domain Feature", "You gain a feature from your Divine Domain.")],
    7: [],
    8: [ASI, F("Destroy Undead (CR 1)", "Your Destroy Undead threshold rises to CR 1."), F("Divine Strike / Potent Spellcasting", "Your domain grants extra damage on weapon attacks or cantrips.")],
    9: [],
    10: [F("Divine Intervention", "Call on your deity to intervene; succeed on a percentile roll equal to or under your cleric level.")],
    11: [F("Destroy Undead (CR 2)", "Your Destroy Undead threshold rises to CR 2.")],
    12: [ASI],
  },
  Druid: {
    2: [F("Wild Shape", "As an action, magically assume the shape of a beast you have seen, twice per rest."), F("Druid Circle", "Choose the circle that shapes your druidry.")],
    3: [],
    4: [ASI, F("Wild Shape Improvement", "You can transform into beasts of CR 1/2 with no flying speed.")],
    5: [],
    6: [F("Circle Feature", "You gain a feature from your Druid Circle.")],
    7: [],
    8: [ASI, F("Wild Shape Improvement", "You can transform into beasts of CR 1 with no flying speed restriction.")],
    9: [],
    10: [F("Circle Feature", "You gain a feature from your Druid Circle.")],
    11: [],
    12: [ASI],
  },
  Fighter: {
    2: [F("Action Surge (1 use)", "On your turn, take one additional action. You regain this on a short or long rest.")],
    3: [F("Martial Archetype", "Choose the archetype that defines your fighting style.")],
    4: [ASI],
    5: [F("Extra Attack", "You can attack twice, instead of once, whenever you take the Attack action.")],
    6: [ASI],
    7: [F("Archetype Feature", "You gain a feature from your Martial Archetype.")],
    8: [ASI],
    9: [F("Indomitable (1 use)", "You can reroll a saving throw you fail; you must use the new roll.")],
    10: [F("Archetype Feature", "You gain a feature from your Martial Archetype.")],
    11: [F("Extra Attack (2)", "You can attack three times whenever you take the Attack action.")],
    12: [ASI],
  },
  Monk: {
    2: [F("Ki", "You have ki points equal to your monk level, fueling Flurry of Blows, Patient Defense, and Step of the Wind."), F("Unarmored Movement", "Your speed increases by 10 feet while you wear no armor or shield.")],
    3: [F("Monastic Tradition", "Choose your monastic tradition."), F("Deflect Missiles", "Use your reaction to reduce ranged weapon damage and possibly throw the missile back.")],
    4: [ASI, F("Slow Fall", "Use your reaction to reduce falling damage by five times your monk level.")],
    5: [F("Extra Attack", "You can attack twice whenever you take the Attack action."), F("Stunning Strike", "Spend 1 ki to force a Constitution save; on a failure the target is stunned until the end of your next turn.")],
    6: [F("Ki-Empowered Strikes", "Your unarmed strikes count as magical."), F("Tradition Feature", "You gain a feature from your monastic tradition.")],
    7: [F("Evasion", "Take no damage on a successful Dexterity save against area effects, and half on a failure."), F("Stillness of Mind", "As an action, end one effect charming or frightening you.")],
    8: [ASI],
    9: [F("Unarmored Movement Improvement", "You can move along vertical surfaces and across liquids on your turn.")],
    10: [F("Purity of Body", "You are immune to disease and poison.")],
    11: [F("Tradition Feature", "You gain a feature from your monastic tradition.")],
    12: [ASI],
  },
  Paladin: {
    2: [F("Divine Smite", "When you hit with a melee weapon, expend a spell slot to deal 2d8 extra radiant damage, +1d8 per slot level above 1st."), F("Spellcasting", "You gain paladin spell slots and prepare spells."), F("Fighting Style", "Choose a fighting style such as Defense, Dueling, or Great Weapon Fighting.")],
    3: [F("Sacred Oath", "Swear your oath, gaining Channel Divinity options and oath spells."), F("Divine Health", "You are immune to disease.")],
    4: [ASI],
    5: [F("Extra Attack", "You can attack twice whenever you take the Attack action.")],
    6: [F("Aura of Protection", "You and friendly creatures within 10 feet add your Charisma modifier to saving throws.")],
    7: [F("Oath Feature", "You gain an aura or feature from your Sacred Oath.")],
    8: [ASI],
    9: [],
    10: [F("Aura of Courage", "You and allies within 10 feet can't be frightened while you are conscious.")],
    11: [F("Improved Divine Smite", "Your melee weapon hits deal an extra 1d8 radiant damage.")],
    12: [ASI],
  },
  Ranger: {
    2: [F("Fighting Style", "Choose Archery, Defense, Dueling, or Two-Weapon Fighting."), F("Spellcasting", "You learn ranger spells and gain spell slots.")],
    3: [F("Ranger Archetype", "Choose your archetype."), F("Primeval Awareness", "Expend a spell slot to sense certain creature types within miles.")],
    4: [ASI],
    5: [F("Extra Attack", "You can attack twice whenever you take the Attack action.")],
    6: [F("Favored Enemy & Natural Explorer Improvement", "Choose an additional favored enemy and favored terrain.")],
    7: [F("Archetype Feature", "You gain a feature from your Ranger Archetype.")],
    8: [ASI, F("Land's Stride", "Difficult terrain costs you no extra movement and you pass through nonmagical plants freely.")],
    9: [],
    10: [F("Hide in Plain Sight", "Spend 1 minute camouflaging yourself for +10 to Stealth while motionless.")],
    11: [F("Archetype Feature", "You gain a feature from your Ranger Archetype.")],
    12: [ASI],
  },
  Rogue: {
    2: [F("Cunning Action", "You can Dash, Disengage, or Hide as a bonus action on each of your turns.")],
    3: [F("Roguish Archetype", "Choose your archetype."), F("Sneak Attack Improvement", "Your Sneak Attack damage increases.")],
    4: [ASI],
    5: [F("Uncanny Dodge", "Use your reaction to halve the damage of an attack you can see.")],
    6: [F("Expertise", "Choose two more skill proficiencies to double your proficiency bonus with.")],
    7: [F("Evasion", "Take no damage on a successful Dexterity save against area effects, and half on a failure.")],
    8: [ASI],
    9: [F("Archetype Feature", "You gain a feature from your Roguish Archetype.")],
    10: [ASI],
    11: [F("Reliable Talent", "Treat any d20 roll of 9 or lower as a 10 for ability checks using your proficiency.")],
    12: [ASI],
  },
  Sorcerer: {
    2: [F("Font of Magic", "You gain sorcery points and can convert them into spell slots and back.")],
    3: [F("Metamagic", "Choose two Metamagic options, such as Twinned Spell or Quickened Spell.")],
    4: [ASI],
    5: [],
    6: [F("Origin Feature", "You gain a feature from your Sorcerous Origin.")],
    7: [],
    8: [ASI],
    9: [],
    10: [F("Metamagic", "Choose one additional Metamagic option.")],
    11: [],
    12: [ASI],
  },
  Warlock: {
    2: [F("Eldritch Invocations", "You learn two eldritch invocations, fragments of forbidden knowledge.")],
    3: [F("Pact Boon", "Choose Pact of the Chain, Blade, or Tome.")],
    4: [ASI],
    5: [F("Eldritch Invocation", "You learn an additional invocation.")],
    6: [F("Patron Feature", "You gain a feature from your Otherworldly Patron.")],
    7: [F("Eldritch Invocation", "You learn an additional invocation.")],
    8: [ASI],
    9: [F("Eldritch Invocation", "You learn an additional invocation.")],
    10: [F("Patron Feature", "You gain a feature from your Otherworldly Patron.")],
    11: [F("Mystic Arcanum (6th level)", "You choose one 6th-level spell you can cast once per long rest.")],
    12: [ASI, F("Eldritch Invocation", "You learn an additional invocation.")],
  },
  Wizard: {
    2: [F("Arcane Tradition", "Choose the school of magic that shapes your arcane practice.")],
    3: [],
    4: [ASI],
    5: [],
    6: [F("School Feature", "You gain a feature from your Arcane Tradition.")],
    7: [],
    8: [ASI],
    9: [],
    10: [F("School Feature", "You gain a feature from your Arcane Tradition.")],
    11: [],
    12: [ASI],
  },
  Artificer: {
    2: [F("Infuse Item", "You learn infusions and can imbue mundane items with magic during a long rest.")],
    3: [F("Artificer Specialist", "Choose your specialism."), F("The Right Tool for the Job", "Magically create one set of artisan's tools in an hour.")],
    4: [ASI],
    5: [F("Artificer Specialist Feature", "You gain a feature from your specialism.")],
    6: [F("Tool Expertise", "Your proficiency bonus is doubled for any ability check using artisan's tools.")],
    7: [F("Flash of Genius", "Use your reaction to add your Intelligence modifier to an ally's ability check or save.")],
    8: [ASI],
    9: [F("Specialist Feature", "You gain a feature from your specialism.")],
    10: [F("Magic Item Adept", "You can attune to four magic items and craft common/uncommon items faster.")],
    11: [F("Spell-Storing Item", "Store a 1st- or 2nd-level spell in an item for allies to cast.")],
    12: [ASI],
  },
  "Blood Hunter": {
    2: [F("Blood Maledict", "You gain blood curses, fueled by your own hit points, that you can amplify.")],
    3: [F("Order of the Blood Hunter", "Choose your order."), F("Crimson Rite (Flame/Frost/Storm)", "Activate a rite on your weapon to deal extra elemental damage at the cost of hit points.")],
    4: [ASI],
    5: [F("Extra Attack", "You can attack twice whenever you take the Attack action.")],
    6: [F("Brand of Castigation", "Your Crimson Rite weapon can brand a creature, marking and punishing it.")],
    7: [F("Order Feature", "You gain a feature from your order.")],
    8: [ASI],
    9: [F("Grim Psychometry", "You have an uncanny knack for divining dark histories from objects and places.")],
    10: [F("Dark Augmentation", "Your speed increases by 5 feet and you add half your hemocraft die to Strength, Dexterity, and Constitution saves.")],
    11: [F("Order Feature", "You gain a feature from your order.")],
    12: [ASI],
  },
};

// Full-caster spell slot progression (levels 1-20).
const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const HALF: number[][] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

// Artificer rounds up at level 1.
const ARTIFICER: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

// Warlock pact magic: [slotCount, slotLevel]
const PACT: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

export const FULL_CASTERS = ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"];
export const HALF_CASTERS = ["Paladin", "Ranger"];

export function isSpellcaster(className: string): boolean {
  return FULL_CASTERS.includes(className) || HALF_CASTERS.includes(className)
    || className === "Warlock" || className === "Artificer";
}

/** Slot counts keyed by spell level ("1".."9") for a class at a given class level. */
export function slotsForClassLevel(className: string, level: number): Record<string, number> {
  const lvl = Math.max(1, Math.min(20, level));
  const out: Record<string, number> = {};
  if (className === "Warlock") {
    const [count, slotLevel] = PACT[lvl - 1];
    out[String(slotLevel)] = count;
    return out;
  }
  const table = FULL_CASTERS.includes(className) ? FULL
    : className === "Artificer" ? ARTIFICER
    : HALF_CASTERS.includes(className) ? HALF
    : null;
  if (!table) return out;
  table[lvl - 1].forEach((n, i) => { if (n > 0) out[String(i + 1)] = n; });
  return out;
}

/** Highest spell level castable by this class at this level. */
export function maxSpellLevel(className: string, level: number): number {
  const slots = slotsForClassLevel(className, level);
  const keys = Object.keys(slots).map(Number);
  return keys.length ? Math.max(...keys) : 0;
}

/** How many new spells the class learns on reaching `level` (0 = prepared caster). */
export function spellsLearnedAtLevel(className: string, level: number): number {
  if (className === "Wizard") return 2;
  if (className === "Bard") return level <= 10 ? 1 : (level === 14 || level === 18 ? 1 : level % 2 === 0 ? 1 : 0);
  if (className === "Sorcerer") return level <= 11 ? 1 : [13, 15, 17].includes(level) ? 1 : 0;
  if (className === "Warlock") return level <= 9 ? 1 : [11, 13, 15, 17, 19].includes(level) ? 1 : 0;
  if (className === "Ranger") return [3, 5, 7, 9, 11, 13, 15, 17, 19].includes(level) ? 1 : 0;
  if (className === "Artificer") return [2, 3, 5, 7, 9, 11, 13, 15, 17, 19].includes(level) ? 1 : 0;
  return 0; // Cleric, Druid, Paladin prepare from their full list
}

/** New cantrips gained on reaching `level`. */
export function cantripsGainedAtLevel(className: string, level: number): number {
  const gains: Record<string, number[]> = {
    Bard: [4, 10], Cleric: [4, 10], Druid: [4, 10], Sorcerer: [4, 10],
    Wizard: [4, 10], Warlock: [4, 10], Artificer: [4, 10, 14],
  };
  return (gains[className] ?? []).includes(level) ? 1 : 0;
}

/** Features unlocked for a class at a given level. */
export function featuresForLevel(className: string, level: number): ClassFeature[] {
  const base = CLASS_FEATURES[className]?.[level] ?? [];
  const out = [...base];
  // Subclass selection
  if (SUBCLASS_LEVEL[className] === level && SUBCLASSES[className]) {
    const already = out.find((f) => /path|college|domain|circle|archetype|oath|tradition|specialist|order|pact boon/i.test(f.name));
    if (already) already.choice = { kind: "subclass" };
    else out.unshift(F("Subclass", "Choose the specialization that defines your character.", { kind: "subclass" }));
  }
  if (ASI_LEVELS.includes(level) && !out.some((f) => f.name === ASI.name)) out.push(ASI);
  // Deep-clone so callers can't mutate the table
  return out.map((f) => ({ ...f }));
}

/** Difference between two slot maps, for the summary. */
export function slotDiff(before: Record<string, number>, after: Record<string, number>) {
  const out: { level: number; added: number; total: number }[] = [];
  for (const k of Object.keys(after)) {
    const added = (after[k] ?? 0) - (before[k] ?? 0);
    if (added > 0) out.push({ level: Number(k), added, total: after[k] });
  }
  return out.sort((a, b) => a.level - b.level);
}
