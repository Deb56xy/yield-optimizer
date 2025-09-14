// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ParentPeer} from "../../src/peers/ParentPeer.sol";
import {Rebalancer} from "../../src/modules/Rebalancer.sol";
import {Script} from "forge-std/Script.sol";
import {HelperConfig} from "../HelperConfig.s.sol";
import {Share} from "../../src/token/Share.sol";
import {SharePool} from "../../src/token/SharePool.sol";
import {IFunctionsSubscriptions} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsSubscriptions.sol";
import {IFunctionsRouter} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsRouter.sol";
import {ITokenAdminRegistry} from "@chainlink/contracts/src/v0.8/ccip/interfaces/ITokenAdminRegistry.sol";
import {RegistryModuleOwnerCustom} from
    "@chainlink/contracts/src/v0.8/ccip/tokenAdminRegistry/RegistryModuleOwnerCustom.sol";
import {AaveV3Adapter} from "../../src/adapters/AaveV3Adapter.sol";
import {CompoundV3Adapter} from "../../src/adapters/CompoundV3Adapter.sol";
import {IYieldPeer} from "../../src/interfaces/IYieldPeer.sol";
import {StrategyRegistry} from "../../src/modules/StrategyRegistry.sol";

contract DeployParent is Script {
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

    /*//////////////////////////////////////////////////////////////
                                  RUN
    //////////////////////////////////////////////////////////////*/
    function run() public returns (DeploymentConfig memory deploy) {
        deploy.config = new HelperConfig();

        vm.startBroadcast();
        HelperConfig.NetworkConfig memory networkConfig = deploy.config.getActiveNetworkConfig();

        // Unit tests:
        deploy.clfSubId = IFunctionsSubscriptions(networkConfig.clf.functionsRouter).createSubscription();
        /// @notice Use this instead of the above line for premade subscription:
        // deploy.clfSubId = networkConfig.clf.clfSubId;

        deploy.share = new Share();
        deploy.sharePool =
            new SharePool(address(deploy.share), networkConfig.ccip.rmnProxy, networkConfig.ccip.ccipRouter);

        RegistryModuleOwnerCustom(networkConfig.ccip.registryModuleOwnerCustom).registerAdminViaOwner(
            address(deploy.share)
        );
        ITokenAdminRegistry(networkConfig.ccip.tokenAdminRegistry).acceptAdminRole(address(deploy.share));
        ITokenAdminRegistry(networkConfig.ccip.tokenAdminRegistry).setPool(
            address(deploy.share), address(deploy.sharePool)
        );

        deploy.rebalancer = new Rebalancer(networkConfig.clf.functionsRouter, networkConfig.clf.donId, deploy.clfSubId);
        deploy.parentPeer = new ParentPeer(
            networkConfig.ccip.ccipRouter,
            networkConfig.tokens.link,
            networkConfig.ccip.thisChainSelector,
            networkConfig.tokens.usdc,
            address(deploy.share)
        );

        deploy.share.grantMintAndBurnRoles(address(deploy.sharePool));
        deploy.share.grantMintAndBurnRoles(address(deploy.parentPeer));
        deploy.rebalancer.setParentPeer(address(deploy.parentPeer));
        deploy.parentPeer.setRebalancer(address(deploy.rebalancer));

        deploy.strategyRegistry = new StrategyRegistry();
        deploy.aaveV3Adapter =
            new AaveV3Adapter(address(deploy.parentPeer), networkConfig.protocols.aavePoolAddressesProvider);
        deploy.compoundV3Adapter = new CompoundV3Adapter(address(deploy.parentPeer), networkConfig.protocols.comet);
        deploy.strategyRegistry.setStrategyAdapter(
            keccak256(abi.encodePacked("aave-v3")), address(deploy.aaveV3Adapter)
        );
        deploy.strategyRegistry.setStrategyAdapter(
            keccak256(abi.encodePacked("compound-v3")), address(deploy.compoundV3Adapter)
        );
        deploy.parentPeer.setStrategyRegistry(address(deploy.strategyRegistry));
        deploy.rebalancer.setStrategyRegistry(address(deploy.strategyRegistry));
        deploy.parentPeer.setInitialActiveStrategy(keccak256(abi.encodePacked("aave-v3")));

        vm.stopBroadcast();
    }
}