# MULTISIG WALLET DASHBOARD

[![Deployed on Sepolia](https://img.shields.io/badge/Etherscan-Verified-brightgreen)](https://sepolia.etherscan.io/address/0xdF102938A7E1a9b387f70a229C8D2D43f5663368#code)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/Built%20with-React-blue)
![Ethers.js](https://img.shields.io/badge/Ethers.js-5.8-purple)

Built by [Tredway Development](https://tredwaydev.com) — professional Solidity smart contract packages for Web3 companies.

A production-ready React dashboard for the MultiSigWallet smart contract. Allows multiple owners to submit, approve, revoke, and execute transactions collectively — no single wallet has unilateral control.

> ⚠️ This dashboard connects to contracts deployed on Sepolia testnet. A full security audit is strongly recommended before any mainnet deployment.

## LIVE DEMO

[token-multisig-dashboard.netlify.app](https://token-multisig-dashboard.netlify.app)

## PROJECT GOALS

The purpose of this dashboard is to give teams a clear, trustless interface for managing shared contract control through a multi-signature approval process.

Owners can submit transactions, approve or revoke their signature, and execute transactions once the required threshold is met. No single owner can act alone. The contract enforces consensus.

## DASHBOARD FEATURES

OWNER DETECTION

The dashboard automatically detects whether the connected wallet is an owner of the multisig. The submit transaction form is only visible to owners. Non-owners can view transaction history and approval status but cannot interact.

SUBMIT TRANSACTION

Owners can propose any transaction by entering a destination address, optional ETH value, and optional encoded call data. Submitted transactions enter a pending state until enough owners approve.

APPROVAL PROGRESS BAR

Each pending transaction displays a live approval progress bar showing current approvals against the required threshold. The bar turns green when the threshold is met and the execute button appears.

APPROVE AND REVOKE

Owners can approve any pending transaction with one click. If they change their mind they can revoke their approval before execution. The approval count updates in real time.

EXECUTE

Once the required number of approvals is reached any owner can execute the transaction. The execute button only appears when the threshold is met.

PENDING / EXECUTED / ALL FILTER

Filter transactions by pending, executed, or full history to keep the interface clean regardless of transaction volume.

WRONG NETWORK PROTECTION

The dashboard detects the connected network and alerts the user if they are not on Sepolia or Localhost 8545.

ETHERSCAN INTEGRATION

Successful transactions on Sepolia link directly to Etherscan for full transparency.

## TECHNOLOGY STACK

React — Frontend framework

Ethers.js 5.8 — Contract interaction library

Solidity 0.8.19 — Smart contract language

Hardhat — Development and deployment environment

OpenZeppelin — Audited smart contract libraries

Alchemy — Ethereum RPC provider

Sepolia Test Network — Deployment environment

MetaMask — Wallet connection

## PROJECT STRUCTURE

src/
    App.js
    App.css
    contracts/
        MultiSigWallet.json
        localhost.json
        sepolia.json

public/
    td-logo-justtd.png

## INSTALLATION

### CLONE THE REPOSITORY:

git clone https://github.com/Ktredway0128/token-multisig-dashboard.git

cd token-multisig-dashboard

### INSTALL DEPENDENCIES:

npm install

### ADD ENVIRONMENT VARIABLE:

Create a .env file in the root directory:

REACT_APP_ALCHEMY_URL=YOUR_SEPOLIA_RPC_URL

### START THE DASHBOARD:

npm start

## LOCAL DEVELOPMENT

To run against a local Hardhat node:

1. Start the Hardhat node in your contract project:

npx hardhat node

2. Deploy the contracts locally:

npx hardhat run scripts/deploy-multisig.js --network localhost

3. Update src/contracts/localhost.json with the deployed addresses

4. Connect MetaMask to Localhost 8545 and import a Hardhat test account

5. Start the dashboard and connect your wallet

## SEPOLIA TESTNET DEPLOYMENT

| Contract | Address | Etherscan |
|----------|---------|-----------|
| MultiSigWallet | 0xdF102938A7E1a9b387f70a229C8D2D43f5663368 | [View on Etherscan](https://sepolia.etherscan.io/address/0xdF102938A7E1a9b387f70a229C8D2D43f5663368#code) |

Deployed: TBD

## CONNECTED CONTRACT

This dashboard connects to the MultiSigWallet smart contract.

Contract repository: [token-multisig](https://github.com/Ktredway0128/token-multisig)

## SECURITY PRACTICES

No admin keys or single point of control — consensus is enforced by the contract

ReentrancyGuard on the execute function

Checks-effects-interactions pattern — state updated before external calls

Owner detection prevents non-owners from submitting transactions

Wrong network detection prevents accidental transactions

## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist

tredwaydev.com | @kyletredwaydev

## LICENSE

MIT License