# Safe{Core} Protocol Demo - Web App

This web app demonstrates how to interact with the Registry, the Manager and the [Sample Plugin](../contracts/). For this the following use cases are covered:

- [Manage Plugins](../src/routes/plugins)
    - The a list of all available plugins
    - Enable/disable a plugin
    - Open plugin app page
- [Sample Plugin App Page](../src/routes/samples)
    - Configure Sample Plugin
    - Use Sample Plugin

### Sample Plugins

- [Relay Plugin](../src/routes/samples/relay) - A plugin that allows to relay Safe transactions and pay a fee for it which is capped by the user.

Note: If more examples are added or the code is updated to a new plugin, make sure to replace all hardcoded addresses (i.e. in the `sample.ts` file)

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### `yarn deploy`

Deploys the current web app version as a production build to [GitHub pages](https://pages.github.com)