"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { CONTRACTS, SUPPORTED_CHAINS } from "@/utils/constants"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { useAccount, useReadContract } from "wagmi"

// Hook for YieldAvax balance
function useYieldAvaxBalance(address: string | null, chainId: number | null) {
  const [balance, setBalance] = useState("0.00")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !chainId || !window.ethereum) {
      setBalance("0.00")
      setIsLoading(false)
      return
    }

    const yieldAvaxAddress = CONTRACTS.YIELDAVAX[chainId as keyof typeof CONTRACTS.YIELDAVAX]
    if (!yieldAvaxAddress) {
      setBalance("0.00")
      setIsLoading(false)
      return
    }

    const fetchBalance = async () => {
      setIsLoading(true)
      setError(null)
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
          setBalance("0.00")
          return
        }

        try {
          const balanceWei = BigInt(balanceResult)
          const balanceFormatted = (Number(balanceWei) / 1e18).toFixed(6)
          setBalance(balanceFormatted)
        } catch (parseError) {
          console.error("Failed to parse YieldAvax balance result:", parseError, { balanceResult })
          setBalance("0.00")
        }
      } catch (err) {
        console.error("Failed to fetch YieldAvax balance:", err)
        setError("Failed to fetch balance")
        setBalance("0.00")
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [address, chainId])

  return { balance, isLoading, error }
}

// ABIs for the read-only calls
const PEER_ABI = [
  {
    type: "function",
    name: "getTotalValue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

const PARENT_ABI = [
  {
    type: "function",
    name: "getTotalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

export function WithdrawCard() {
  const { address, chainId, isConnected } = useAccount()
  const {
    balance: yieldAvaxBalance,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useYieldAvaxBalance(address, chainId)
  const { toast } = useToast()

  const [amount, setAmount] = useState("")
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [calculatedUsdcAmount, setCalculatedUsdcAmount] = useState("0.00")
  const [isCalculatingAmount, setIsCalculatingAmount] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<"transfer" | "withdraw" | "idle">("idle")

  // Only show Avalanche Fuji since we're calling the parent contract directly
  const availableChains = SUPPORTED_CHAINS.filter((chain) => chain.id === 43113) // Avalanche Fuji only

  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
    const chain = availableChains.find((c) => c.id === chainId)
    return `${chain?.blockExplorer}/tx/${txHash}`
  }

  const getPeerContractAddress = (chainId: number) => {
    switch (chainId) {
      case 43113: // Avalanche Fuji (Parent Peer)
        return CONTRACTS.PARENT_PEER.address
      case 11155111: // Ethereum Sepolia
        return CONTRACTS.CHILD_PEERS.ETH_SEPOLIA.address
      default:
        return null
    }
  }

  // Read total value from current chain's peer contract
  const { data: totalValue } = useReadContract({
    address: getPeerContractAddress(chainId || 0) as `0x${string}`,
    abi: PEER_ABI,
    functionName: "getTotalValue",
    chainId: chainId || undefined,
    query: {
      enabled: !!chainId && !!getPeerContractAddress(chainId),
    },
  })

  // Read total shares from parent peer on Avalanche Fuji
  const { data: totalShares } = useReadContract({
    address: CONTRACTS.PARENT_PEER.address as `0x${string}`,
    abi: PARENT_ABI,
    functionName: "getTotalShares",
    chainId: 43113, // Avalanche Fuji
  })

  const calculateUsdcAmount = async () => {
    if (!chainId || !amount || Number.parseFloat(amount) === 0 || !totalValue || !totalShares) {
      setCalculatedUsdcAmount("0.00")
      return
    }

    setIsCalculatingAmount(true)

    try {
      const shareBurnAmount = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

      console.log("Calculation inputs:")
      console.log("- Total Value:", totalValue.toString())
      console.log("- Total Shares:", totalShares.toString())
      console.log("- Share Burn Amount:", shareBurnAmount.toString())

      // Implement the contract's calculation logic from ParentPeer._calculateWithdrawAmount
      const INITIAL_SHARE_PRECISION = BigInt(1e12)

      // shareWithdrawAmount = ((totalValue * INITIAL_SHARE_PRECISION * shareBurnAmount) / totalShares)
      const shareWithdrawAmount = (totalValue * INITIAL_SHARE_PRECISION * shareBurnAmount) / totalShares

      // usdcWithdrawAmount = shareWithdrawAmount / INITIAL_SHARE_PRECISION
      const usdcWithdrawAmount = shareWithdrawAmount / INITIAL_SHARE_PRECISION

      // Convert to human readable format (USDC has 6 decimals)
      const usdcAmountFormatted = (Number(usdcWithdrawAmount) / 1e6).toFixed(6)
      setCalculatedUsdcAmount(usdcAmountFormatted)

      console.log("Calculated USDC amount:", usdcAmountFormatted)
    } catch (error) {
      console.error("Failed to calculate USDC amount:", error)
      setCalculatedUsdcAmount("0.00")
    } finally {
      setIsCalculatingAmount(false)
    }
  }

  // Calculate USDC amount when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateUsdcAmount()
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timer)
  }, [amount, chainId, totalValue, totalShares])

  const transferYieldAvax = async (shareAmount: bigint, parentPeerAddress: string) => {
    const yieldAvaxAddress = CONTRACTS.YIELDAVAX[chainId as keyof typeof CONTRACTS.YIELDAVAX]
    
    if (!yieldAvaxAddress) {
      throw new Error("YieldAvax contract address not found for this chain")
    }

    console.log("Transferring YieldAvax tokens:")
    console.log("- YieldAvax address:", yieldAvaxAddress)
    console.log("- To:", parentPeerAddress)
    console.log("- Amount:", shareAmount.toString())

    // ERC20 transfer(address to, uint256 amount)
    const transferData = `0xa9059cbb${parentPeerAddress.slice(2).padStart(64, "0")}${shareAmount.toString(16).padStart(64, "0")}`

    const transferTxParams = {
      from: address,
      to: yieldAvaxAddress,
      data: transferData,
    }

    // Try to estimate gas
    try {
      const gasEstimate = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [transferTxParams],
      })
      console.log("- Transfer gas estimate:", gasEstimate)
      const gasLimit = Math.floor(Number.parseInt(gasEstimate, 16) * 1.2).toString(16)
      transferTxParams.gas = `0x${gasLimit}`
    } catch (gasError) {
      console.warn("Transfer gas estimation failed:", gasError)
    }

    const transferTxHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [transferTxParams],
    })

    console.log("Transfer transaction sent:", transferTxHash)
    return transferTxHash
  }

  const callWithdraw = async (shareAmount: bigint, parentPeerAddress: string) => {
    console.log("Calling withdraw on ParentPeer:")
    console.log("- Parent Peer address:", parentPeerAddress)
    console.log("- Share Amount (wei):", shareAmount.toString())

    // Call withdraw(uint256 shareAmount) on ParentPeer
    const withdrawData = `0x2e1a7d4d${shareAmount.toString(16).padStart(64, "0")}`

    const withdrawTxParams = {
      from: address,
      to: parentPeerAddress,
      data: withdrawData,
    }

    // Try to estimate gas
    try {
      const gasEstimate = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [withdrawTxParams],
      })
      console.log("- Withdraw gas estimate:", gasEstimate)
      const gasLimit = Math.floor(Number.parseInt(gasEstimate, 16) * 1.2).toString(16)
      withdrawTxParams.gas = `0x${gasLimit}`
    } catch (gasError) {
      console.warn("Withdraw gas estimation failed:", gasError)
    }

    const withdrawTxHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [withdrawTxParams],
    })

    console.log("Withdraw transaction sent:", withdrawTxHash)
    return withdrawTxHash
  }

  const handleWithdraw = async () => {
    if (!window.ethereum || !address || !amount || chainId !== 43113) {
      console.error("Missing requirements for withdrawal or wrong chain")
      toast({
        variant: "destructive",
        title: "Missing Requirements",
        description: "Please ensure wallet is connected to Avalanche Fuji and amount is entered",
      })
      return
    }

    const parentPeerAddress = CONTRACTS.PARENT_PEER.address

    if (!parentPeerAddress) {
      console.error("Parent peer contract address not found")
      toast({
        variant: "destructive",
        title: "Contract Error",
        description: "Parent peer contract address not found",
      })
      return
    }

    setIsWithdrawing(true)

    try {
      // Convert amount to wei (YieldAvax has 18 decimals)
      const shareAmount = BigInt(Math.floor(Number.parseFloat(amount) * 1e18))

      // Step 1: Transfer YieldAvax tokens to ParentPeer contract
      setWithdrawStep("transfer")
      toast({
        title: "Step 1/2: Transferring Tokens",
        description: `Transferring ${amount} YieldAvax to the contract...`,
      })

      const transferTxHash = await transferYieldAvax(shareAmount, parentPeerAddress)

      toast({
        title: "Transfer Completed",
        description: "Tokens transferred successfully. Now calling withdraw...",
        action: (
          <ToastAction altText="View transaction">
            <a href={getBlockExplorerUrl(chainId, transferTxHash)} target="_blank" rel="noopener noreferrer">
              View Tx
            </a>
          </ToastAction>
        ),
      })

      // Wait a moment for the transfer to be processed
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 2: Call withdraw function
      setWithdrawStep("withdraw")
      toast({
        title: "Step 2/2: Processing Withdrawal",
        description: "Calling withdraw function to process your withdrawal...",
      })

      const withdrawTxHash = await callWithdraw(shareAmount, parentPeerAddress)

      // Show success toast
      toast({
        title: "Withdrawal Completed",
        description: `Successfully withdrawn ${amount} YieldAvax for ~${calculatedUsdcAmount} USDC`,
        action: (
          <ToastAction altText="View transaction">
            <a href={getBlockExplorerUrl(chainId, withdrawTxHash)} target="_blank" rel="noopener noreferrer">
              View Tx
            </a>
          </ToastAction>
        ),
      })

      // Reset form
      setTimeout(() => {
        setAmount("")
        setIsWithdrawing(false)
        setWithdrawStep("idle")
      }, 2000)
    } catch (error) {
      console.error("Withdrawal failed:", error)
      setIsWithdrawing(false)
      setWithdrawStep("idle")

      let errorMessage = "Transaction was rejected or failed"
      if (error instanceof Error) {
        if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction"
        } else if (error.message.includes("User denied")) {
          errorMessage = "Transaction was rejected by user"
        } else if (error.message.includes("gas")) {
          errorMessage = "Transaction failed due to gas issues"
        } else {
          errorMessage = error.message
        }
      }

      toast({
        variant: "destructive",
        title: "Withdrawal Failed",
        description: errorMessage,
      })
    }
  }

  const getButtonText = () => {
    if (isWithdrawing) {
      switch (withdrawStep) {
        case "transfer":
          return "Transferring Tokens..."
        case "withdraw":
          return "Processing Withdrawal..."
        default:
          return "Processing..."
      }
    }
    return "Withdraw"
  }

  const isValidAmount = amount && Number.parseFloat(amount) > 0
  const maxAmount = Number.parseFloat(yieldAvaxBalance)
  const isOnCorrectChain = chainId === 43113 // Avalanche Fuji

  return (
    <Card className="bg-white border-slate-200 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-900 text-lg">Withdraw USDC</CardTitle>
        <CardDescription className="text-slate-600 text-sm">
          Redeem your YieldAvax for USDC plus earned yield (Avalanche Fuji only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOnCorrectChain && isConnected && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-yellow-800 text-sm">
              Please switch to Avalanche Fuji network to withdraw directly from the parent contract.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="withdraw-amount" className="text-slate-700 font-medium text-sm">
            Amount (YieldAvax)
          </Label>
          <Input
            id="withdraw-amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={maxAmount}
            disabled={!isConnected || !isOnCorrectChain}
            className="text-base border-slate-300 focus:border-rose-700 focus:ring-rose-700"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              Balance:{" "}
              {!isConnected
                ? "Connect wallet"
                : !isOnCorrectChain
                ? "Switch to Avalanche Fuji"
                : isLoadingBalance
                  ? "Loading..."
                  : balanceError
                    ? "Error loading"
                    : `${yieldAvaxBalance} YieldAvax`}
            </span>
            <button
              onClick={() => setAmount(yieldAvaxBalance)}
              disabled={!isConnected || !isOnCorrectChain || isLoadingBalance || balanceError !== null || maxAmount === 0}
              className="text-rose-700 hover:text-rose-800 disabled:text-slate-400 font-medium text-xs"
            >
              Max
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">You will receive:</span>
            <span className="font-medium text-slate-900">
              {isCalculatingAmount ? "Calculating..." : `${calculatedUsdcAmount} USDC`}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-600">Destination:</span>
            <span className="font-medium text-slate-900">Avalanche Fuji</span>
          </div>
        </div>

        {isWithdrawing && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-blue-800 text-sm font-medium">
                {withdrawStep === "transfer" && "Step 1/2: Transferring YieldAvax tokens to contract"}
                {withdrawStep === "withdraw" && "Step 2/2: Processing withdrawal and sending USDC"}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handleWithdraw}
          disabled={!isConnected || !isOnCorrectChain || !isValidAmount || isWithdrawing || maxAmount === 0}
          className="w-full bg-rose-700 hover:bg-rose-800 text-white text-sm py-2"
        >
          {isWithdrawing && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {getButtonText()}
        </Button>

        <p className="text-xs text-slate-500">
          This process involves two transactions: First, your YieldAvax tokens are transferred to the 
          ParentPeer contract, then the withdraw function is called. The contract will burn the tokens, 
          calculate the USDC amount based on current total value, withdraw from the strategy if needed, 
          and transfer USDC directly to your wallet.
        </p>
      </CardContent>
    </Card>
  )
}