import { 
    createConfig, 
    http, 
    cookieStorage,
    createStorage
  } from 'wagmi'
  import { sepolia, baseSepolia, arbitrumSepolia, optimismSepolia, avalancheFuji } from 'wagmi/chains'
  
  export function getConfig() {
    return createConfig({
      chains: [sepolia, avalancheFuji],
      ssr: true,
      storage: createStorage({
        storage: cookieStorage,
      }),
      transports: {
        [sepolia.id]: http(),
        [avalancheFuji.id]: http(),
      },
    })
  }