# Safe{Core} Protocol demo

This project shows the usage of [Safe{Core} protocol](https://github.com/5afe/safe-core-protocol)

## Structure

The project contains [contracts](./contracts), [tests](./test) and [scripts](./src/) to build a Plugin.

- [Contracts](./contracts)
  - [Imports.sol](./contracts/Imports.sol) - Import that are only used for testing and by scripts
  - [Base.sol](./contracts/Base.sol) - Types and base Plugin contracts that can be extended (i.e. to manage Plugin metadata)
  - [Plugins.sol](./contracts/Plugins.sol) - A collection of example Plugins
- [Tests](./test)
  - [RelayPlugin.spec.ts](./test/SamplePlugin.spec.ts) - Tests for the Relay example Plugin.
- [Scripts](./src)
  - [Deployment](./src/deploy) - Deployment scripts for the example Plugins
  - [Tasks](./src/tasks) - Tasks to register plugins
  - [Utils](./src/utils) - Utility method to interfact with Plugins 

## Plugin Metadata

The metadata of a Plugin is used to provide information to users when enabling the Plugin. Currently the information required is:
- `name` - Name of the Plugin that should be displayed
- `version` - Version of the Plugin that is shown to the user
- `requiresRootAccess` - Indicates if the Plugin require root access (i.e. perform `delegatecall` or change the account config).
- `iconUrl` - Icon that should be displayed
- `appUrl` - App to configure and use the Plugin

Note: The format and type of metadata currently required by Plugins is just for this demo. This will change in the future and a proper format will be proposed in the [specificiations](https://github.com/5afe/safe-core-protocol-specs)

## Contracts

### Base Contracts

The base contracts include two base contracts:

- `BasePluginWithStoredMetadata` - A plugin that stores the metadata onchain
- `BasePluginWithEventMetadata` - A plugin that stores the metadata in an event

Both allow that the web app can retrieve this metadata to display it to the user.

It is also possible to provide other storage means (i.e. `ipfs` or `url`). For this it is necessary to extend the `BasePlugin` contract and add the require utility script.

### Example Plugins

The following example are included int his repository:

- `RelayPlugin` - A plugin that allows to relay Safe transactions and pay a fee for it which is capped by the user.


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

### Interact with registry

The Registry used in this demo is a open test Registry (so no verification of Plugins or any other listing requirements).

- Register the Sample Plugin on the Registry
```bash
yarn register-plugin <network>
```

- List all Plugins in the Registry
```bash
yarn list-plugins <network>
```