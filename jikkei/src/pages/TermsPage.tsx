import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { TERMS_BODY_MARKDOWN, TERMS_VERSION } from '@/content/legal/legalDocuments'

export default function TermsPage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      eyebrow="// TERMS_OF_SERVICE"
      version={TERMS_VERSION}
      markdown={TERMS_BODY_MARKDOWN}
      backLabel="Back to Signup"
      backPath="/auth"
    />
  )
}