import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function geciciSifre(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10); crypto.getRandomValues(arr);
  return [...arr].map((n) => c[n % c.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Yetkilendirme yok" }, 401);

    // 1) Çağıranı kendi JWT'siyle doğrula
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    // 2) Admin (service_role) — RLS bypass; sadece sunucuda
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 3) Çağıranın profili + YETKİ kontrolü
    const { data: prof, error: pErr } = await admin
      .from("profiles").select("kurum_id, rol, yetkiler").eq("id", user.id).single();
    if (pErr || !prof) return json({ error: "Profil bulunamadı" }, 403);
    const yetkili = prof.rol === "kurum_sahibi" || prof.yetkiler?.kullanici_yonet === true;
    if (!yetkili) return json({ error: "Bu işlem için yetkiniz yok" }, 403);

    // 4) Gövde
    const { ogretmenler } = await req.json();
    if (!Array.isArray(ogretmenler) || ogretmenler.length === 0)
      return json({ error: "Liste boş" }, 400);
    if (ogretmenler.length > 200) return json({ error: "Tek seferde en fazla 200 kayıt" }, 400);

    const sonuclar = [];
    for (const o of ogretmenler) {
      const eposta = String(o.eposta ?? "").trim().toLowerCase();
      const ad = String(o.ad ?? "").trim();
      const soyad = String(o.soyad ?? "").trim();
      if (!eposta.includes("@")) { sonuclar.push({ eposta, durum: "hata", mesaj: "Geçersiz e-posta" }); continue; }

      const sifre = geciciSifre();
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: eposta, password: sifre, email_confirm: true, user_metadata: { ad, soyad },
      });
      if (cErr || !created.user) { sonuclar.push({ eposta, durum: "hata", mesaj: cErr?.message ?? "Oluşturulamadı" }); continue; }

      // KRİTİK: kurum_id ÇAĞIRANIN kurumu — başka kuruma yazılamaz
      const { error: insErr } = await admin.from("profiles").insert({
        id: created.user.id, kurum_id: prof.kurum_id, rol: "ogretmen", ad, soyad, eposta,
      });
      if (insErr) { await admin.auth.admin.deleteUser(created.user.id); sonuclar.push({ eposta, durum: "hata", mesaj: insErr.message }); continue; }

      sonuclar.push({ eposta, ad, soyad, gecici_sifre: sifre, durum: "ok" });
    }
    return json({ sonuclar });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
