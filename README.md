# Safe{Core} Protocol Demo

This repository contain a demo for developing and using [Plugins](https://github.com/5afe/safe-core-protocol-specs/tree/main/integrations#plugins) from the Safe{Core} Protocol.

## Structure

The repository is separated into two parts:

- [Contracts](./contracts/) contains the sample contracts and scripts to deploy them
- [Web App](./web/) contains the web app to configure and use the sample contracts

## Make it your own

To get started with your own plugin you can fork/ copy this repository and adjust the existing code.

Follow the instructions in the [Contracts](./contracts/) folder to create a Plugin for your use case. You can then register the plugin on a test registry and it will be visible on [Demo App](https://5afe.github.io/safe-core-protocol-demo).

This [Demo App](https://5afe.github.io/safe-core-protocol-demo) can be used as a [Safe app in the Safe{Wallet} Web](https://app.safe.global/share/safe-app?appUrl=https%3A%2F%2F5afe.github.io%2Fsafe-core-protocol-demo&chain=gor) interface to add the Plugin to a Safe.

To configure your Plugin it is necessary to create a web app. For this follow the instructions in the [Web App](./web/) folder. A simple way to host your web app is to use [GitHub pages](https://pages.github.com/). For this you can use the `yarn deploy` script.

Important don't forget to update your [Plugin Metadata](./contracts/README.md#plugin-metadata).