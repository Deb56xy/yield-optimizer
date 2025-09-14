"use client"

import { motion } from "framer-motion"
import { Wallet, BarChart3, TrendingUp, CheckCircle } from "lucide-react"

const steps = [
  {
    icon: Wallet,
    title: "Connect Your Wallet",
    description:
      "Connect your Web3 wallet and deposit your crypto assets to start earning optimized yields across multiple chains.",
    step: "01",
  },
  {
    icon: BarChart3,
    title: "Smart Strategy Selection",
    description:
      "Our algorithms analyze real-time rates across Aave, Compound, and other protocols to find the best opportunities.",
    step: "02",
  },
  {
    icon: TrendingUp,
    title: "Auto-Optimization",
    description:
      "Your funds are automatically moved to the highest-yielding strategies while maintaining your risk preferences.",
    step: "03",
  },
  {
    icon: CheckCircle,
    title: "Earn & Compound",
    description: "Watch your yields compound automatically with real-time tracking and transparent fee structures.",
    step: "04",
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
            How{" "}
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              Yield Optimization
            </span>{" "}
            Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty">
            Our intelligent yield optimization system automatically finds and compounds the best DeFi rates across
            multiple chains.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-blue-500 transform translate-x-4" />
              )}

              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl border border-primary/20 mb-6">
                  <step.icon className="w-8 h-8 text-primary" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    {step.step}
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-4">{step.title}</h3>

                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="inline-flex items-center px-6 py-3 bg-accent/10 rounded-full border border-accent/20">
            <TrendingUp className="w-5 h-5 text-accent mr-3" />
            <span className="text-foreground font-medium">Up to 15% APY through intelligent optimization</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
