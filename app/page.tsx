import { Suspense } from "react"
import { HeroSection } from "@/components/landing/HeroSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { CTASection } from "@/components/landing/CTASection"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Header } from "@/components/landing/header"

export default function HomePage() {
  return (
    <main>
      <Header />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <div className="pt-16"></div>
        <HeroSection />
        {/* <FeaturesSection /> */}
        <HowItWorksSection />
        {/* <StatsSection /> */}
        <CTASection />
      </Suspense>
    </main>
  )
}
