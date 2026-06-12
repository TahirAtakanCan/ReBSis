import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { EMPTY_ARRAY } from '../../lib/constants'
import { paraFormatla, tarihFormatla } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { Sozlesme } from '../../lib/types'
import SozlesmeForm from './SozlesmeForm'

async function fetchSozlesmeler() {
  const { data, error } = await supabase
    .from('sozlesmeler')
    .select('*, ogrenciler(ad, soyad)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as Sozlesme[]) ?? []
}

export default function SozlesmeListesi() {
  const navigate = useNavigate()
  const [formAcik, setFormAcik] = useState(false)

  const { data: sozlesmelerData, isLoading, error } = useQuery({
    queryKey: ['sozlesmeler'],
    queryFn: fetchSozlesmeler,
  })
  const sozlesmeler = sozlesmelerData ?? EMPTY_ARRAY

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Sözleşmeler</h1>
            <p className="mt-1 text-sm text-slate-600">Öğrenci sözleşmeleri ve taksit planları.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Yeni Sözleşme
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sözleşme Listesi</h2>

        {isLoading && (
          <div className="mt-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Sözleşmeler yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && sozlesmeler.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Henüz sözleşme oluşturulmadı.</p>
        )}

        {!isLoading && !error && sozlesmeler.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Öğrenci
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Dönem
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Net Tutar
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Taksit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Oluşturulma
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {sozlesmeler.map((sozlesme) => (
                  <tr
                    key={sozlesme.id}
                    onClick={() => navigate(`/muhasebe/sozlesmeler/${sozlesme.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                      {sozlesme.ogrenciler
                        ? `${sozlesme.ogrenciler.ad} ${sozlesme.ogrenciler.soyad}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{sozlesme.donem}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-900">
                      {paraFormatla(sozlesme.net_tutar)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">
                      {sozlesme.taksit_sayisi}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {tarihFormatla(sozlesme.created_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formAcik && (
        <SozlesmeForm
          onClose={() => setFormAcik(false)}
          onSuccess={(id) => {
            setFormAcik(false)
            navigate(`/muhasebe/sozlesmeler/${id}`)
          }}
        />
      )}
    </div>
  )
}
