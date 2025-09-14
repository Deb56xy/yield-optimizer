"use client"

import { useState, useEffect } from "react"
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi"
import * as CCIP from "@chainlink/ccip-js"
import { Strategy } from "@/components/Strategy"
import { Portfolio } from "@/components/Portfolio"

// Configuration constants
const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Ethereum Sepolia", shortName: "Sepolia" },
  { id: 84532, name: "Base Sepolia", shortName: "Base Sepolia" },
  { id: 43113, name: "Avalanche Fuji", shortName: "Fuji" },
]

const CONTRACTS = {
  CCIP_ROUTER: {
    11155111: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // Sepolia
    84532: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93", // Base Sepolia
    43113: "0xF694E193200268f9a4868e4Aa017A0118C9a8177", // Fuji
  },
  YIELDCOIN: {
    11155111: "0x5C5f07FD137Aa38860B5fA2ca5671bd5C49333B4", // Replace with actual
    84532: "0x771ceed62ac79cBa5Ec557b8095b8Cdc13559dD3", // Replace with actual
    43113: "0x550a6bef9fa59639Cd73126D7D066948280f9FB9", // Replace with actual
  },
}

const CHAIN_SELECTORS = {
  11155111: "16015286601757825753", // Sepolia
  84532: "10344971235874465080", // Base Sepolia
  43113: "14767482510784806043", // Fuji
}

export default function CrossChainTransfer() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { switchChain } = useSwitchChain()

  // State
  const [selectedSourceChainId, setSelectedSourceChainId] = useState("")
  const [amount, setAmount] = useState("")
  const [destinationChainId, setDestinationChainId] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isEstimatingFee, setIsEstimatingFee] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(true)
  const [estimatedFee, setEstimatedFee] = useState("")
  const [status, setStatus] = useState("")
  const [balance, setBalance] = useState("0")
  const [lastTxHash, setLastTxHash] = useState("")
  const [lastMessageId, setLastMessageId] = useState("")

  // Initialize CCIP client
  const ccipClient = CCIP.createClient()

  // Set initial source chain when component mounts
  useEffect(() => {
    if (chainId && !selectedSourceChainId) {
      setSelectedSourceChainId(chainId.toString())
    }
  }, [chainId, selectedSourceChainId])

  const selectedSourceChain = SUPPORTED_CHAINS.find((chain) => chain.id.toString() === selectedSourceChainId)
  const destinationChain = SUPPORTED_CHAINS.find((chain) => chain.id.toString() === destinationChainId)
  const isOnCorrectChain = chainId?.toString() === selectedSourceChainId

  // Get YieldCoin balance for selected source chain
  useEffect(() => {
    const getBalance = async () => {
      if (!address || !selectedSourceChainId || !isOnCorrectChain || !publicClient) {
        setBalance("0")
        return
      }

      const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
      const yieldCoinAddress = CONTRACTS.YIELDCOIN[sourceChainIdNum as keyof typeof CONTRACTS.YIELDCOIN]
      if (!yieldCoinAddress) return

      try {
        const balance = await publicClient.readContract({
          address: yieldCoinAddress as `0x${string}`,
          abi: [
            {
              name: "balanceOf",
              type: "function",
              stateMutability: "view",
              inputs: [{ name: "account", type: "address" }],
              outputs: [{ name: "", type: "uint256" }],
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        })

        setBalance((Number(balance) / 1e18).toFixed(4))
      } catch (error) {
        console.error("Error fetching balance:", error)
        setBalance("0")
      }
    }

    getBalance()
  }, [address, selectedSourceChainId, isOnCorrectChain, publicClient])

  // Check approval when amount or source chain changes
  useEffect(() => {
    const checkApproval = async () => {
      if (!amount || !address || !selectedSourceChainId || !isOnCorrectChain || !publicClient) {
        setNeedsApproval(true)
        return
      }

      const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
      const routerAddress = CONTRACTS.CCIP_ROUTER[sourceChainIdNum as keyof typeof CONTRACTS.CCIP_ROUTER]
      const yieldCoinAddress = CONTRACTS.YIELDCOIN[sourceChainIdNum as keyof typeof CONTRACTS.YIELDCOIN]

      if (!routerAddress || !yieldCoinAddress) return

      try {
        const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

        const allowance = await publicClient.readContract({
          address: yieldCoinAddress as `0x${string}`,
          abi: [
            {
              name: "allowance",
              type: "function",
              stateMutability: "view",
              inputs: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
              ],
              outputs: [{ name: "", type: "uint256" }],
            },
          ],
          functionName: "allowance",
          args: [address as `0x${string}`, routerAddress as `0x${string}`],
        })

        setNeedsApproval((allowance as bigint) < amountWei)
      } catch (error) {
        console.error("Error checking approval:", error)
        setNeedsApproval(true)
      }
    }

    checkApproval()
  }, [amount, address, selectedSourceChainId, isOnCorrectChain, publicClient])

  // Estimate fee when parameters change
  useEffect(() => {
    const estimateFee = async () => {
      if (!amount || !destinationChainId || !selectedSourceChainId || !address || !isOnCorrectChain || !publicClient) {
        setEstimatedFee("")
        return
      }

      const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
      const routerAddress = CONTRACTS.CCIP_ROUTER[sourceChainIdNum as keyof typeof CONTRACTS.CCIP_ROUTER]
      const yieldCoinAddress = CONTRACTS.YIELDCOIN[sourceChainIdNum as keyof typeof CONTRACTS.YIELDCOIN]
      const destChainSelector = CHAIN_SELECTORS[Number.parseInt(destinationChainId) as keyof typeof CHAIN_SELECTORS]

      if (!routerAddress || !yieldCoinAddress || !destChainSelector) return

      setIsEstimatingFee(true)

      try {
        const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

        const fee = await ccipClient.getFee({
          client: publicClient,
          routerAddress: routerAddress as `0x${string}`,
          tokenAddress: yieldCoinAddress as `0x${string}`,
          amount: amountWei,
          destinationAccount: address as `0x${string}`,
          destinationChainSelector: destChainSelector,
        })

        const feeInEth = (Number(fee) / 1e18).toFixed(6)
        setEstimatedFee(feeInEth)
      } catch (error) {
        console.error("Fee estimation failed:", error)
        setEstimatedFee("0.01")
      } finally {
        setIsEstimatingFee(false)
      }
    }

    estimateFee()
  }, [amount, destinationChainId, selectedSourceChainId, address, isOnCorrectChain, publicClient, ccipClient])

  const handleSwitchChain = async (targetChainId: string) => {
    if (!switchChain) return

    setIsSwitchingChain(true)
    setStatus("Switching chain...")

    try {
      await switchChain({ chainId: Number.parseInt(targetChainId) })
      setSelectedSourceChainId(targetChainId)
      setStatus("Chain switched successfully!")
    } catch (error) {
      console.error("Chain switch failed:", error)
      setStatus(`Chain switch failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSwitchingChain(false)
    }
  }

  const handleSourceChainChange = (newSourceChainId: string) => {
    setSelectedSourceChainId(newSourceChainId)
    // Reset form when source chain changes
    setAmount("")
    setDestinationChainId("")
    setNeedsApproval(true)
    setEstimatedFee("")
    setStatus("")
  }

  const handleApprove = async () => {
    if (!amount || !selectedSourceChainId || !address || !walletClient || !isOnCorrectChain) return

    const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
    const routerAddress = CONTRACTS.CCIP_ROUTER[sourceChainIdNum as keyof typeof CONTRACTS.CCIP_ROUTER]
    const yieldCoinAddress = CONTRACTS.YIELDCOIN[sourceChainIdNum as keyof typeof CONTRACTS.YIELDCOIN]

    if (!routerAddress || !yieldCoinAddress) return

    setIsApproving(true)
    setStatus("Approving...")

    try {
      const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

      const { txHash } = await ccipClient.approveRouter({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: yieldCoinAddress as `0x${string}`,
        amount: amountWei,
        waitForReceipt: false,
      })

      setLastTxHash(txHash)
      setStatus(`Approval sent: ${txHash.slice(0, 10)}...`)

      // Wait for confirmation
      await ccipClient.approveRouter({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: yieldCoinAddress as `0x${string}`,
        amount: amountWei,
        waitForReceipt: true,
      })

      setNeedsApproval(false)
      setStatus("Approved successfully!")
    } catch (error) {
      console.error("Approval failed:", error)
      setStatus(`Approval failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsApproving(false)
    }
  }

  const handleTransfer = async () => {
    if (!amount || !destinationChainId || !selectedSourceChainId || !address || !walletClient || !isOnCorrectChain)
      return

    const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
    const routerAddress = CONTRACTS.CCIP_ROUTER[sourceChainIdNum as keyof typeof CONTRACTS.CCIP_ROUTER]
    const yieldCoinAddress = CONTRACTS.YIELDCOIN[sourceChainIdNum as keyof typeof CONTRACTS.YIELDCOIN]
    const destChainSelector = CHAIN_SELECTORS[Number.parseInt(destinationChainId) as keyof typeof CHAIN_SELECTORS]

    if (!routerAddress || !yieldCoinAddress || !destChainSelector) return

    setIsTransferring(true)
    setStatus("Initiating transfer...")

    try {
      const amountWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

      const { txHash, messageId } = await ccipClient.transferTokens({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: yieldCoinAddress as `0x${string}`,
        amount: amountWei,
        destinationAccount: address as `0x${string}`,
        destinationChainSelector: destChainSelector,
      })

      setLastTxHash(txHash)
      setLastMessageId(messageId)
      setStatus(`Transfer initiated! TX: ${txHash.slice(0, 10)}... | Message ID: ${messageId.slice(0, 10)}...`)

      // Reset form
      setAmount("")
      setNeedsApproval(true)
      setDestinationChainId("")
    } catch (error) {
      console.error("Transfer failed:", error)
      setStatus(`Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsTransferring(false)
    }
  }

  const checkMessageStatus = async () => {
    if (!lastMessageId || !selectedSourceChainId) return

    try {
      setStatus("Checking status...")
      const sourceChainIdNum = Number.parseInt(selectedSourceChainId)
      const messageStatus = await ccipClient.getMessageStatus({
        messageId: lastMessageId,
        sourceChainSelector: CHAIN_SELECTORS[sourceChainIdNum as keyof typeof CHAIN_SELECTORS],
      })
      setStatus(`Message Status: ${messageStatus}`)
    } catch (error) {
      console.error("Status check failed:", error)
      setStatus("Status check failed")
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white">
        {/* Hero Section with Connection Prompt */}
        <div className="flex items-center justify-center p-8 min-h-[60vh]">
          <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-0 p-10 text-center backdrop-blur-sm bg-gradient-to-br from-white to-slate-50/50">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-4">
              Cross-Chain Bridge
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Connect your wallet to start transferring YieldAVAX across chains and view your portfolio
            </p>
            <div className="w-full py-4 px-8 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-600 rounded-2xl font-semibold border border-slate-200">
              Please connect your wallet to continue
            </div>
          </div>
        </div>

        {/* Strategy and Portfolio Preview (Static) */}
        <div className="max-w-6xl mx-auto px-6 pb-16 space-y-12">
          <div className="text-center mb-12">
            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-3">
              YieldAVAX Platform Overview
            </h3>
            <p className="text-slate-600 max-w-2xl mx-auto text-sm leading-relaxed">
              Explore our advanced cross-chain yield optimization strategy and portfolio management tools
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Strategy />
            </div>
            <div className="space-y-4">
              <Portfolio />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* Bridge Interface - Left Column */}
          <div className="lg:col-span-2">
            <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-0 p-8 backdrop-blur-sm bg-gradient-to-br from-white to-slate-50/50 sticky top-6">
              {/* Header with icon and improved typography */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
                  Cross-Chain Bridge
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">Transfer YieldAVAX seamlessly across networks</p>
              </div>

              {/* Source Chain Selection */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-3">From Chain</label>
                <select
                  value={selectedSourceChainId}
                  onChange={(e) => handleSourceChainChange(e.target.value)}
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white text-slate-800 font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                >
                  <option value="">Select source chain</option>
                  {SUPPORTED_CHAINS.map((chain) => (
                    <option key={chain.id} value={chain.id.toString()}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chain Status & Balance */}
              {selectedSourceChain && (
                <div className="mb-6 p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-slate-800 mb-1">{selectedSourceChain.name}</div>
                      <div className="text-xs text-slate-600">
                        Balance:{" "}
                        <span className="font-bold text-slate-800">
                          {isOnCorrectChain ? balance : "Switch to view"} YIELD
                        </span>
                      </div>
                    </div>
                    {!isOnCorrectChain && (
                      <button
                        onClick={() => handleSwitchChain(selectedSourceChainId)}
                        disabled={isSwitchingChain}
                        className="px-4 py-2 text-xs bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        {isSwitchingChain ? "Switching..." : "Switch"}
                      </button>
                    )}
                  </div>
                  {!isOnCorrectChain && (
                    <div className="flex items-center text-xs text-amber-800 mt-3 bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-200">
                      <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Please switch to {selectedSourceChain.name} to continue
                    </div>
                  )}
                </div>
              )}

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-3">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!isOnCorrectChain || !selectedSourceChainId}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-800 font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                  />
                  <button
                    onClick={() => setAmount(balance)}
                    disabled={Number.parseFloat(balance) === 0 || !isOnCorrectChain}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-rose-600 hover:text-rose-800 font-bold disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Destination Chain */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-3">To Chain</label>
                <select
                  value={destinationChainId}
                  onChange={(e) => setDestinationChainId(e.target.value)}
                  disabled={!selectedSourceChainId}
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-800 font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-sm"
                >
                  <option value="">Select destination</option>
                  {SUPPORTED_CHAINS.filter((chain) => chain.id.toString() !== selectedSourceChainId).map((chain) => (
                    <option key={chain.id} value={chain.id.toString()}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Route Display */}
              {selectedSourceChain && destinationChain && (
                <div className="mb-6 p-5 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-200 shadow-sm">
                  <div className="flex items-center justify-center space-x-3">
                    <span className="text-xs font-bold text-slate-800">{selectedSourceChain.shortName}</span>
                    <div className="p-1.5 rounded-full bg-rose-100">
                      <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{destinationChain.shortName}</span>
                  </div>
                </div>
              )}

              {/* Fee Display */}
              {estimatedFee && isOnCorrectChain && (
                <div className="mb-6 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Estimated Fee:</span>
                    <span className="text-xs font-bold text-slate-800">
                      {isEstimatingFee ? "Calculating..." : `~${estimatedFee} ETH`}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-slate-600">
                    <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Transfer Time: ~10-20 minutes
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                {needsApproval && amount && destinationChainId && isOnCorrectChain && (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || Number.parseFloat(amount) <= 0}
                    className="w-full py-4 px-6 bg-slate-600 text-white rounded-2xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl text-sm"
                  >
                    {isApproving ? (
                      <div className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Approving...
                      </div>
                    ) : (
                      "Approve YieldCoin"
                    )}
                  </button>
                )}

                <button
                  onClick={handleTransfer}
                  disabled={
                    needsApproval ||
                    isTransferring ||
                    !amount ||
                    !destinationChainId ||
                    !selectedSourceChainId ||
                    !isOnCorrectChain ||
                    Number.parseFloat(amount) <= 0
                  }
                  className="w-full py-4 px-6 bg-rose-700 text-white rounded-2xl hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl text-sm"
                >
                  {isTransferring ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Transferring...
                    </div>
                  ) : (
                    "Transfer YieldCoin"
                  )}
                </button>
              </div>

              {/* Status Check */}
              {lastMessageId && (
                <button
                  onClick={checkMessageStatus}
                  className="w-full py-3 px-5 text-xs bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 mb-6 font-bold transition-colors duration-200 border border-blue-200"
                >
                  Check Transfer Status
                </button>
              )}

              {/* Status Display */}
              {status && (
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl text-xs mb-4 border border-slate-200 shadow-sm">
                  <div className="font-bold text-slate-800 mb-2">Status:</div>
                  <div className="text-slate-700 break-all leading-relaxed">{status}</div>
                </div>
              )}

              {lastTxHash && (
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl text-xs mb-4 border border-slate-200 shadow-sm space-y-2">
                  <a
                    href={`https://testnet.snowtrace.io/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors duration-200"
                  >
                    View on Snowtrace Testnet →
                  </a>
                  <a
                    href={`https://ccip.chain.link/#/side-drawer/msg/${lastMessageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors duration-200"
                  >
                    View on CCIP Explorer →
                  </a>
                </div>
              )}

              {/* Info */}
              <div className="mt-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-600 space-y-2">
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Powered by Chainlink CCIP</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Fees paid in native token</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-3 h-3 mr-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Your yield continues during transfer</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy and Portfolio Section - Right Columns */}
          <div className="lg:col-span-3">
            <div className="mb-8">
              <h3 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-3">
                Your YieldAVAX Dashboard
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Monitor your cross-chain yield optimization strategy and portfolio performance in real-time
              </p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-4">
                <Strategy />
              </div>
              <div className="space-y-4">
                <Portfolio />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
