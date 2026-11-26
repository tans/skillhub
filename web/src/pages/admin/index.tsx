import { Link } from '@tanstack/react-router'
import { ArrowRight, Building2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { AdminNavigation } from '@/features/admin/admin-navigation'
import { Card } from '@/shared/ui/card'

export function AdminConsolePage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()

  return (
    <div className="space-y-8">
      <AdminNavigation />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t('adminConsole.title')}</h1>
        <p className="text-muted-foreground">{t('adminConsole.subtitle')}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-4 p-6">
          <Users aria-hidden="true" className="h-6 w-6" />
          <h2 className="text-xl font-semibold">{t('user.menu.users')}</h2>
          <p className="flex-1 text-sm leading-6 text-muted-foreground">{t('adminConsole.usersDescription')}</p>
          <Link to="/admin/users" className="inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {t('adminConsole.manageUsers')} <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Card>
        {hasRole('SUPER_ADMIN') ? (
          <Card className="flex flex-col gap-4 p-6">
            <Building2 aria-hidden="true" className="h-6 w-6" />
            <h2 className="text-xl font-semibold">{t('user.menu.namespacesAdmin')}</h2>
            <p className="flex-1 text-sm leading-6 text-muted-foreground">{t('adminConsole.namespacesDescription')}</p>
            <Link to="/admin/namespaces" className="inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              {t('adminConsole.manageNamespaces')} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
