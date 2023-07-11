# Safe Protocol demo

This project shows the usage of [Safe protocol](https://github.com/5afe/safe-protocol)

## Useful commands

### Install

```bash
yarn
```

### Compile

```bash
yarn build
```

### Test

```bash
yarn test
```

### Deploy

```bash
yarn deploy <network>
```

### Verify

#### SafeProtocolRegistry.sol/TestSafeProtocolRegistryUnrestricted.sol
```
npx hardhat verify --network goerli <contract_address> <initial_owner>
```

#### SafeProtocolManager.sol
```
npx hardhat verify --network goerli <contract_address> <initial_owner> <registry_address>
```