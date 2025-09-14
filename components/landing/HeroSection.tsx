"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Shield, Zap, Network, DollarSign, BarChart3, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import Link from "next/link"

export function HeroSection() {
  const [email, setEmail] = useState("")

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-white overflow-hidden">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#4A90E2] via-[#8B5CF6] via-[#F43F5E] to-transparent opacity-60 transform rotate-12 scale-150 origin-top-left blur-sm"
          style={{
            background: "linear-gradient(135deg, #4A90E2 0%, #8B5CF6 30%, #F43F5E 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#4A90E2]/40 via-[#8B5CF6]/40 via-[#F43F5E]/40 to-transparent transform rotate-12 scale-150 origin-top-left blur-md"
          style={{
            background: "linear-gradient(135deg, #4A90E2 0%, #8B5CF6 30%, #F43F5E 50%, transparent 70%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white from-40% via-70% to-90%" />
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 text-sm font-medium shadow-sm"
          >
            <TrendingUp className="w-4 h-4 mr-2 text-red-600" />
            Cross-chain yield optimizer
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight text-balance"
          >
            Maximize Your{" "}
            <span className="bg-gradient-to-r from-blue-600 to-rose-600 bg-clip-text text-transparent">
              DeFi Yields
            </span>
            <br />
            Across Chains
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-md md:text-md text-gray-900 max-w-4xl mx-auto leading-relaxed text-pretty"
          >
            Automatically optimize your crypto yields across multiple chains and protocols. Access the best rates from
            Aave, Compound, and other top DeFi platforms with intelligent cross-chain strategies.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-wrap justify-center gap-4 text-sm"
          >
            <div className="flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
              <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-gray-700">Auto-Compounding</span>
            </div>
            <div className="flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
              <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
              <span className="text-gray-700">Cross-Chain Bridge</span>
            </div>
            <div className="flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
              <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-gray-700">Best Rates</span>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
              <ConnectButton />
              <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white px-8 whitespace-nowrap shadow-lg">
                Get Early Access
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/demo">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white/80 backdrop-blur-sm shadow-sm"
                >
                  Try Demo
                </Button>
              </Link>
              <Link href="/bridge">
                <Button variant="ghost" size="lg" className="text-gray-600 hover:text-gray-900 hover:bg-white/50">
                  View Bridge
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto pt-12"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">12.5%</div>
              <div className="text-gray-600">Average APY</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">$2.4M</div>
              <div className="text-gray-600">Total Value Locked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">5</div>
              <div className="text-gray-600">Supported Chains</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
