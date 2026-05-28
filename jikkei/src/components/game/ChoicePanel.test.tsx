import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChoicePanel from './ChoicePanel'

describe('ChoicePanel submission recovery', () => {
  it('keeps choices available when submission fails', async () => {
    const user = userEvent.setup()
    render(
      <ChoicePanel
        choices={[{ id: '1', text: 'Stay here' }]}
        onSubmit={vi.fn().mockResolvedValue({ ok: false, message: 'No credits' })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /stay here/i }))
    expect(await screen.findByText('No credits')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stay here/i })).toBeEnabled()
  })

  it('closes only after a successful submission', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ChoicePanel
        choices={[{ id: '1', text: 'Continue' }]}
        onSubmit={vi.fn().mockResolvedValue({ ok: true })}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
