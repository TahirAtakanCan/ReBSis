import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../lib/auth'
import { EMPTY_ARRAY } from '../lib/constants'
import { supabase } from '../lib/supabase'

type Sinif = {
  id: string
  kurum_id: string
  ad: string
  sorumlu_ogretmen_id: string | null
  created_at: string
}

async function fetchSiniflar() {
  const { data, error } = await supabase.from('siniflar').select('*').order('ad')

  if (error) {
    throw error
  }

  return (data as Sinif[]) ?? []
}

export default function Siniflar() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [sinifAdi, setSinifAdi] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const {
    data: siniflarData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['siniflar'],
    queryFn: fetchSiniflar,
  })
  const siniflar = siniflarData ?? EMPTY_ARRAY

  const createMutation = useMutation({
    mutationFn: async (ad: string) => {
      if (!profile?.kurum_id) {
        throw new Error('Kurum bilgisi bulunamadı. Önce onboarding tamamlanmalı.')
      }

      const { error: insertError } = await supabase.from('siniflar').insert({
        ad,
        kurum_id: profile.kurum_id,
      })

      if (insertError) {
        throw insertError
      }
    },
    onSuccess: async () => {
      setSinifAdi('')
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ['siniflar'] })
    },
    onError: (mutationError) => {
      setFormError(
        mutationError instanceof Error ? mutationError.message : 'Sınıf eklenirken hata oluştu.'
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('siniflar').delete().eq('id', id)

      if (deleteError) {
        throw deleteError
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['siniflar'] })
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = sinifAdi.trim()

    if (!trimmedName) {
      setFormError('Sınıf adı zorunludur.')
      return
    }

    createMutation.mutate(trimmedName)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Sınıflar</h1>
        <p className="mt-1 text-sm text-slate-600">Kurumuna ait sınıfları yönet.</p>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <input
            type="text"
            value={sinifAdi}
            onChange={(event) => setSinifAdi(event.target.value)}
            placeholder="Sınıf adı"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? 'Ekleniyor...' : 'Sınıf Ekle'}
          </button>
        </form>

        {formError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sınıf Listesi</h2>

        {isLoading && <p className="mt-4 text-sm text-slate-600">Sınıflar yükleniyor...</p>}

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Sınıflar yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && siniflar.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Henüz sınıf eklenmedi.</p>
        )}

        {!isLoading && !error && siniflar.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-200">
            {siniflar.map((sinif) => (
              <li key={sinif.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-slate-800">{sinif.ad}</span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(sinif.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
