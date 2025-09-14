// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ParentPeer} from "../../src/peers/ParentPeer.sol";
import {Rebalancer} from "../../src/modules/Rebalancer.sol";
import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {HelperConfig} from "../HelperConfig.s.sol";
import {Share} from "../../src/token/Share.sol";
import {SharePool} from "../../src/token/SharePool.sol";
import {IFunctionsSubscriptions} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsSubscriptions.sol";
import {AaveV3Adapter} from "../../src/adapters/AaveV3Adapter.sol";
import {CompoundV3Adapter} from "../../src/adapters/CompoundV3Adapter.sol";
import {StrategyRegistry} from "../../src/modules/StrategyRegistry.sol";

contract DeployAvalancheParent is Script {
    struct DeploymentConfig {
        Share share;
        SharePool sharePool;
        ParentPeer parentPeer;
        Rebalancer rebalancer;
        HelperConfig config;
        uint64 clfSubId;
        StrategyRegistry strategyRegistry;
        AaveV3Adapter aaveV3Adapter;
        CompoundV3Adapter compoundV3Adapter;
    }

    function run() public returns (DeploymentConfig memory deploy) {
        require(block.chainid == 43113, "This script is only for Avalanche Fuji (chainId: 43113)");
        
        deploy.config = new HelperConfig();

        vm.startBroadcast();
        HelperConfig.NetworkConfig memory networkConfig = deploy.config.getActiveNetworkConfig();

        // Use existing Share token and SharePool from config
        deploy.share = Share(networkConfig.tokens.share);
        deploy.sharePool = SharePool(networkConfig.peers.localSharePool);

        console.log("Using existing Share token:", networkConfig.tokens.share);
        console.log("Using existing SharePool:", networkConfig.peers.localSharePool);

        // Use existing CLF subscription ID instead of creating new one
        deploy.clfSubId = networkConfig.clf.clfSubId;
        console.log("Using existing CLF subscription ID:", deploy.clfSubId);

        // Deploy only the new contracts needed
        deploy.rebalancer = new Rebalancer(
            networkConfig.clf.functionsRouter, 
            networkConfig.clf.donId, 
            deploy.clfSubId
        );
        
        deploy.parentPeer = new ParentPeer(
            networkConfig.ccip.ccipRouter,
            networkConfig.tokens.link,
            networkConfig.ccip.thisChainSelector,
            networkConfig.tokens.usdc,
            networkConfig.tokens.share  // Use existing share token address
        );

        // Set up relationships
        deploy.rebalancer.setParentPeer(address(deploy.parentPeer));
        deploy.parentPeer.setRebalancer(address(deploy.rebalancer));

        // Deploy and configure strategy components
        deploy.strategyRegistry = new StrategyRegistry();
        deploy.aaveV3Adapter = new AaveV3Adapter(
            address(deploy.parentPeer), 
            networkConfig.protocols.aavePoolAddressesProvider
        );
        deploy.compoundV3Adapter = new CompoundV3Adapter(
            address(deploy.parentPeer), 
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
        
        // Connect strategy registry
        deploy.parentPeer.setStrategyRegistry(address(deploy.strategyRegistry));
        deploy.rebalancer.setStrategyRegistry(address(deploy.strategyRegistry));
        deploy.parentPeer.setInitialActiveStrategy(keccak256(abi.encodePacked("aave-v3")));

        vm.stopBroadcast();

        // Log deployment results
        console.log("=== AVALANCHE FUJI PARENT PEER DEPLOYMENT ===");
        console.log("Existing Share Token:", networkConfig.tokens.share);
        console.log("Existing SharePool:", networkConfig.peers.localSharePool);
        console.log("NEW ParentPeer:", address(deploy.parentPeer));
        console.log("NEW Rebalancer:", address(deploy.rebalancer));
        console.log("NEW StrategyRegistry:", address(deploy.strategyRegistry));
        console.log("NEW AaveV3Adapter:", address(deploy.aaveV3Adapter));
        console.log("NEW CompoundV3Adapter:", address(deploy.compoundV3Adapter));
        console.log("Using CLF Subscription ID:", deploy.clfSubId);
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Update AVALANCHE_FUJI_PEER constant to:", address(deploy.parentPeer));
        console.log("2. Grant mint/burn roles to ParentPeer (if you're the Share token owner):");
        console.log("   share.grantMintAndBurnRoles(%s);", address(deploy.parentPeer));
        console.log("3. Update your frontend config with the new ParentPeer address");
        console.log("4. Ensure CLF subscription ID has sufficient LINK balance:", deploy.clfSubId);
        console.log("5. Add the Rebalancer as a consumer to the CLF subscription");
    }
}