// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {HelperConfig} from "../HelperConfig.s.sol";
import {ChildPeer} from "../../src/peers/ChildPeer.sol";
import {Share} from "../../src/token/Share.sol";
import {SharePool} from "../../src/token/SharePool.sol";
import {AaveV3Adapter} from "../../src/adapters/AaveV3Adapter.sol";
import {CompoundV3Adapter} from "../../src/adapters/CompoundV3Adapter.sol";
import {StrategyRegistry} from "../../src/modules/StrategyRegistry.sol";

contract DeployEthSepoliaChild is Script {
    struct DeploymentConfig {
        Share share;
        SharePool sharePool;
        ChildPeer childPeer;
        HelperConfig config;
        StrategyRegistry strategyRegistry;
        AaveV3Adapter aaveV3Adapter;
        CompoundV3Adapter compoundV3Adapter;
    }

    function run() public returns (DeploymentConfig memory deploy) {
        require(block.chainid == 11155111, "This script is only for Ethereum Sepolia (chainId: 11155111)");
        
        deploy.config = new HelperConfig();

        vm.startBroadcast();
        HelperConfig.NetworkConfig memory networkConfig = deploy.config.getActiveNetworkConfig();

        // Use existing Share token and SharePool from config
        deploy.share = Share(networkConfig.tokens.share);
        deploy.sharePool = SharePool(networkConfig.peers.localSharePool);

        console.log("Using existing Share token:", networkConfig.tokens.share);
        console.log("Using existing SharePool:", networkConfig.peers.localSharePool);

        // Deploy only the new contracts needed
        deploy.childPeer = new ChildPeer(
            networkConfig.ccip.ccipRouter,
            networkConfig.tokens.link,
            networkConfig.ccip.thisChainSelector,
            networkConfig.tokens.usdc,
            networkConfig.tokens.share,  // Use existing share token address
            networkConfig.ccip.parentChainSelector
        );

        // Deploy and configure strategy components
        deploy.strategyRegistry = new StrategyRegistry();
        deploy.aaveV3Adapter = new AaveV3Adapter(
            address(deploy.childPeer), 
            networkConfig.protocols.aavePoolAddressesProvider
        );
        deploy.compoundV3Adapter = new CompoundV3Adapter(
            address(deploy.childPeer), 
            networkConfig.protocols.comet
        );
        
        // Register strategy adapters
        deploy.strategyRegistry.setStrategyAdapter(
            keccak256(abi.encodePacked("aave-v3")), 
            address(deploy.aaveV3Adapter)
        );
        deploy.strategyRegistry.setStrategyAdapter(
            keccak256(abi.encodePacked("compound-v3")), 
            address(deploy.compoundV3Adapter)
        );
        
        // Connect strategy registry to child peer
        deploy.childPeer.setStrategyRegistry(address(deploy.strategyRegistry));

        vm.stopBroadcast();

        // Log deployment results
        console.log("=== ETHEREUM SEPOLIA CHILD PEER DEPLOYMENT ===");
        console.log("Existing Share Token:", networkConfig.tokens.share);
        console.log("Existing SharePool:", networkConfig.peers.localSharePool);
        console.log("NEW ChildPeer:", address(deploy.childPeer));
        console.log("NEW StrategyRegistry:", address(deploy.strategyRegistry));
        console.log("NEW AaveV3Adapter:", address(deploy.aaveV3Adapter));
        console.log("NEW CompoundV3Adapter:", address(deploy.compoundV3Adapter));
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Update ETH_SEPOLIA_PEER constant to:", address(deploy.childPeer));
        console.log("2. Grant mint/burn roles to ChildPeer (if you're the Share token owner):");
        console.log("   share.grantMintAndBurnRoles(%s);", address(deploy.childPeer));
        console.log("3. Update your frontend config with the new ChildPeer address");
        console.log("4. Configure parent peer to recognize this child peer");
    }
}