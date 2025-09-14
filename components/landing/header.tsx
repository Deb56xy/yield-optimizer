"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import Link from "next/link"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo.png" className="w-12 h-12 rounded-xl"/>
            <span className="font-semibold text-gray-900">Yield Optimizer</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/demo" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Demo
            </Link>
            <Link href="/bridge" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Bridge
            </Link>
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            <ConnectButton />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Link href="/demo" className="text-gray-600 hover:text-gray-900 font-medium text-sm mr-4">
              Demo
            </Link>
            <Link href="/bridge" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
              Bridge
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
