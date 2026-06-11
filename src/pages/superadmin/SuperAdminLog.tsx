import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import { tarihFormatla } from '../../lib/muhasebe'

type SuperAdminLogKaydi = {
  id: string
  yapan_id: string
  islem: string
  detay: Record<string, unknown> | null
  created_at: string
}

async function fetchSuperAdminLog() {
  const { data, error } = await supabase
    .from('superadmin_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data as SuperAdminLogKaydi[]) ?? []
}

export default function SuperAdminLog() {
  const { data: kayitlar = [], isLoading, error } = useQuery({
    queryKey: ['superadmin-log'],
    queryFn: fetchSuperAdminLog,
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h1 className="text-xl font-semibold text-gray-100">Süper-admin Log</h1>
        <p className="mt-1 text-sm text-gray-400">Yönetim işlemleri geçmişi.</p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-gray-200" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error instanceof Error ? error.message : 'Log yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && kayitlar.length === 0 && (
          <p className="text-sm text-gray-400">Henüz log kaydı yok.</p>
        )}

        {!isLoading && !error && kayitlar.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    İşlem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    Detay
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {kayitlar.map((kayit) => (
                  <tr key={kayit.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">
                      {tarihFormatla(kayit.created_at.slice(0, 10))}
                      <span className="ml-1 text-gray-500">
                        {new Date(kayit.created_at).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-100">
                      {kayit.islem}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-gray-400">
                      <code className="break-all">
                        {kayit.detay ? JSON.stringify(kayit.detay) : '—'}
                      </code>
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
