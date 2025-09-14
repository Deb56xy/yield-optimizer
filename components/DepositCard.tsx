
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi"
import { CONTRACTS, SUPPORTED_CHAINS } from "@/utils/constants"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { parseUnits } from "viem"

export function DepositCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  })
  const { toast } = useToast()
  const publicClient = usePublicClient()

  const [balance, setBalance] = useState("0.00")
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !chainId || !window.ethereum) {
      setBalance("0.00")
      setIsLoadingBalance(false)
      return
    }

    const usdcAddress = CONTRACTS.USDC[chainId as keyof typeof CONTRACTS.USDC]
    if (!usdcAddress) {
      setBalance("0.00")
      setIsLoadingBalance(false)
      return
    }

    const fetchBalance = async () => {
      setIsLoadingBalance(true)
      setBalanceError(null)

      try {
        const balanceOfData = `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`

        const balanceResult = await window.ethereum.request({
          method: "eth_call",
          params: [
            {
              to: usdcAddress,
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
          const balanceFormatted = (Number(balanceWei) / 1e6).toFixed(6)
          setBalance(balanceFormatted)
        } catch (parseError) {
          console.error("Failed to parse balance result:", parseError, { balanceResult })
          setBalance("0.00")
        }
      } catch (err) {
        console.error("Failed to fetch USDC balance:", err)
        setBalanceError("Failed to fetch balance")
        setBalance("0.00")
      } finally {
        setIsLoadingBalance(false)
      }
    }

    fetchBalance()
  }, [address, chainId])

  const [amount, setAmount] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(true)

  // Check approval for deposits
  useEffect(() => {
    const checkApproval = async () => {
      if (!amount || !address || !chainId || !publicClient) {
        setNeedsApproval(true)
        return
      }

      const usdcAddress = getUSDCContractAddress(chainId)
      const spenderAddress = getPeerContractAddress(chainId)

      if (!usdcAddress || !spenderAddress) {
        setNeedsApproval(true)
        return
      }

      try {
        const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

        const allowance = await publicClient.readContract({
          address: usdcAddress as `0x${string}`,
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
          args: [address as `0x${string}`, spenderAddress as `0x${string}`],
        })

        setNeedsApproval((allowance as bigint) < amountWei)
      } catch (error) {
        console.error("Error checking approval:", error)
        setNeedsApproval(true)
      }
    }

    checkApproval()
  }, [amount, address, chainId, publicClient])

  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
    return `${chain?.blockExplorer}/tx/${txHash}`
  }

  const getPeerContractAddress = (chainId: number) => {
    switch (chainId) {
      case 43113: // Avalanche Fuji (Parent Peer)
        return CONTRACTS.PARENT_PEER.address
      case 11155111: // Ethereum Sepolia (Child Peer)
        return CONTRACTS.CHILD_PEERS.ETH_SEPOLIA.address
      default:
        return null
    }
  }

  const getUSDCContractAddress = (chainId: number) => {
    return CONTRACTS.USDC[chainId as keyof typeof CONTRACTS.USDC] || null
  }

  const getPeerType = (chainId: number) => {
    switch (chainId) {
      case 43113: // Avalanche Fuji (Parent Peer)
        return "Parent"
      case 11155111: // Ethereum Sepolia (Child Peer)
        return "Child"
      default:
        return "Unknown"
    }
  }

  const handleApprove = async () => {
    if (!chainId || !address || !amount) {
      console.error("Missing requirements for approval")
      return
    }

    const usdcAddress = getUSDCContractAddress(chainId)
    const spenderAddress = getPeerContractAddress(chainId)

    if (!usdcAddress || !spenderAddress) {
      console.error("Contract addresses not found for this chain")
      return
    }

    setIsApproving(true)

    try {
      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

      await writeContract({
        address: usdcAddress as `0x${string}`,
        abi: [
          {
            name: "approve",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [spenderAddress as `0x${string}`, amountWei],
      })

      console.log("Approval transaction sent")
    } catch (error) {
      console.error("Approval failed:", error)
      setIsApproving(false)

      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Transaction was rejected or failed",
      })
    }
  }

  const handleDeposit = async () => {
    if (!chainId || !address || !amount) {
      console.error("Missing requirements for deposit")
      return
    }

    const peerContractAddress = getPeerContractAddress(chainId)
    if (!peerContractAddress) {
      console.error("Peer contract not found for this chain")
      return
    }

    try {
      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

      await writeContract({
        address: peerContractAddress as `0x${string}`,
        abi: [
          {
            name: "deposit",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [{ name: "amountToDeposit", type: "uint256" }],
            outputs: [],
          },
        ],
        functionName: "deposit",
        args: [amountWei],
        gas: 500000n, // Add explicit gas limit
      })

      console.log("Deposit transaction sent")
    } catch (error) {
      console.error("Deposit failed:", error)

      toast({
        variant: "destructive",
        title: "Deposit Failed",
        description: "Transaction was rejected or failed",
      })
    }
  }

  useEffect(() => {
    if (hash && !isConfirming && !isWritePending) {
      if (isApproving) {
        toast({
          variant: "success",
          title: "Approval Transaction Confirmed",
          description: `Successfully approved ${amount} USDC`,
          action: (
            <ToastAction altText="View transaction">
              <a
                href={getBlockExplorerUrl(chainId, hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-700 hover:text-green-800"
              >
                View Tx <ExternalLink className="h-3 w-3" />
              </a>
            </ToastAction>
          ),
        })
        setNeedsApproval(false)
        setIsApproving(false)
      } else {
        toast({
          variant: "success",
          title: "Deposit Transaction Confirmed",
          description: `Successfully deposited ${amount} USDC`,
          action: (
            <ToastAction altText="View transaction">
              <a
                href={getBlockExplorerUrl(chainId, hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-700 hover:text-green-800"
              >
                View Tx <ExternalLink className="h-3 w-3" />
              </a>
            </ToastAction>
          ),
        })
        setAmount("")
        setNeedsApproval(true)
      }
    }
  }, [hash, isConfirming, isWritePending, isApproving, amount, chainId, toast])

  const isValidAmount = amount && Number.parseFloat(amount) > 0
  const maxAmount = Number.parseFloat(balance)
  const isTransactionPending = isWritePending || isConfirming
  const peerType = getPeerType(chainId)

  return (
    <Card className="bg-white border-slate-200 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">Deposit USDC</CardTitle>
        <CardDescription className="text-slate-600 text-sm">
          Deposit USDC to start earning optimized yields across chains
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chainId && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Current Network:</span>
              <span className="font-medium text-slate-900">
                {SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name || "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-600">Peer Type:</span>
              <span className="font-medium text-slate-900">
                {peerType} Peer
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="deposit-amount" className="text-slate-700 font-medium text-sm">
            Amount (USDC)
          </Label>
          <Input
            id="deposit-amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-base border-slate-300 focus:border-rose-700 focus:ring-rose-700"
            max={maxAmount}
            disabled={!isConnected}
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              Balance:{" "}
              {!isConnected ? (
                "Connect wallet"
              ) : isLoadingBalance ? (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : balanceError ? (
                <span className="text-red-600">Error loading</span>
              ) : (
                `${balance} USDC`
              )}
            </span>
            <button
              className="text-rose-700 hover:text-rose-800 disabled:text-slate-400 font-medium text-xs"
              onClick={() => setAmount(balance)}
              disabled={!isConnected || isLoadingBalance || balanceError !== null || maxAmount === 0}
            >
              Max
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">You will receive:</span>
            <span className="font-medium text-slate-900">~{amount || "0"} YieldCoin</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-600">Current APY:</span>
            <span className="text-rose-700 font-semibold">8.5%</span>
          </div>
        </div>

        <div className="space-y-2">
          {needsApproval && (
            <Button
              onClick={handleApprove}
              disabled={!isConnected || !isValidAmount || isApproving || isTransactionPending || maxAmount === 0}
              className="w-full bg-slate-900 hover:bg-black text-white text-sm py-2"
            >
              {isApproving && isTransactionPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {isApproving && isTransactionPending ? "Approving..." : "Approve USDC"}
            </Button>
          )}

          <Button
            onClick={handleDeposit}
            disabled={!isConnected || !isValidAmount || isTransactionPending || maxAmount === 0 || needsApproval}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white text-sm py-2"
          >
            {!isApproving && isTransactionPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {!isApproving && isTransactionPending ? "Depositing..." : "Deposit"}
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Your USDC will be automatically allocated to the highest-yielding strategy across supported protocols.
          {chainId === 11155111 && " As a Child Peer, your deposit will be coordinated through the Parent Peer on Avalanche Fuji."}
          {chainId === 43113 && " As the Parent Peer, your deposit will be processed directly or routed to the optimal strategy chain."}
        </p>
      </CardContent>
    </Card>
  )
}
