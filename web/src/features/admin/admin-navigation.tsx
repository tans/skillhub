import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { cn } from '@/shared/lib/utils'

/** Shared navigation keeps account and namespace administration together. */
export function AdminNavigation() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const links = [
    { to: '/admin', label: t('adminConsole.overview') },
    { to: '/admin/users', label: t('user.menu.users') },
    ...(hasRole('SUPER_ADMIN')
      ? [{ to: '/admin/namespaces', label: t('user.menu.namespacesAdmin') }]
      : []),
  ] as const

  return (
    <nav aria-label={t('adminConsole.title')} className="flex flex-wrap gap-2 border-b pb-4">
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true }}
          className={cn('rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring')}
          activeProps={{ className: 'bg-secondary text-foreground', 'aria-current': 'page' }}
          inactiveProps={{ className: 'text-muted-foreground' }}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
