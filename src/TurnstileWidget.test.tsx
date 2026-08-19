// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurnstileWidget } from './TurnstileWidget.tsx'

let container: HTMLDivElement | null = null

afterEach(() => {
  container?.remove()
  container = null
  delete window.turnstile
})

describe('TurnstileWidget lifecycle', () => {
  it('renders, reports token/status, resets and removes the widget', async () => {
    const api = {
      render: vi.fn((_element: HTMLElement, _options: unknown) => 'widget-1'),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    window.turnstile = api
    const onToken = vi.fn()
    const onStatus = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <TurnstileWidget
        siteKey="public-site-key"
        theme="light"
        resetVersion={0}
        retryVersion={0}
        onToken={onToken}
        onStatus={onStatus}
      />,
    ))

    expect(api.render).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenCalledWith('ready')
    const options = api.render.mock.calls[0]?.[1] as {
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
    options.callback('fresh-token')
    expect(onToken).toHaveBeenCalledWith('fresh-token')
    options['expired-callback']()
    options['error-callback']()
    expect(onStatus).toHaveBeenCalledWith('error')

    await act(async () => root.render(
      <TurnstileWidget
        siteKey="public-site-key"
        theme="light"
        resetVersion={1}
        retryVersion={0}
        onToken={onToken}
        onStatus={onStatus}
      />,
    ))
    expect(api.reset).toHaveBeenCalledWith('widget-1')

    await act(async () => root.render(
      <TurnstileWidget
        siteKey="public-site-key"
        theme="light"
        resetVersion={1}
        retryVersion={1}
        onToken={onToken}
        onStatus={onStatus}
      />,
    ))
    expect(api.render).toHaveBeenCalledTimes(2)

    await act(async () => root.unmount())
    expect(api.remove).toHaveBeenCalledWith('widget-1')
  })
})
