import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type CharacterImage, MAX_IMAGES } from "@/lib/types";
import { useToast } from "./Toast";

const db = supabase as any;

export function CharacterGallery({
  characterId, userId, readOnly, onPrimaryChange,
}: {
  characterId: string;
  userId: string;
  readOnly: boolean;
  onPrimaryChange?: (url: string) => void;
}) {
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function reload() {
    const { data } = await db.from("character_images").select("*")
      .eq("character_id", characterId).order("sort_order", { ascending: true });
    setImages(data ?? []);
  }
  useEffect(() => { reload(); }, [characterId]);

  async function uploadFiles(files: FileList | File[]) {
    if (readOnly) return;
    const list = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast(`Limit ${MAX_IMAGES} images`); return; }
    const take = list.slice(0, remaining);
    setBusy(true);
    try {
      let order = images.length;
      let firstUrl = "";
      for (const file of take) {
        const path = `${userId}/${characterId}/images/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("character-portraits").upload(path, file, { upsert: true });
        if (error) { toast("Upload failed"); continue; }
        const { data: signed } = await supabase.storage.from("character-portraits")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = signed?.signedUrl ?? "";
        if (!url) continue;
        const isPrim = images.length === 0 && order === images.length;
        await db.from("character_images").insert({
          character_id: characterId, image_url: url, is_primary: isPrim, sort_order: order++,
        });
        if (isPrim) firstUrl = url;
      }
      if (firstUrl) onPrimaryChange?.(firstUrl);
      await reload();
    } finally { setBusy(false); }
  }

  async function setPrimary(img: CharacterImage) {
    if (readOnly) return;
    await db.from("character_images").update({ is_primary: false }).eq("character_id", characterId);
    await db.from("character_images").update({ is_primary: true }).eq("id", img.id);
    onPrimaryChange?.(img.image_url);
    await reload();
  }

  async function remove(img: CharacterImage) {
    if (readOnly) return;
    await db.from("character_images").delete().eq("id", img.id);
    if (img.is_primary) {
      const next = images.find((i) => i.id !== img.id);
      if (next) {
        await db.from("character_images").update({ is_primary: true }).eq("id", next.id);
        onPrimaryChange?.(next.image_url);
      } else {
        onPrimaryChange?.("");
      }
    }
    await reload();
  }

  const canAdd = !readOnly && images.length < MAX_IMAGES;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          Gallery · {images.length}/{MAX_IMAGES}
        </div>
        {canAdd && (
          <label className="j-btn j-btn-ghost text-xs cursor-pointer">
            + Add Image
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          </label>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-[rgba(255,106,0,0.25)] hover:border-[var(--color-ember)] hover:shadow-[0_0_14px_-2px_var(--color-ember)] transition">
            <img src={img.image_url} alt="" className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightbox(img.image_url)} />
            {img.is_primary && (
              <div className="absolute top-1 left-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-ember)] text-black font-bold">★ Cover</div>
            )}
            {!readOnly && (
              <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/80 to-transparent">
                {!img.is_primary && (
                  <button className="text-[10px] j-btn j-btn-ghost !py-0.5 !px-2 flex-1" onClick={() => setPrimary(img)}>Make Cover</button>
                )}
                <button className="text-[10px] text-[var(--color-blood)] px-2 hover:text-white" onClick={() => remove(img)}>✕</button>
              </div>
            )}
          </div>
        ))}
        {canAdd && (
          <label className="aspect-square rounded border border-dashed border-[rgba(255,106,0,0.35)] flex items-center justify-center cursor-pointer text-3xl text-[var(--color-muted)] hover:text-[var(--color-flame)] hover:border-[var(--color-ember)] transition">
            {busy ? <span className="j-spinner" /> : "＋"}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          </label>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 j-fade" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded shadow-2xl" />
          <button className="absolute top-4 right-4 j-btn j-btn-ghost" onClick={() => setLightbox(null)}>Close ✕</button>
        </div>
      )}
    </div>
  );
}
