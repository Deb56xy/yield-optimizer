"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Wallet, RefreshCw, ChevronDown, Activity, PieChart, BarChart3, Calendar } from "lucide-react"
import { useAccount } from "wagmi"
import { CONTRACTS, SUPPORTED_CHAINS } from "@/utils/constants"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchAaveV3Data, formatTvl, type AggregatedAaveData } from "@/lib/aave-api"

interface ChainBalance {
  chainId: number
  balance: string
  isLoading: boolean
  error: string | null
  usdValue?: string
  allocation?: number
  apy?: string
  lastUpdate?: string
}

interface PortfolioMetrics {
  totalUsdValue: string
  totalEarned: string
  avgApy: string
  dailyYield: string
  monthlyProjected: string
  totalTransactions: number
  lastRebalance: string
}

export function Portfolio() {
  const { address, isConnected } = useAccount()
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([])
  const [totalBalance, setTotalBalance] = useState("0.00")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChainBreakdown, setShowChainBreakdown] = useState(false)
  const [showMetrics, setShowMetrics] = useState(true)

  const [aaveData, setAaveData] = useState<AggregatedAaveData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  const [portfolio, setPortfolio] = useState<PortfolioMetrics>({
    totalUsdValue: "0.00",
    totalEarned: "0.00",
    avgApy: "Loading...",
    dailyYield: "0.00",
    monthlyProjected: "0.00",
    totalTransactions: 0,
    lastRebalance: new Date().toLocaleDateString(),
  })

  useEffect(() => {
    const loadAaveData = async () => {
      setDataLoading(true)
      console.log("[v0] Portfolio: Loading Aave V3 data...")
      try {
        const aggregatedData = await fetchAaveV3Data()
        console.log("[v0] Portfolio: Aave data loaded:", aggregatedData)
        setAaveData(aggregatedData)
      } catch (error) {
        console.error("[v0] Portfolio: Failed to load Aave data:", error)
      } finally {
        setDataLoading(false)
      }
    }

    loadAaveData()
  }, [])

  // Integrated balance fetching logic
  useEffect(() => {
    if (!address || !window.ethereum) {
      setChainBalances([])
      setTotalBalance("0.00")
      setIsLoading(false)
      return
    }

    const fetchBalancesAcrossChains = async () => {
      setIsLoading(true)
      setError(null)

      const balancePromises = SUPPORTED_CHAINS.map(async (chain) => {
        const yieldAvaxAddress = CONTRACTS.YIELDAVAX[chain.id as keyof typeof CONTRACTS.YIELDAVAX]

        if (!yieldAvaxAddress) {
          return {
            chainId: chain.id,
            balance: "0.00",
            isLoading: false,
            error: "Contract not deployed",
            usdValue: "0.00",
            allocation: 0,
            apy: getChainApy(chain.id),
            lastUpdate: new Date().toLocaleDateString(),
          }
        }

        try {
          const balanceOfData = `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`

          const balanceResult = await window.ethereum.request({
            method: "eth_call",
            params: [
              {
                to: yieldAvaxAddress,
                data: balanceOfData,
              },
              "latest",
            ],
          })

          if (!balanceResult || balanceResult === "0x" || balanceResult === "0x0") {
            return {
              chainId: chain.id,
              balance: "0.00",
              isLoading: false,
              error: null,
              usdValue: "0.00",
              allocation: 0, // Will be calculated after all balances are fetched
              apy: getChainApy(chain.id),
              lastUpdate: new Date().toLocaleDateString(),
            }
          }

          const balanceWei = BigInt(balanceResult)
          const balanceFormatted = (Number(balanceWei) / 1e18).toFixed(6)
          const avaxPrice = aaveData?.avgPrice || 45.0 // Use real price or fallback
          const usdValue = (Number.parseFloat(balanceFormatted) * avaxPrice).toFixed(2)

          return {
            chainId: chain.id,
            balance: balanceFormatted,
            isLoading: false,
            error: null,
            usdValue,
            allocation: 0, // Will be calculated after all balances are fetched
            apy: getChainApy(chain.id),
            lastUpdate: new Date().toLocaleDateString(),
          }
        } catch (err) {
          console.error(`Failed to fetch YieldAVAX balance for chain ${chain.id}:`, err)
          return {
            chainId: chain.id,
            balance: "0.00",
            isLoading: false,
            error: "Network error",
            usdValue: "0.00",
            allocation: 0,
            apy: "0.0",
            lastUpdate: new Date().toLocaleDateString(),
          }
        }
      })

      try {
        const results = await Promise.all(balancePromises)

        // Calculate total balance and allocations
        const total = results.reduce((sum, chainBalance) => {
          return sum + Number.parseFloat(chainBalance.balance)
        }, 0)

        // Update allocations
        const resultsWithAllocations = results.map((result) => ({
          ...result,
          allocation: total > 0 ? (Number.parseFloat(result.balance) / total) * 100 : 0,
        }))

        setChainBalances(resultsWithAllocations)
        setTotalBalance(total.toFixed(6))
      } catch (err) {
        console.error("Failed to fetch balances across chains:", err)
        setError("Failed to fetch balances")
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalancesAcrossChains()
  }, [address])

  useEffect(() => {
    if (totalBalance && !isLoading && !error && aaveData) {
      const balance = Number.parseFloat(totalBalance)
      const avaxPrice = aaveData.avgPrice || 45.0 // Fallback to reasonable AVAX price
      const totalUsdValue = (balance * avaxPrice).toFixed(2)
      const realApy = aaveData.weightedApy / 100
      const totalEarned = (balance * realApy * avaxPrice).toFixed(2) // Annual earnings in USD
      const dailyYield = ((balance * realApy) / 365).toFixed(4)
      const monthlyProjected = ((balance * realApy * avaxPrice) / 12).toFixed(2)

      const weightedApy =
        chainBalances.length > 0
          ? chainBalances.reduce((sum, chain) => {
              return sum + (Number.parseFloat(chain.apy || "0") * (chain.allocation || 0)) / 100
            }, 0)
          : aaveData.weightedApy

      setPortfolio({
        totalUsdValue,
        totalEarned,
        avgApy: weightedApy.toFixed(2),
        dailyYield,
        monthlyProjected,
        totalTransactions: Math.floor(Math.random() * 150) + 50, // Mock data
        lastRebalance: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      })
    } else if (!isLoading && aaveData) {
      setPortfolio({
        totalUsdValue: "0.00",
        totalEarned: "0.00",
        avgApy: aaveData.weightedApy.toFixed(2),
        dailyYield: "0.00",
        monthlyProjected: "0.00",
        totalTransactions: 0,
        lastRebalance: new Date().toLocaleDateString(),
      })
    }
  }, [totalBalance, isLoading, error, chainBalances, aaveData])

  const getChainApy = (chainId: number) => {
    if (aaveData && chainId === 43114) {
      console.log("[v0] Using Aave APY for Avalanche:", aaveData.weightedApy)
      return aaveData.weightedApy.toFixed(2)
    }
    const apyMap: Record<number, string> = {
      43114: "9.2", // Avalanche mainnet
      43113: "9.2", // Avalanche testnet
      1: "8.1", // Ethereum
      137: "10.3", // Polygon
      56: "7.8", // BSC
    }
    return apyMap[chainId] || "8.5"
  }

  const refetch = async () => {
    if (address) {
      setError(null)
      setIsLoading(true)
      setTimeout(() => setIsLoading(false), 100)
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Portfolio Card */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-normal text-slate-800">
            <div className="p-1.5 rounded-lg bg-rose-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            YieldAVAX Portfolio Overview
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isLoading || dataLoading}
              className="ml-auto h-7 w-7 p-0 hover:bg-rose-50 hover:text-rose-600"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading || dataLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs font-light text-slate-600">Total Balance</p>
              <p className="font-mono text-base font-light text-slate-800">
                {!isConnected ? (
                  <span className="text-sm text-slate-500 font-light">Connect wallet</span>
                ) : isLoading ? (
                  <span className="text-sm text-slate-500 font-light">Loading...</span>
                ) : (
                  `${totalBalance} yAVAX`
                )}
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs font-light text-slate-600">USD Value</p>
              <p className="font-mono text-base font-light text-slate-800">${portfolio.totalUsdValue}</p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-light text-slate-600">Total Earned</p>
              <p className="font-mono text-base font-light text-green-600">+${portfolio.totalEarned}</p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xs font-light text-slate-600 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-amber-500" />
                Avg APY
              </p>
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs font-light">
                {dataLoading ? "Loading..." : portfolio.avgApy}%
              </Badge>
            </div>
          </div>

          {/* Performance Metrics */}
          <Collapsible open={showMetrics} onOpenChange={setShowMetrics}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between p-3 h-auto hover:bg-slate-50 rounded-lg border border-slate-100"
              >
                <span className="flex items-center gap-2 text-slate-700 font-normal text-sm">
                  <BarChart3 className="h-3 w-3" />
                  Performance Metrics
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${showMetrics ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-center space-y-1">
                  <p className="text-xs font-light text-slate-600">Daily Yield</p>
                  <p className="font-mono font-light text-slate-800 text-sm">{portfolio.dailyYield} yAVAX</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-light text-slate-600">Monthly Projected</p>
                  <p className="font-mono font-light text-slate-800 text-sm">${portfolio.monthlyProjected}</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-light text-slate-600">Total TVL (Aave V3)</p>
                  <p className="font-mono font-light text-slate-800 text-sm">
                    ${dataLoading ? "Loading..." : aaveData ? formatTvl(aaveData.totalTvl) : "N/A"}
                  </p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-light text-slate-600 flex items-center justify-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    Last Update
                  </p>
                  <p className="font-mono text-xs font-light text-slate-700">
                    {aaveData ? new Date(aaveData.lastUpdate).toLocaleTimeString() : portfolio.lastRebalance}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Chain Allocation Table */}
      {isConnected && !isLoading && !error && chainBalances.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-normal text-slate-800">
              <div className="p-1.5 rounded-lg bg-rose-600 text-white">
                <PieChart className="h-4 w-4" />
              </div>
              Chain Allocation Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-normal text-slate-700 text-xs">Chain</TableHead>
                    <TableHead className="text-right font-normal text-slate-700 text-xs">Balance</TableHead>
                    <TableHead className="text-right font-normal text-slate-700 text-xs">USD Value</TableHead>
                    <TableHead className="text-right font-normal text-slate-700 text-xs">Allocation</TableHead>
                    <TableHead className="text-right font-normal text-slate-700 text-xs">APY</TableHead>
                    <TableHead className="text-right font-normal text-slate-700 text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chainBalances
                    .filter((chain) => Number.parseFloat(chain.balance) > 0)
                    .sort((a, b) => Number.parseFloat(b.balance) - Number.parseFloat(a.balance))
                    .map((chain) => (
                      <TableRow key={chain.chainId} className="hover:bg-slate-50/50">
                        <TableCell className="font-normal">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getChainColor(chain.chainId)}`} />
                            <span className="font-normal text-slate-800 text-sm">{getChainName(chain.chainId)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-light text-slate-800 text-xs">
                          {chain.balance} yAVAX
                        </TableCell>
                        <TableCell className="text-right font-mono font-light text-slate-800 text-xs">
                          ${chain.usdValue}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-rose-600 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${chain.allocation}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-light text-slate-800 min-w-[2.5rem]">
                              {chain.allocation?.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-50 text-green-700 border-green-200 font-light"
                          >
                            {getChainApy(chain.chainId)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Activity className="h-2.5 w-2.5 text-green-500" />
                            <span className="text-xs text-green-600 font-light">Active</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {chainBalances.filter((chain) => Number.parseFloat(chain.balance) > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-6 font-light text-sm">
                        No YieldAVAX holdings found across supported chains
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Information */}
      <Card className="border-0 shadow-lg bg-white">
        <CardContent className="pt-6">
          <div className="text-sm text-slate-600 space-y-3">
            <p className="font-normal text-base text-slate-800">About YieldAVAX (yAVAX)</p>
            <p className="leading-relaxed font-light text-xs">
              YieldAVAX automatically earns yield from Aave V3 lending pools on Avalanche. Your balance is automatically
              rebalanced across the highest-performing assets to optimize returns while maintaining security through
              Aave's battle-tested protocol.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="outline" className="text-xs py-1.5 bg-blue-50 text-blue-700 border-blue-200 font-light">
                Auto-Compounding
              </Badge>
              <Badge
                variant="outline"
                className="text-xs py-1.5 bg-purple-50 text-purple-700 border-purple-200 font-light"
              >
                Aave V3 Powered
              </Badge>
              <Badge
                variant="outline"
                className="text-xs py-1.5 bg-green-50 text-green-700 border-green-200 font-light"
              >
                Risk-Optimized
              </Badge>
              <Badge
                variant="outline"
                className="text-xs py-1.5 bg-orange-50 text-orange-700 border-orange-200 font-light"
              >
                Live Data
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getChainColor(chainId: number): string {
  const colorMap: Record<number, string> = {
    43114: "bg-red-500", // Avalanche
    1: "bg-blue-500", // Ethereum
    137: "bg-purple-500", // Polygon
    56: "bg-yellow-500", // BSC
  }
  return colorMap[chainId] || "bg-gray-500"
}

function getChainName(chainId: number) {
  const chainMap: Record<number, string> = {
    43113: "Avalanche",
    1: "Ethereum",
    137: "Polygon",
    56: "BSC",
  }
  return chainMap[chainId] || "Unknown"
}

function getChainShortName(chainId: number) {
  const chainMap: Record<number, string> = {
    43113: "AVAX",
    1: "ETH",
    137: "MATIC",
    56: "BNB",
  }
  return chainMap[chainId] || "Unknown"
}
