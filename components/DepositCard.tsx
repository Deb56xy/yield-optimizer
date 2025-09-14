"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw, ExternalLink, ArrowRight } from "lucide-react"
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useWalletClient, usePublicClient } from "wagmi"
import { CONTRACTS, SUPPORTED_CHAINS, CHAIN_SELECTORS } from "@/utils/constants"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { parseUnits } from "viem"
import * as CCIP from "@chainlink/ccip-js"

export function DepositCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  })
  const { toast } = useToast()
  const { switchChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Initialize CCIP client - this was missing!
  const ccipClient = CCIP.createClient()
  
  const [isBridging, setIsBridging] = useState(false)
  const [bridgeStatus, setBridgeStatus] = useState("")
  const [needsBridge, setNeedsBridge] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)
  const [needsBridgeApproval, setNeedsBridgeApproval] = useState(false)
  const [isApprovingForBridge, setIsApprovingForBridge] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState("")
  const [isEstimatingFee, setIsEstimatingFee] = useState(false)

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

  useEffect(() => {
    if (chainId === 11155111) {
      setNeedsBridge(true)
      setNeedsBridgeApproval(true)
    } else {
      setNeedsBridge(false)
      setNeedsBridgeApproval(false)
    }
  }, [chainId])

  // Check approval when amount or source chain changes
  useEffect(() => {
    const checkApproval = async () => {
      if (!amount || !address || !chainId || chainId !== 11155111 || !publicClient) {
        setNeedsBridgeApproval(true)
        return
      }

      // Use consistent contract addresses from constants
      const routerAddress = CONTRACTS.CCIP_ROUTER?.[11155111] || "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
      const usdcAddress = CONTRACTS.USDC[11155111]

      if (!routerAddress || !usdcAddress) return

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
          args: [address as `0x${string}`, routerAddress as `0x${string}`],
        })

        setNeedsBridgeApproval((allowance as bigint) < amountWei)
      } catch (error) {
        console.error("Error checking approval:", error)
        setNeedsBridgeApproval(true)
      }
    }

    checkApproval()
  }, [amount, address, chainId, publicClient])

  // Check approval for direct deposits (non-bridge)
  useEffect(() => {
    const checkDirectApproval = async () => {
      if (!amount || !address || !chainId || chainId === 11155111 || !publicClient) {
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
        console.error("Error checking direct approval:", error)
        setNeedsApproval(true)
      }
    }

    checkDirectApproval()
  }, [amount, address, chainId, publicClient])

  // Estimate fee when parameters change
  useEffect(() => {
    const estimateFee = async () => {
      if (!amount || !address || chainId !== 11155111 || !publicClient) {
        setEstimatedFee("")
        return
      }

      // Use consistent contract addresses
      const routerAddress = CONTRACTS.CCIP_ROUTER?.[11155111] || "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
      const usdcAddress = CONTRACTS.USDC[11155111]
      const destChainSelector = CHAIN_SELECTORS[43113] // Avalanche Fuji selector

      if (!routerAddress || !usdcAddress || !destChainSelector) return

      setIsEstimatingFee(true)

      try {
        const amountWei = parseUnits(amount, 6) // USDC has 6 decimals

        const fee = await ccipClient.getFee({
          client: publicClient,
          routerAddress: routerAddress as `0x${string}`,
          tokenAddress: usdcAddress as `0x${string}`,
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
  }, [amount, address, chainId, publicClient, ccipClient])

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

  const handleBridgeApproval = async () => {
    if (!chainId || !address || !amount || !walletClient) {
      console.error("Missing requirements for bridge approval")
      return
    }

    if (chainId !== 11155111) {
      console.error("Bridge approval only for Ethereum Sepolia")
      return
    }

    try {
      setIsApprovingForBridge(true)
      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals
      
      // Use consistent contract addresses
      const routerAddress = CONTRACTS.CCIP_ROUTER?.[11155111] || "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
      const usdcAddress = CONTRACTS.USDC[11155111]

      setBridgeStatus("Approving USDC for bridge...")

      // Use CCIP client for router approval (same as bridge page)
      const { txHash } = await ccipClient.approveRouter({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: usdcAddress as `0x${string}`,
        amount: amountWei,
        waitForReceipt: false,
      })

      setBridgeStatus(`Approval sent: ${txHash.slice(0, 10)}...`)

      // Wait for confirmation
      await ccipClient.approveRouter({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: usdcAddress as `0x${string}`,
        amount: amountWei,
        waitForReceipt: true,
      })

      console.log("Bridge approval transaction completed")
      setNeedsBridgeApproval(false)
      setIsApprovingForBridge(false)
      setBridgeStatus("USDC approved for bridging!")

      toast({
        variant: "success",
        title: "Bridge Approval Successful",
        description: `Successfully approved ${amount} USDC for bridging`,
        action: (
          <ToastAction altText="View transaction">
            <a
              href={getBlockExplorerUrl(chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-700 hover:text-green-800"
            >
              View Tx <ExternalLink className="h-3 w-3" />
            </a>
          </ToastAction>
        ),
      })
    } catch (error) {
      console.error("Bridge approval failed:", error)
      setIsApprovingForBridge(false)
      setBridgeStatus("Bridge approval failed")

      toast({
        variant: "destructive",
        title: "Bridge Approval Failed",
        description: `Transaction was rejected or failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    }
  }

  const handleBridgeAndDeposit = async () => {
    if (!chainId || !address || !amount || !walletClient) {
      console.error("Missing requirements for bridge and deposit")
      return
    }

    if (chainId !== 11155111) {
      console.error("Bridge function only for Ethereum Sepolia")
      return
    }

    try {
      setIsBridging(true)
      setBridgeStatus("Initiating bridge from Ethereum Sepolia to Avalanche Fuji...")

      const amountWei = parseUnits(amount, 6) // USDC has 6 decimals
      
      // Use consistent contract addresses
      const routerAddress = CONTRACTS.CCIP_ROUTER?.[11155111] || "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
      const usdcAddress = CONTRACTS.USDC[11155111]
      const destChainSelector = CHAIN_SELECTORS[43113] // Avalanche Fuji selector

      if (!routerAddress || !usdcAddress || !destChainSelector) {
        throw new Error("Missing contract addresses or chain selector")
      }

      setBridgeStatus("Bridging USDC to Avalanche Fuji...")
      
      const { txHash, messageId } = await ccipClient.transferTokens({
        client: walletClient,
        routerAddress: routerAddress as `0x${string}`,
        tokenAddress: usdcAddress as `0x${string}`,
        amount: amountWei,
        destinationAccount: address as `0x${string}`,
        destinationChainSelector: destChainSelector,
      })

      setBridgeStatus(`Bridge initiated! TX: ${txHash.slice(0, 10)}... | Message ID: ${messageId.slice(0, 10)}...`)

      setBridgeStatus("Switching to Avalanche Fuji...")
      setIsSwitchingChain(true)
      
      if (switchChain) {
        await switchChain({ chainId: 43113 })
      }
      
      setIsSwitchingChain(false)

      setBridgeStatus("Bridge completed! You can now deposit on Avalanche Fuji.")
      setNeedsBridge(false)
      setAmount("") // Reset form
      setNeedsBridgeApproval(true) // Reset for next time

      toast({
        variant: "success",
        title: "Bridge Successful",
        description: `Successfully bridged ${amount} USDC to Avalanche Fuji`,
        action: (
          <ToastAction altText="View transaction">
            <a
              href={`https://ccip.chain.link/#/side-drawer/msg/${messageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-700 hover:text-green-800"
            >
              View Bridge <ExternalLink className="h-3 w-3" />
            </a>
          </ToastAction>
        ),
      })
    } catch (error) {
      console.error("Bridge failed:", error)
      setBridgeStatus(`Bridge failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      toast({
        variant: "destructive",
        title: "Bridge Failed",
        description: `Transaction was rejected or failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    } finally {
      setIsBridging(false)
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
        gas: 500000n, // Add explicit gas limit for testing
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

  return (
    <Card className="bg-white border-slate-200 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">Deposit USDC</CardTitle>
        <CardDescription className="text-slate-600 text-sm">
          {needsBridge
            ? "Bridge USDC from Ethereum Sepolia to Avalanche Fuji, then deposit to start earning yields"
            : "Deposit USDC to start earning optimized yields across chains"}
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
            {needsBridge && (
              <div className="flex items-center mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                <ArrowRight className="h-3 w-3 mr-1" />
                Will bridge to Avalanche Fuji before depositing
              </div>
            )}
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

        {/* Fee Display */}
        {estimatedFee && needsBridge && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Bridge Fee:</span>
              <span className="font-medium text-slate-900">
                {isEstimatingFee ? "Calculating..." : `~${estimatedFee} ETH`}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Fee paid in ETH on Ethereum Sepolia
            </div>
          </div>
        )}

        {bridgeStatus && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="text-xs text-blue-800 font-medium">Bridge Status: {bridgeStatus}</div>
          </div>
        )}

        <div className="space-y-2">
          {needsBridge ? (
            <>
              {needsBridgeApproval && (
                <Button
                  onClick={handleBridgeApproval}
                  disabled={
                    !isConnected || !isValidAmount || isApprovingForBridge || isTransactionPending || maxAmount === 0 || !walletClient
                  }
                  className="w-full bg-slate-900 hover:bg-black text-white text-sm py-2"
                >
                  {isApprovingForBridge && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  {isApprovingForBridge ? "Approving for Bridge..." : "Approve for Bridge"}
                </Button>
              )}

              <Button
                onClick={handleBridgeAndDeposit}
                disabled={
                  !isConnected ||
                  !isValidAmount ||
                  isBridging ||
                  isSwitchingChain ||
                  maxAmount === 0 ||
                  !walletClient ||
                  needsBridgeApproval
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2"
              >
                {(isBridging || isSwitchingChain) && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isBridging
                  ? "Bridging & Depositing..."
                  : isSwitchingChain
                    ? "Switching Network..."
                    : "Bridge & Deposit"}
              </Button>
            </>
          ) : (
            <>
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
                disabled={!isConnected || !isValidAmount || isTransactionPending || maxAmount === 0}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white text-sm py-2"
              >
                {!isApproving && isTransactionPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {!isApproving && isTransactionPending ? "Depositing..." : "Deposit"}
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-slate-500">
          {needsBridge
            ? "Your USDC will be bridged to Avalanche Fuji and automatically allocated to the highest-yielding strategy."
            : "Your USDC will be automatically allocated to the highest-yielding strategy across supported protocols."}
        </p>
      </CardContent>
    </Card>
  )
}