import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../../lib/auth'

const menuItems = [
  { to: '/superadmin/kurumlar', label: 'Kurumlar', end: false },
  { to: '/superadmin/log', label: 'Log', end: false },
]

export default function SuperAdminLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen bg-gray-900">
      <aside className="w-56 border-r border-gray-700 bg-gray-800 p-4">
        <h1 className="mb-6 text-lg font-semibold text-gray-100">ReBSis Admin</h1>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
          <p className="text-sm text-gray-400">Süper-admin paneli</p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
            >
              Çıkış
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
