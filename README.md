# lockproxy

LockProxy is a set of asset cross-chain smart contracts running on EVM-compatible chains, built upon the Polynetwork framework. Users can lock their cross-chain-assets by calling the 'lock' function on source chain. After transferring cross-chain information through Polynetwork, they can trigger the 'unlock' function on target chain to receive their target chain assets.

This repo contains some variants of lockproxy.

## [LockProxyPausable](./contracts/core/LockProxyPausable.sol)

Basic LockProxy that implement lock/unlock, pause/unpause functions.

## [LockProxyLimited](./contracts/core/LockProxyLimited.sol)

LockProxyLimited introduces a limit feature, preventing transactions exceeding a specified threshold from being settled within a designated time period. 

While this limit may impose certain restrictions, it serves to mitigate potential losses in the event of unexpected circumstances.

## [LockProxyReviewable](./contracts/core/LockProxyReviewable.sol)

LockProxyReviewable incorporates a review feature, requiring transactions exceeding a specified threshold to undergo an approval process before the funds can be credited.

Introducing the review feature may lead to longer settlement times for large transactions, but it enhances overall security.

## Deployment

1. install hardhat and prepare hardhat.config.js
2. prepare polyConfig.json, ensure that the network naming is consistent between 'hardhat.config.js' and 'polyConfig.json', example:
```
{
  "Networks": [
    {
      "Name":"goeril",
      "EthCrossChainManagerProxy":"0xC8042579D6b60E0e35161F228827E3Fa0F51d5B6",
    },
    {
      "Name":"bsc-testnet",
      "EthCrossChainManagerProxy":"0x441C035446c947a97bD36b425B67907244576990",
    }
  ]
}
```
3. run scripts

+ for LockProxyPausable: 
```
hardhat run ./scripts/LockProxyPausable.sol
```

+ for LockProxyLimited: 
```
hardhat run ./scripts/LockProxyLimited.sol
```

+ for LockProxyReviewable: 
```
hardhat run ./scripts/LockProxyReviewable.sol
```