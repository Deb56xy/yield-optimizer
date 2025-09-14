"use client"

import { useState, useEffect } from "react"
import { useAccount, usePublicClient, useWriteContract, useChainId, useSwitchChain } from "wagmi"
import { parseUnits } from "viem"

// Configuration constants for USDC bridging only
const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Ethereum Sepolia", shortName: "Sepolia" },
  { id: 43113, name: "Avalanche Fuji", shortName: "Fuji" },
]

const CONTRACTS = {
  USDC_BRIDGE: "0x03D8487343D7e5e8E8bB81039083EF9652B4c2ba",
  USDC: {
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC
    43113: "0x5425890298aed601595a70AB815c96711a31Bc65", // Fuji USDC
  },
}

const CHAIN_SELECTORS = {
  11155111: "16015286601757825753", // Sepolia
  43113: "14767482510784806043", // Fuji
}

const USDC_BRIDGE_ABI = [
  {
    name: "sendUSDCPayLINK",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_destinationChainSelector", type: "uint64" },
      { name: "_receiver", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [{ name: "messageId", type: "bytes32" }],
  },
  {
    name: "getFee",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_destinationChainSelector", type: "uint64" },
      { name: "_receiver", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_feeToken", type: "address" },
    ],
    outputs: [{ name: "fee", type: "uint256" }],
  },
] as const

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
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
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "boolean" }],
  },
] as const

export default function USDCBridge() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { switchChain } = useSwitchChain()

  // State
  const [sourceChainId, setSourceChainId] = useState("11155111") // Default to Sepolia
  const [destinationChainId, setDestinationChainId] = useState("43113") // Default to Fuji
  const [amount, setAmount] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isBridging, setIsBridging] = useState(false)
  const [isEstimatingFee, setIsEstimatingFee] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(true)
  const [estimatedFee, setEstimatedFee] = useState("")
  const [status, setStatus] = useState("")
  const [balance, setBalance] = useState("0")
  const [lastTxHash, setLastTxHash] = useState("")
  const [lastMessageId, setLastMessageId] = useState("")

  const sourceChain = SUPPORTED_CHAINS.find((chain) => chain.id.toString() === sourceChainId)
  const destinationChain = SUPPORTED_CHAINS.find((chain) => chain.id.toString() === destinationChainId)
  const isOnCorrectChain = chainId?.toString() === sourceChainId

  // Get USDC balance for selected source chain
  useEffect(() => {
    const getBalance = async () => {
      if (!address || !sourceChainId || !isOnCorrectChain || !publicClient) {
        setBalance("0")
        return
      }

      const sourceChainIdNum = Number.parseInt(sourceChainId)
      const usdcAddress = CONTRACTS.USDC[sourceChainIdNum as keyof typeof CONTRACTS.USDC]
      if (!usdcAddress) return

      try {
        const balance = await publicClient.readContract({
          address: usdcAddress as `0x${string}`,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        })

        setBalance((Number(balance) / 1e6).toFixed(2)) // USDC has 6 decimals
      } catch (error) {
        console.error("Error fetching balance:", error)
        setBalance("0")
      }
    }

    getBalance()
  }, [address, sourceChainId, isOnCorrectChain, publicClient])

  // Check approval when amount or source chain changes
  useEffect(() => {
    const checkApproval = async () => {
      if (!amount || !address || !sourceChainId || !isOnCorrectChain || !publicClient) {
        setNeedsApproval(true)
        return
      }

      const sourceChainIdNum = Number.parseInt(sourceChainId)
      const usdcAddress = CONTRACTS.USDC[sourceChainIdNum as keyof typeof CONTRACTS.USDC]

      if (!usdcAddress) return

      try {
        const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

        const allowance = await publicClient.readContract({
          address: usdcAddress as `0x${string}`,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [address as `0x${string}`, CONTRACTS.USDC_BRIDGE as `0x${string}`],
        })

        setNeedsApproval((allowance as bigint) < amountWei)
      } catch (error) {
        console.error("Error checking approval:", error)
        setNeedsApproval(true)
      }
    }

    checkApproval()
  }, [amount, address, sourceChainId, isOnCorrectChain, publicClient])

  useEffect(() => {
    const estimateFee = async () => {
      if (!amount || !sourceChainId || !destinationChainId || !address || !isOnCorrectChain || !publicClient) {
        setEstimatedFee("")
        return
      }

      const destChainSelector = CHAIN_SELECTORS[Number.parseInt(destinationChainId) as keyof typeof CHAIN_SELECTORS]
      if (!destChainSelector) return

      setIsEstimatingFee(true)

      try {
        const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

        const fee = await publicClient.readContract({
          address: CONTRACTS.USDC_BRIDGE as `0x${string}`,
          abi: USDC_BRIDGE_ABI,
          functionName: "getFee",
          args: [
            BigInt(destChainSelector),
            address as `0x${string}`,
            amountWei,
            "0x0000000000000000000000000000000000000000", // ETH as fee token (zero address)
          ],
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
  }, [amount, destinationChainId, sourceChainId, address, isOnCorrectChain, publicClient])

  const handleSwitchChain = async (targetChainId: string) => {
    if (!switchChain) return

    setIsSwitchingChain(true)
    setStatus("Switching chain...")

    try {
      await switchChain({ chainId: Number.parseInt(targetChainId) })
      setStatus("Chain switched successfully!")
    } catch (error) {
      console.error("Chain switch failed:", error)
      setStatus(`Chain switch failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSwitchingChain(false)
    }
  }

  const handleFlipChains = () => {
    const newSource = destinationChainId
    const newDestination = sourceChainId
    setSourceChainId(newSource)
    setDestinationChainId(newDestination)
    setAmount("")
    setNeedsApproval(true)
    setEstimatedFee("")
    setStatus("")
  }

  const handleApprove = async () => {
    if (!amount || !sourceChainId || !address || !isOnCorrectChain) return

    const sourceChainIdNum = Number.parseInt(sourceChainId)
    const usdcAddress = CONTRACTS.USDC[sourceChainIdNum as keyof typeof CONTRACTS.USDC]

    if (!usdcAddress) return

    setIsApproving(true)
    setStatus("Approving USDC...")

    try {
      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

      const txHash = await writeContractAsync({
        address: usdcAddress as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACTS.USDC_BRIDGE as `0x${string}`, amountWei],
      })

      setLastTxHash(txHash)
      setStatus(`Approval sent: ${txHash.slice(0, 10)}...`)

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
      }

      setNeedsApproval(false)
      setStatus("USDC approved successfully!")
    } catch (error) {
      console.error("Approval failed:", error)
      setStatus(`Approval failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsApproving(false)
    }
  }

  const handleBridge = async () => {
    if (!amount || !destinationChainId || !sourceChainId || !address || !isOnCorrectChain) return

    const destChainSelector = CHAIN_SELECTORS[Number.parseInt(destinationChainId) as keyof typeof CHAIN_SELECTORS]
    if (!destChainSelector) return

    setIsBridging(true)
    setStatus("Initiating USDC bridge...")

    try {
      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

      // Get the estimated fee first
      const fee = await publicClient.readContract({
        address: CONTRACTS.USDC_BRIDGE as `0x${string}`,
        abi: USDC_BRIDGE_ABI,
        functionName: "getFee",
        args: [
          BigInt(destChainSelector),
          address as `0x${string}`,
          amountWei,
          "0x0000000000000000000000000000000000000000", // ETH as fee token
        ],
      })

      const txHash = await writeContractAsync({
        abi: USDC_BRIDGE_ABI,
        address: CONTRACTS.USDC_BRIDGE as `0x${string}`,
        functionName: "sendUSDCPayLINK",
        args: [BigInt(destChainSelector), address as `0x${string}`, amountWei],
      })

      setLastTxHash(txHash)
      setStatus(`Bridge initiated! TX: ${txHash.slice(0, 10)}...`)

      // Wait for transaction receipt to get the message ID from logs
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
          // Try to extract message ID from logs (MessageSent event)
          if (receipt.logs && receipt.logs.length > 0) {
            const messageId = receipt.logs[receipt.logs.length - 1].topics[1] // First indexed parameter is messageId
            if (messageId) {
              setLastMessageId(messageId)
              setStatus(`Bridge completed! TX: ${txHash.slice(0, 10)}... | Message ID: ${messageId.slice(0, 10)}...`)
            }
          }
        } catch (receiptError) {
          console.error("Error waiting for transaction receipt:", receiptError)
        }
      }

      // Reset form
      setAmount("")
      setNeedsApproval(true)
    } catch (error) {
      console.error("Bridge failed:", error)
      setStatus(`Bridge failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsBridging(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-0 p-10 text-center backdrop-blur-sm bg-gradient-to-br from-white to-slate-50/50">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-4">
            USDC Bridge
          </h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Connect your wallet to bridge USDC between Ethereum Sepolia and Avalanche Fuji
          </p>
          <div className="w-full py-4 px-8 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-600 rounded-2xl font-semibold border border-slate-200">
            Please connect your wallet to continue
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-2xl border-0 p-8 backdrop-blur-sm bg-gradient-to-br from-white to-slate-50/50">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl">
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
              USDC Bridge
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Bridge USDC between Ethereum Sepolia and Avalanche Fuji
            </p>
          </div>

          {/* Chain Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-800 mb-2">From</label>
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200">
                  <div className="text-sm font-bold text-slate-800">{sourceChain?.name}</div>
                  <div className="text-xs text-slate-600">
                    Balance:{" "}
                    <span className="font-bold text-slate-800">
                      {isOnCorrectChain ? balance : "Switch to view"} USDC
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleFlipChains}
                className="mx-4 p-3 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>

              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-800 mb-2">To</label>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-200">
                  <div className="text-sm font-bold text-slate-800">{destinationChain?.name}</div>
                  <div className="text-xs text-slate-600">Destination chain</div>
                </div>
              </div>
            </div>

            {!isOnCorrectChain && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-amber-800">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Please switch to {sourceChain?.name}
                  </div>
                  <button
                    onClick={() => handleSwitchChain(sourceChainId)}
                    disabled={isSwitchingChain}
                    className="px-4 py-2 text-xs bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-bold transition-all duration-200"
                  >
                    {isSwitchingChain ? "Switching..." : "Switch"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-800 mb-3">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={!isOnCorrectChain}
                className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-800 font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-sm"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  onClick={() => setAmount(balance)}
                  disabled={Number.parseFloat(balance) === 0 || !isOnCorrectChain}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Max
                </button>
                <span className="text-xs font-bold text-slate-600">USDC</span>
              </div>
            </div>
          </div>

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
            {needsApproval && amount && isOnCorrectChain && (
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
                  "Approve USDC"
                )}
              </button>
            )}

            <button
              onClick={handleBridge}
              disabled={needsApproval || isBridging || !amount || !isOnCorrectChain || Number.parseFloat(amount) <= 0}
              className="w-full py-4 px-6 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl text-sm"
            >
              {isBridging ? (
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
                  Bridging...
                </div>
              ) : (
                "Bridge USDC"
              )}
            </button>
          </div>

          {/* Status Check */}
          {lastMessageId && (
            <div className="mb-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-800 mb-2">Bridge Status:</div>
              <div className="text-xs text-slate-700 break-all leading-relaxed">Message ID: {lastMessageId}</div>
            </div>
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
                href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
              >
                View on Etherscan →
              </a>
              {lastMessageId && (
                <a
                  href={`https://ccip.chain.link/#/side-drawer/msg/${lastMessageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                >
                  View on CCIP Explorer →
                </a>
              )}
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
                <span className="font-medium">Secure cross-chain transfers</span>
              </div>
              <div className="flex items-center">
                <svg className="w-3 h-3 mr-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">USDC bridging between Sepolia & Fuji</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
