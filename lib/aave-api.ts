import axios from "axios"

export interface AavePoolData {
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apyBase: number
  apyReward: number | null
  apy: number
  rewardTokens: string[] | null
  pool: string
  apyPct1D: number
  apyPct7D: number
  apyPct30D: number
  stablecoin: boolean
  ilRisk: string
  exposure: string
  predictions: {
    predictedClass: string
    predictedProbability: number
    binnedConfidence: number
  }
  poolMeta: any
  mu: number
  sigma: number
  count: number
  outlier: boolean
  underlyingTokens: string[]
  il7d: number | null
  apyBase7d: number | null
  apyMean30d: number
  volumeUsd1d: number | null
  volumeUsd7d: number | null
  apyBaseInception: number | null
}

export interface AggregatedAaveData {
  totalTvl: number
  weightedApy: number
  pools: AavePoolData[]
  lastUpdate: string
}

export async function fetchAaveV3Data(): Promise<AggregatedAaveData> {
  try {
    console.log("[v0] Fetching Aave V3 data from API...")
    const response = await axios.get("https://yields.llama.fi/pools")
    const allPools = response.data.data || []

    console.log("[v0] Total pools received:", allPools.length)

    // Filter for Aave V3 on Avalanche
    const aavePools = allPools.filter((pool: AavePoolData) => pool.project === "aave-v3" && pool.chain === "Avalanche")

    console.log("[v0] Aave V3 Avalanche pools found:", aavePools.length)
    console.log("[v0] Sample pool data:", aavePools[0])

    if (aavePools.length === 0) {
      throw new Error("No Aave V3 pools found on Avalanche")
    }

    // Calculate aggregated metrics
    const totalTvl = aavePools.reduce((sum: number, pool: AavePoolData) => sum + pool.tvlUsd, 0)
    const weightedApy = aavePools.reduce((sum: number, pool: AavePoolData) => {
      const weight = pool.tvlUsd / totalTvl
      return sum + pool.apy * weight
    }, 0)

    console.log("[v0] Calculated metrics:", { totalTvl, weightedApy })

    return {
      totalTvl,
      weightedApy,
      pools: aavePools,
      lastUpdate: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[v0] Failed to fetch Aave V3 data:", error)
    throw error
  }
}

export async function fetchUSDCPool(): Promise<AavePoolData | null> {
  try {
    console.log("[v0] Fetching USDC pool data...")
    const response = await axios.get("https://yields.llama.fi/pools")
    const allPools = response.data.data || []

    // Find USDC pool specifically
    const usdcPool = allPools.find(
      (pool: AavePoolData) => pool.project === "aave-v3" && pool.chain === "Avalanche" && pool.symbol === "USDC",
    )

    console.log("[v0] USDC pool found:", usdcPool ? `APY: ${usdcPool.apy}%` : "Not found")

    return usdcPool || null
  } catch (error) {
    console.error("[v0] Failed to fetch USDC pool data:", error)
    return null
  }
}

export function formatTvl(tvl: number): string {
  if (tvl >= 1e9) {
    return `${(tvl / 1e9).toFixed(2)}B`
  } else if (tvl >= 1e6) {
    return `${(tvl / 1e6).toFixed(2)}M`
  } else if (tvl >= 1e3) {
    return `${(tvl / 1e3).toFixed(0)}K`
  }
  return tvl.toFixed(0)
}

export function formatApy(apy: number): string {
  return apy.toFixed(2)
}
