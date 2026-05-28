import { PageWrapper, Navbar } from '@/components/layout'

export default function ExplorePage() {
  return (
    <PageWrapper>
      <Navbar title="Explore" />
      <div className="px-6 py-12">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-jikkei-accent mb-4">Explore Stories</h2>
          <p className="text-jikkei-pink-300">This page is under development</p>
        </div>
      </div>
    </PageWrapper>
  )
}
