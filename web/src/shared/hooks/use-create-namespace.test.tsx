// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { namespaceApi } from '@/api/client'
import { useCreateNamespace } from './use-namespace-queries'

vi.mock('@/api/client', () => ({ namespaceApi: { create: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('invalidates admin lists and personal namespaces after creation while retaining unrelated data', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const adminKey = ['admin', 'namespaces', { page: 0 }]
  const personalKey = ['namespaces', 'my']
  const usersKey = ['admin', 'users']
  client.setQueryData(adminKey, { total: 1 })
  client.setQueryData(personalKey, [])
  client.setQueryData(usersKey, { total: 8 })
  vi.mocked(namespaceApi.create).mockResolvedValue({
    id: 2, slug: 'new-team', displayName: 'New team', type: 'TEAM',
    status: 'ACTIVE', createdAt: '2026-11-26T10:00:00Z',
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useCreateNamespace(), { wrapper })
  await act(async () => {
    await result.current.mutateAsync({ slug: 'new-team', displayName: 'New team' })
  })
  expect(client.getQueryState(adminKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(personalKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(usersKey)?.isInvalidated).toBe(false)
  client.clear()
})
