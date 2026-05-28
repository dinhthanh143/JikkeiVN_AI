interface ErrorTextProps {
  message: string
  className?: string
}

export default function ErrorText({ message, className }: ErrorTextProps) {
  if (!message) {
    return null
  }

  return (
    <p role="alert" aria-live="polite" className={className ?? 'error-text'}>
      {message}
    </p>
  )
}