// Simple in-memory cache for Open5e spells.
export type ApiSpell = {
  slug: string;
  name: string;
  level_int: number;
  school: string;
  casting_time: string;
  range: string;
  components: string;
  material?: string;
  duration: string;
  desc: string;
  higher_level?: string;
  dnd_class?: string; // comma-separated classes
};

let cache: ApiSpell[] | null = null;
let loading: Promise<ApiSpell[]> | null = null;

export async function loadSpells(): Promise<ApiSpell[]> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    const all: ApiSpell[] = [];
    let url: string | null = "https://api.open5e.com/v1/spells/?limit=500";
    while (url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error("spell fetch failed");
      const j: any = await r.json();
      for (const s of j.results ?? []) {
        all.push({
          slug: s.slug,
          name: s.name,
          level_int: s.level_int ?? 0,
          school: s.school ?? "",
          casting_time: s.casting_time ?? "",
          range: s.range ?? "",
          components: s.components ?? "",
          material: s.material,
          duration: s.duration ?? "",
          desc: s.desc ?? "",
          higher_level: s.higher_level,
          dnd_class: s.dnd_class,
        });
      }
      url = j.next ?? null;
    }
    cache = all;
    loading = null;
    return all;
  })();
  return loading;
}

export function searchSpells(list: ApiSpell[], query: string, classes: string[] | null): ApiSpell[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  let out = list.filter((s) => s.name.toLowerCase().includes(q));
  if (classes && classes.length > 0) {
    const set = new Set(classes.map((c) => c.toLowerCase()));
    out = out.filter((s) => {
      if (!s.dnd_class) return false;
      return s.dnd_class.toLowerCase().split(/[,;]/).map((x) => x.trim()).some((c) => {
        for (const wanted of set) if (c.includes(wanted)) return true;
        return false;
      });
    });
  }
  return out.slice(0, 12);
}
