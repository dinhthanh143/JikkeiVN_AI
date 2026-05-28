import { useState } from 'react'

interface ExchangeSectionProps {
  title: string
  fromLabel: string
  toLabel: string
  rateLabel: string
  toCredits: (amount: number) => number
}

export default function ExchangeSection({ title, fromLabel, toLabel, rateLabel, toCredits }: ExchangeSectionProps) {
  const [amount, setAmount] = useState<number>(0)
  const preview = toCredits(amount)

  return (
    <div className="mkt-exchange-section">
      <h4 className="mkt-exchange-title">{title}</h4>
      <p className="mkt-exchange-rate">{rateLabel}</p>
      <div className="mkt-exchange-row">
        <label className="mkt-exchange-field">
          <span>{fromLabel}</span>
          <input
            type="number"
            min={0}
            className="mkt-exchange-input"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <span className="mkt-exchange-arrow">→</span>
        <div className="mkt-exchange-preview">
          <span>{toLabel}</span>
          <strong>{preview.toLocaleString()}</strong>
        </div>
      </div>
      <button type="button" className="mkt-buy-btn mkt-exchange-btn" disabled={amount <= 0} onClick={() => console.log('[mock exchange]', title, amount)}>
        Exchange
      </button>
    </div>
  )
}
