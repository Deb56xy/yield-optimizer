"use client"

import { useState } from "react"
import { DepositCard } from "@/components/DepositCard"
import { Portfolio } from "@/components/Portfolio"
import { Strategy } from "@/components/Strategy"
import { WithdrawCard } from "@/components/Withdraw"

export default function Demo() {
  const [activeAction, setActiveAction] = useState<"deposit" | "withdraw">("deposit")

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-5 gap-8 h-[calc(100vh-4rem)]">
          <div className="col-span-2 space-y-6">
            {/* Action Selection Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveAction("deposit")}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                  activeAction === "deposit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveAction("withdraw")}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                  activeAction === "withdraw" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Conditional Action Card Display */}
            <div className="h-fit">{activeAction === "deposit" ? <DepositCard /> : <WithdrawCard />}</div>
          </div>

          <div className="col-span-3 space-y-4 overflow-y-auto">
            <div className="space-y-4">
              <Portfolio />
              <Strategy />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
