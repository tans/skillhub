// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { sitePresentationApi } from '@/api/site-presentation'
import { useSitePresentation } from './use-site-presentation'

vi.mock('@/api/site-presentation', () => ({ sitePresentationApi: { get: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks() })

function renderPresentation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { ...renderHook(() => useSitePresentation(), { wrapper }), client }
}

it('uses defaults without requesting an unsupported endpoint in an explicit legacy build', async () => {
  vi.stubEnv('VITE_SITE_PRESENTATION_ENABLED', 'false')
  const { result, client } = renderPresentation()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(sitePresentationApi.get).not.toHaveBeenCalled()
  expect(result.current.settings.sections.hero.enabled).toBe(true)
  client.clear()
})

it('keeps failures visible in builds that use the presentation endpoint', async () => {
  vi.stubEnv('VITE_SITE_PRESENTATION_ENABLED', 'true')
  vi.mocked(sitePresentationApi.get).mockRejectedValue(new Error('Unavailable'))
  const { result, client } = renderPresentation()
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(sitePresentationApi.get).toHaveBeenCalledOnce()
  client.clear()
})
