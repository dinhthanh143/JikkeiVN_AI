import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { PRIVACY_BODY_MARKDOWN, PRIVACY_VERSION } from '@/content/legal/legalDocuments'

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      eyebrow="// PRIVACY_POLICY"
      version={PRIVACY_VERSION}
      markdown={PRIVACY_BODY_MARKDOWN}
      backLabel="Back to Signup"
      backPath="/auth"
    />
  )
}