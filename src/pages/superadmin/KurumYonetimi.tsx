import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import AbonelikDuzenleModal from '../../components/superadmin/AbonelikDuzenleModal'
import { tarihFormatla } from '../../lib/muhasebe'
import { ABONELIK_DURUM_ETIKET, superadminCagir } from '../../lib/superadmin'

type KurumProfil = {
  id: string
  ad: string | null
  soyad: string | null
  eposta: string | null
  rol: string | null
  is_superadmin: boolean | null
}

type Kurum = {
  id: string
  ad: string
  abonelik_durumu: string
  abonelik_bitis: string | null
  created_at: string
  profiles?: KurumProfil[] | null
}

const DURUM_RENK: Record<string, string> = {
  deneme: 'bg-blue-900 text-blue-200',
  aktif: 'bg-emerald-900 text-emerald-200',
  suresi_doldu: 'bg-amber-900 text-amber-200',
  pasif: 'bg-gray-700 text-gray-300',
}

async function fetchKurumlar() {
  return superadminCagir<Kurum[]>('kurumlari_listele')
}

export default function KurumYonetimi() {
  const queryClient = useQueryClient()
  const [duzenlenenKurum, setDuzenlenenKurum] = useState<Kurum | null>(null)
  const [islemHata, setIslemHata] = useState<string | null>(null)

  const { data: kurumlar = [], isLoading, error } = useQuery({
    queryKey: ['superadmin-kurumlar'],
    queryFn: fetchKurumlar,
  })

  const pasifYapMutation = useMutation({
    mutationFn: async (kurumId: string) => {
      await superadminCagir('kurum_pasif_yap', { kurum_id: kurumId })
    },
    onSuccess: async () => {
      setIslemHata(null)
      await queryClient.invalidateQueries({ queryKey: ['superadmin-kurumlar'] })
    },
    onError: (err) => {
      setIslemHata(err instanceof Error ? err.message : 'İşlem başarısız.')
    },
  })

  const pasifYap = (kurum: Kurum) => {
    const onay = window.confirm(
      `"${kurum.ad}" kurumunu pasif yapmak istediğinize emin misiniz?`
    )
    if (onay) {
      pasifYapMutation.mutate(kurum.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h1 className="text-xl font-semibold text-gray-100">Kurum Yönetimi</h1>
        <p className="mt-1 text-sm text-gray-400">Tüm kurumların abonelik durumları.</p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        {islemHata && (
          <p className="mb-4 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {islemHata}
          </p>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-gray-200" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error instanceof Error ? error.message : 'Kurumlar yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && kurumlar.length === 0 && (
          <p className="text-sm text-gray-400">Kayıtlı kurum bulunamadı.</p>
        )}

        {!isLoading && !error && kurumlar.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    Kurum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    Abonelik
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    Bitiş
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400">
                    Üye
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {kurumlar.map((kurum) => {
                  const uyeSayisi = kurum.profiles?.length ?? 0
                  return (
                    <tr key={kurum.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-100">
                        {kurum.ad}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            DURUM_RENK[kurum.abonelik_durumu] ?? 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {ABONELIK_DURUM_ETIKET[kurum.abonelik_durumu] ?? kurum.abonelik_durumu}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">
                        {kurum.abonelik_bitis
                          ? tarihFormatla(kurum.abonelik_bitis.slice(0, 10))
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-300">
                        {uyeSayisi}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDuzenlenenKurum(kurum)}
                            className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                          >
                            Abonelik Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => pasifYap(kurum)}
                            disabled={pasifYapMutation.isPending || kurum.abonelik_durumu === 'pasif'}
                            className="rounded-lg border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50"
                          >
                            Pasif Yap
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {duzenlenenKurum && (
        <AbonelikDuzenleModal
          kurum={duzenlenenKurum}
          onClose={() => setDuzenlenenKurum(null)}
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['superadmin-kurumlar'] })}
        />
      )}
    </div>
  )
}
