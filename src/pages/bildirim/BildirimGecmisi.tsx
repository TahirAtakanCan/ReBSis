import { useQuery } from '@tanstack/react-query'

import { BILDIRIM_DURUM_ETIKET, BILDIRIM_DURUM_RENK } from '../../lib/bildirim'
import { tarihFormatla } from '../../lib/muhasebe'
import { EMPTY_ARRAY } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import type { Bildirim } from '../../lib/types'

async function fetchBildirimler() {
  const { data, error } = await supabase
    .from('bildirimler')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data as Bildirim[]) ?? []
}

function aliciGoster(kayit: Bildirim) {
  if (kayit.tip === 'sms') return kayit.alici_telefon ?? '—'
  return kayit.alici_eposta ?? '—'
}

function mesajKisalt(mesaj: string | null, max = 60) {
  if (!mesaj) return '—'
  return mesaj.length > max ? `${mesaj.slice(0, max)}…` : mesaj
}

export default function BildirimGecmisi() {
  const { data: kayitlarData, isLoading, error } = useQuery({
    queryKey: ['bildirimler'],
    queryFn: fetchBildirimler,
  })
  const kayitlar = kayitlarData ?? EMPTY_ARRAY

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Bildirim Geçmişi</h1>
        <p className="mt-1 text-sm text-slate-600">Son 200 bildirim kaydı.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Kayıtlar yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && kayitlar.length === 0 && (
          <p className="text-sm text-slate-600">Henüz bildirim kaydı yok.</p>
        )}

        {!isLoading && !error && kayitlar.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Tip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Alıcı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Mesaj
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {kayitlar.map((kayit) => (
                  <tr key={kayit.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {tarihFormatla(kayit.created_at.slice(0, 10))}
                      <span className="ml-1 text-slate-400">
                        {new Date(kayit.created_at).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {kayit.tip === 'sms' ? 'SMS' : 'E-posta'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {aliciGoster(kayit)}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-600" title={kayit.mesaj ?? ''}>
                      {kayit.tip === 'eposta' && kayit.konu
                        ? `${kayit.konu} — ${mesajKisalt(kayit.mesaj, 40)}`
                        : mesajKisalt(kayit.mesaj)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          BILDIRIM_DURUM_RENK[kayit.durum] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {BILDIRIM_DURUM_ETIKET[kayit.durum] ?? kayit.durum}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
