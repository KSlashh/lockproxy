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
