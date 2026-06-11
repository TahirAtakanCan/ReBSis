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

    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "Geçersiz oturum" }, 401);

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

    const { alici_eposta, konu, icerik_html } = await req.json();
    if (!alici_eposta || !konu || !icerik_html)
      return json({ error: "alici_eposta, konu, icerik_html zorunlu" }, 400);

    // Resend API (ücretsiz 100 e-posta/gün, Supabase önerilen)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log(`[EPOSTA TEST] → ${alici_eposta} | ${konu}`);
      return json({ ok: true, mod: "test", alici_eposta });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ReBSis <bildirim@rebsis.com>",
        to: [alici_eposta],
        subject: konu,
        html: icerik_html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return json({ error: `Resend hatası: ${err}` }, 500);
    }

    return json({ ok: true, mod: "gercek", alici_eposta });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
