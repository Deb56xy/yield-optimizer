export const CONTRACTS = {
    PARENT_PEER: {
        address: "0x6FC54920AB230872C3CbA638039deF4920284c9F", // ParentPeer on Avalanche Fuji
        chainId: 43113, // Ethereum Sepolia
    },
    CHILD_PEERS: {
        ETH_SEPOLIA: {
          address: "0x69Bf065eAE8fbA65ddf51c55E069AE93cD5b9806", // Child on Base Sepolia
          chainId: 11155111,
        },
      },
      USDC: {
        11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Eth Sepolia
        84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
        43113: "0x5425890298aed601595a70AB815c96711a31Bc65", // Avalanche Fuji
      },
      LINK: {
        11155111: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        43113: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
      },
      YIELDAVAX: {
        11155111: "0x5C5f07FD137Aa38860B5fA2ca5671bd5C49333B4", // Eth Sepolia
        84532: "0x771ceed62ac79cBa5Ec557b8095b8Cdc13559dD3", // Base Sepolia
        43113: "0x550a6bef9fa59639Cd73126D7D066948280f9FB9", // Avalanche Fuji
      }
}

export const SUPPORTED_CHAINS = [
    {
      id: 11155111,
      name: "Ethereum Sepolia",
      shortName: "Ethereum",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      blockExplorer: "https://sepolia.etherscan.io",
      isParent: false, // Mark as parent chain
    },
    {
      id: 84532,
      name: "Base Sepolia",
      shortName: "Base",
      rpcUrl: "https://sepolia.base.org",
      blockExplorer: "https://sepolia.basescan.org",
      isParent: false,
    },
    {
      id: 43113,
      name: "Avalanche Fuji",
      shortName: "Avalanche",
      rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
      blockExplorer: "https://testnet.snowtrace.io",
      isParent: true,
    },
  ] as const

  // CCIP Chain Selectors
export const CHAIN_SELECTORS = {
    11155111: "16015286601757825753", // ETH_SEPOLIA_CHAIN_SELECTOR
    84532: "10344971235874465080", // BASE_SEPOLIA_CHAIN_SELECTOR
    43113: "14767482510784806043", // AVALANCHE_FUJI_CHAIN_SELECTOR
  } as const
  
  // Protocol enum mapping
  export const PROTOCOLS = {
    0: "Aave",
    1: "Compound",
  } as const