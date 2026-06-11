import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Yetkilendirme yok" }, 401);

    // 1) Çağıranı doğrula
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    // 2) Süper-admin kontrolü
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: prof } = await admin
      .from("profiles")
      .select("is_superadmin, id")
      .eq("id", user.id)
      .single();
    if (!prof?.is_superadmin) return json({ error: "Yetkisiz erişim" }, 403);

    // 3) İşlem
    const { islem, veri } = await req.json();

    if (islem === "kurumlari_listele") {
      const { data, error } = await admin
        .from("kurumlar")
        .select("*, profiles(id, ad, soyad, eposta, rol, is_superadmin)")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data });
    }

    if (islem === "abonelik_guncelle") {
      const { kurum_id, abonelik_durumu, abonelik_bitis } = veri;
      const { error } = await admin
        .from("kurumlar")
        .update({ abonelik_durumu, abonelik_bitis })
        .eq("id", kurum_id);
      if (error) return json({ error: error.message }, 500);
      // Log
      await admin.from("superadmin_log").insert({
        yapan_id: prof.id,
        islem: "abonelik_guncelle",
        detay: { kurum_id, abonelik_durumu, abonelik_bitis },
      });
      return json({ ok: true });
    }

    if (islem === "kurum_pasif_yap") {
      const { kurum_id } = veri;
      const { error } = await admin
        .from("kurumlar")
        .update({ abonelik_durumu: "pasif" })
        .eq("id", kurum_id);
      if (error) return json({ error: error.message }, 500);
      await admin.from("superadmin_log").insert({
        yapan_id: prof.id,
        islem: "kurum_pasif_yap",
        detay: { kurum_id },
      });
      return json({ ok: true });
    }

    return json({ error: "Bilinmeyen işlem" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
