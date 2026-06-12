import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import TahsilatModal from '../../components/muhasebe/TahsilatModal'
import {
  paraFormatla,
  TAKSIT_DURUM_ETIKET,
  TAKSIT_DURUM_RENK,
  tarihFormatla,
} from '../../lib/muhasebe'
import { EMPTY_ARRAY } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import type { Sozlesme, Taksit } from '../../lib/types'

async function fetchSozlesme(id: string) {
  const { data, error } = await supabase
    .from('sozlesmeler')
    .select('*, ogrenciler(ad, soyad)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as Sozlesme
}

async function fetchTaksitler(sozlesmeId: string) {
  const { data, error } = await supabase
    .from('taksitler')
    .select('*')
    .eq('sozlesme_id', sozlesmeId)
    .order('taksit_no')

  if (error) throw error
  return (data as Taksit[]) ?? []
}

type TaksitDuzenleme = {
  tutar: string
  vade_tarihi: string
}

function TahsilatButonu({ taksit, onTahsilat }: { taksit: Taksit; onTahsilat: () => void }) {
  if (taksit.durum === 'odendi') {
    return (
      <button
        type="button"
        disabled
        className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-600"
      >
        Ödendi
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onTahsilat}
      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      Tahsilat Al
    </button>
  )
}

function SerbestTaksitSatiri({
  taksit,
  onKaydet,
  onTahsilat,
  kaydediliyor,
}: {
  taksit: Taksit
  onKaydet: (id: string, tutar: number, vadeTarihi: string) => void
  onTahsilat: () => void
  kaydediliyor: boolean
}) {
  const [duzenleme, setDuzenleme] = useState<TaksitDuzenleme>({
    tutar: String(taksit.tutar),
    vade_tarihi: taksit.vade_tarihi,
  })

  const degisti =
    Number(duzenleme.tutar) !== taksit.tutar || duzenleme.vade_tarihi !== taksit.vade_tarihi

  return (
    <>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{taksit.taksit_no}</td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={duzenleme.vade_tarihi}
          onChange={(e) => setDuzenleme((p) => ({ ...p, vade_tarihi: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={duzenleme.tutar}
          onChange={(e) => setDuzenleme((p) => ({ ...p, tutar: e.target.value }))}
          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-slate-500"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">
        {paraFormatla(taksit.gecikme_ucreti)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TAKSIT_DURUM_RENK[taksit.durum]}`}
        >
          {TAKSIT_DURUM_ETIKET[taksit.durum]}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex gap-2">
          {degisti && (
            <button
              type="button"
              onClick={() => onKaydet(taksit.id, Number(duzenleme.tutar), duzenleme.vade_tarihi)}
              disabled={kaydediliyor}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Kaydet
            </button>
          )}
          <TahsilatButonu taksit={taksit} onTahsilat={onTahsilat} />
        </div>
      </td>
    </>
  )
}

function SabitTaksitSatiri({ taksit, onTahsilat }: { taksit: Taksit; onTahsilat: () => void }) {
  return (
    <>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{taksit.taksit_no}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
        {tarihFormatla(taksit.vade_tarihi)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-900">
        {paraFormatla(taksit.tutar)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">
        {paraFormatla(taksit.gecikme_ucreti)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TAKSIT_DURUM_RENK[taksit.durum]}`}
        >
          {TAKSIT_DURUM_ETIKET[taksit.durum]}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <TahsilatButonu taksit={taksit} onTahsilat={onTahsilat} />
      </td>
    </>
  )
}

export default function SozlesmeDetay() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [taksitHata, setTaksitHata] = useState<string | null>(null)
  const [tahsilatTaksit, setTahsilatTaksit] = useState<Taksit | null>(null)

  const {
    data: sozlesme,
    isLoading: sozlesmeLoading,
    error: sozlesmeError,
  } = useQuery({
    queryKey: ['sozlesmeler', id],
    queryFn: () => fetchSozlesme(id!),
    enabled: Boolean(id),
  })

  const {
    data: taksitlerData,
    isLoading: taksitlerLoading,
    error: taksitlerError,
  } = useQuery({
    queryKey: ['taksitler', id],
    queryFn: () => fetchTaksitler(id!),
    enabled: Boolean(id),
  })
  const taksitler = taksitlerData ?? EMPTY_ARRAY

  const taksitToplam = useMemo(
    () => taksitler.reduce((acc, t) => acc + Number(t.tutar), 0),
    [taksitler]
  )

  const toplamEslesiyor = sozlesme
    ? Math.abs(taksitToplam - sozlesme.net_tutar) < 0.01
    : false

  const taksitGuncelleMutation = useMutation({
    mutationFn: async ({
      taksitId,
      tutar,
      vadeTarihi,
    }: {
      taksitId: string
      tutar: number
      vadeTarihi: string
    }) => {
      const { error } = await supabase
        .from('taksitler')
        .update({ tutar, vade_tarihi: vadeTarihi })
        .eq('id', taksitId)

      if (error) throw error
    },
    onSuccess: async () => {
      setTaksitHata(null)
      await queryClient.invalidateQueries({ queryKey: ['taksitler', id] })
    },
    onError: (error) => {
      setTaksitHata(error instanceof Error ? error.message : 'Taksit güncellenemedi.')
    },
  })

  const tahsilatBasarili = async () => {
    await queryClient.invalidateQueries({ queryKey: ['taksitler', id] })
  }

  const yukleniyor = sozlesmeLoading || taksitlerLoading
  const hata = sozlesmeError || taksitlerError

  if (!id) {
    return <p className="text-sm text-red-700">Geçersiz sözleşme.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link to="/muhasebe/sozlesmeler" className="hover:text-slate-900">
          ← Sözleşmeler
        </Link>
      </div>

      {yukleniyor && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        </div>
      )}

      {hata && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {hata instanceof Error ? hata.message : 'Veriler yüklenemedi.'}
        </p>
      )}

      {!yukleniyor && !hata && sozlesme && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Sözleşme Detayı</h1>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Öğrenci</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {sozlesme.ogrenciler
                    ? `${sozlesme.ogrenciler.ad} ${sozlesme.ogrenciler.soyad}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dönem</dt>
                <dd className="mt-1 text-sm text-slate-900">{sozlesme.donem}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Taksit Tipi</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {sozlesme.taksit_tipi === 'sabit' ? 'Sabit' : 'Serbest'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Brüt Tutar</dt>
                <dd className="mt-1 text-sm text-slate-900">{paraFormatla(sozlesme.brut_tutar)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">İndirim</dt>
                <dd className="mt-1 text-sm text-slate-900">{paraFormatla(sozlesme.indirim_tutari)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Net Tutar</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {paraFormatla(sozlesme.net_tutar)}
                </dd>
              </div>
            </dl>

            {sozlesme.notlar && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notlar</p>
                <p className="mt-1 text-sm text-slate-700">{sozlesme.notlar}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Taksit Planı</h2>

            {taksitHata && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {taksitHata}
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Vade
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Tutar
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Gecikme
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Durum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {taksitler.map((taksit) => (
                    <tr key={taksit.id}>
                      {sozlesme.taksit_tipi === 'serbest' ? (
                        <SerbestTaksitSatiri
                          key={`${taksit.id}-${taksit.tutar}-${taksit.vade_tarihi}-${taksit.durum}`}
                          taksit={taksit}
                          kaydediliyor={taksitGuncelleMutation.isPending}
                          onKaydet={(taksitId, tutar, vadeTarihi) =>
                            taksitGuncelleMutation.mutate({ taksitId, tutar, vadeTarihi })
                          }
                          onTahsilat={() => setTahsilatTaksit(taksit)}
                        />
                      ) : (
                        <SabitTaksitSatiri
                          taksit={taksit}
                          onTahsilat={() => setTahsilatTaksit(taksit)}
                        />
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sozlesme.taksit_tipi === 'serbest' && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 ${
                  toplamEslesiyor
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p className="text-sm text-slate-700">
                  Taksit toplamı:{' '}
                  <span className="font-semibold">{paraFormatla(taksitToplam)}</span>
                  {' / '}
                  Net tutar:{' '}
                  <span className="font-semibold">{paraFormatla(sozlesme.net_tutar)}</span>
                </p>
                {!toplamEslesiyor && (
                  <p className="mt-1 text-sm text-amber-800">
                    Taksit tutarları toplamı net tutarla eşleşmiyor.
                  </p>
                )}
                {toplamEslesiyor && (
                  <p className="mt-1 text-sm text-emerald-800">Taksit toplamı net tutarla eşleşiyor.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tahsilatTaksit && sozlesme && (
        <TahsilatModal
          taksit={tahsilatTaksit}
          sozlesme={sozlesme}
          onClose={() => setTahsilatTaksit(null)}
          onSuccess={() => void tahsilatBasarili()}
        />
      )}
    </div>
  )
}
