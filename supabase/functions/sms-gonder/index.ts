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

    // Çağıranı doğrula
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    // Yetki kontrolü
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: prof } = await admin
      .from("profiles")
      .select("kurum_id, rol, yetkiler")
      .eq("id", user.id)
      .single();
    if (!prof) return json({ error: "Profil bulunamadı" }, 403);

    const yetkili =
      prof.rol === "kurum_sahibi" ||
      prof.rol === "ogretmen" ||
      prof.yetkiler?.bildirim_gonder === true;
    if (!yetkili) return json({ error: "Yetkisiz" }, 403);

    const { telefon, mesaj } = await req.json();
    if (!telefon || !mesaj) return json({ error: "telefon ve mesaj zorunlu" }, 400);

    // Netgsm API bilgileri env'den
    const netgsmKullanici = Deno.env.get("NETGSM_KULLANICI");
    const netgsmSifre = Deno.env.get("NETGSM_SIFRE");
    const netgsmBaslik = Deno.env.get("NETGSM_BASLIK") ?? "ReBSis";

    // TEST MODU: Netgsm bilgileri yoksa console'a yaz
    if (!netgsmKullanici || !netgsmSifre) {
      console.log(`[SMS TEST MODU] → ${telefon}: ${mesaj}`);
      return json({ ok: true, mod: "test", telefon, mesaj });
    }

    // Gerçek Netgsm gönderimi
    const url = new URL("https://api.netgsm.com.tr/sms/send/get/");
    url.searchParams.set("usercode", netgsmKullanici);
    url.searchParams.set("password", netgsmSifre);
    url.searchParams.set("gsmno", telefon.replace(/\D/g, ""));
    url.searchParams.set("message", mesaj);
    url.searchParams.set("msgheader", netgsmBaslik);

    const resp = await fetch(url.toString());
    const text = await resp.text();

    // Netgsm hata kodları: 00, 01, 02 = başarılı
    const basarili = ["00", "01", "02"].some((k) => text.startsWith(k));
    if (!basarili) {
      console.error("Netgsm hata:", text);
      return json({ error: `Netgsm hatası: ${text}` }, 500);
    }

    return json({ ok: true, mod: "gercek", telefon });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
