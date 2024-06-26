---
title: Transformation and destination developer reference
---

> **Note:** It's worth reading the [building transformation and destination overview](/docs/cdp/build) for a quick introduction to how to build your own.

## `plugin.json` file

A `plugin.json` file is structured as follows:

```json
{
  "name": "<plugin_display_name>",
  "url": "<repo_url>",
  "description": "<description>",
  "main": "<entry_point>",
  "config": [
    {
      "markdown": "A Markdown block.\n[Use links](http://example.com) and other goodies!"
    },
    {
      "key": "param1",
      "name": "<param1_name>",
      "type": "<param1_type>",
      "default": "<param1_default_value>",
      "hint": "<param1_hint_value>",
      "required": true,
      "secret": true
    },
    {
      "key": "param2",
      "name": "<param2_name>",
      "type": "<param2_type>",
      "default": "<param2_default_value>",
      "required": false
    }
  ]
}
```

Here's an example `plugin.json` file from our ['Hello world transformation'](https://github.com/PostHog/helloworldplugin):

```json
{
  "name": "Hello World",
  "url": "https://github.com/PostHog/helloworldplugin",
  "description": "Greet the World and Foo a Bar, JS edition!",
  "main": "index.js",
  "config": [
    {
      "markdown": "This is a sample transformation!"
    },
    {
      "key": "bar",
      "name": "What's in the bar?",
      "type": "string",
      "default": "baz",
      "hint": "This will be sent in a **property**",
      "required": false
    }
  ]
}
```

Most options in this file are self-explanatory, but there are a few worth exploring further:

### `main`

`main` determines the entry point for your transformation or destination, where your `setupPlugin` and `processEvent` functions are. More on these later.

### `config`

`config` consists of an array of objects that each pertain to a specific configuration field or markdown explanation for your plugin.

Each object in a config can have the following properties:

|   Key    |                    Type                    |                                                                           Description                                                                           |
| :------ | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   type   | `"string"` or `"attachment"` or `"choice"` | Determines the type of the field - "attachment" asks the user for an upload, and "choice" requires the config object to have a `choices` array, explained below |
|   key    |                  `string`                  |                                     The key of the transformation or destination config field, used to reference the value from inside them                                      |
|   name   |                  `string`                  |                                          Displayable name of the field - appears on the transformation or destination setup in the PostHog UI                                          |
| default  |                  `string`                  |                                                                   Default value of the field                                                                    |
|   hint   |                  `string`                  |                                             More information about the field, displayed under the in the PostHog UI                                             |
| markdown |                  `string`                  |                                                             Markdown to be displayed with the field                                                             |
|  order   |                  `number`                  |                                                                           Deprecated                                                                            |
| required |                 `boolean`                  |                                               Specifies if the user needs to provide a value for the field or not                                               |
|  secret  |                 `boolean`                  |                     Secret values are write-only and never shown to the user again - useful for transformations or destinations that ask for API Keys, for example                      |
| choices  |                  `string[]`                   |                           Only accepted on configs with `type` equal to `"choice"` - an array of choices (of type `string`) to be presented to the user                            |

> **Note:** You can have a config field that only contains `markdown`. This won't be used to configure your transformation or destination but can be placed anywhere in the `config` array and is useful for customizing the content of the configuration step in the PostHog UI.

## `PluginMeta`

> Check out [types](#types) for a full spec of types.

**Every plugin server function** is called by the server with an object of type `PluginMeta` that can include `global`, `attachments`, and `config`, which you can use in your logic. 

Here's what they do:

### `config`

Gives you access to the transformation or destination's config values as described in `plugin.json` and configured via the PostHog interface.

Example:
```js
export function processEvent(event, { config }) {
    event.properties['greeting'] = config.greeting
    return event
}
```

### `global`

The `global` object is used for sharing functionality between `setupPlugin` and the rest of the special functions, like `processEvent`or `composeWebhook`, since global scope does not work in the context of PostHog transformations or destinations. `global` is not shared across worker threads

Example:
```js
export function setupPlugin({ global, config }) {
    global.eventsToTrack = (config.eventsToTrack || '').split(',') 
}

export function processEvent(event, { global, config }) {
    if(global.eventsToTrack.includes(event.event)) {
        // Do something
    }
}
```

### `attachments`

`attachments` gives access to files uploaded by the user for config parameters of type `attachment`. An `attachment` has the following type definition:

```js
interface PluginAttachment {
    content_type: string
    file_name: string
    contents: any
}
```

As such, accessing the contents of an uploaded file can be done with `attachments.attachmentName.contents`.

Example:
```js
export function setupPlugin({ attachments, global }: Meta) {
    if (attachments.maxmindMmdb) {
        global.ipLookup = new Reader(attachments.maxmindMmdb.contents)
    }
}
```

## `setupPlugin` function

`setupPlugin` is a function you can use to dynamically set transformation or destination configuration based on the user's inputs at the configuration step. 

You could, for example, check if an API Key inputted by the user is valid and throw an error if it isn't, prompting PostHog to ask for a new key.

It takes only an object of type `PluginMeta` as a parameter and does not return anything.

Example:

```js
export function setupPlugin({ global, config }) {
    global.eventsToTrack = (config.eventsToTrack || '').split(',')
}
```

On PostHog Cloud and [email-enabled](/docs/self-host/configure/email) instances of PostHog, project members are notified by email of the plugin being disabled automatically. This is to ensure that action is taken if the plugin is important for data integrity.

## `processEvent` function

`processEvent` is the juice of your transformation or destination. 

In essence, it takes an event as a parameter and returns an event as a result. In the process, this event can be:

- Modified
- Not returned (preventing ingestion)

It takes an event and an object of type `PluginMeta` as parameters and returns an event.

Here's an example (from the ['Hello World transformation'](https://github.com/PostHog/helloworldplugin)):

```js
export function processEvent(event, { config }) {
    if (!event.properties) event.properties = {}
    event.properties['greeting'] = config.greeting
    return event
}
```

As you can see, the function receives the event before it is ingested by PostHog, adds properties to it (or modifies them), and returns the enriched event, which will then be ingested by PostHog (after all transformations and destinations run).

> **Note:** You cannot use storage nor cache nor external calls in transformations or destinations in PostHog Cloud. Furthermore you can only define one of non-async `processEvent` or `composeWebhook` per transformation or destination.

## `composeWebhook` function

> **Minimum PostHog hash:** https://github.com/PostHog/posthog/commit/0137b9d40d8c0b4a7183fd6bb3c718a35d116b95

`composeWebhook` is a non-async function that is executed at the end of the pipeline. It allows users to submit data to their own HTTP endpoint when an event happens. The function can return 

- null if for a specific event we don't want to trigger an HTTP request. 

- `Webhook` object, for which we'll trigger an HTTP request to the url with the payload, method and headers returned.
If you are interested in exporting large amounts of event data from PostHog, look into [batch exports](/docs/cdp/batch-exports).

Here's a quick example:

```js
function composeWebhook(event) {
    if (event.event == '$autocapture') {
        return null
    }
    return {
        url: "http://pineapples-make-pizzas-delicious.com",
        body: JSON.stringify(event),
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
    }
}
```

> **Note:** You cannot use storage nor cache in transformations or destinations in PostHog Cloud. Furthermore you can only define one of `processEvent` or `composeWebhook` per transformation or destination.

## Testing

In order to ensure transformations and destinations are stable and work as expected for all their users, we highly recommend writing tests for every one you build.

### Adding testing capabilities

You will need to add Jest and our testing scaffold to your project in your `package.json` file:

```json
"jest": {
    "testEnvironment": "node"
},
"scripts": {
    "test": "jest ."
},
"devDependencies": {
    "@posthog/plugin-scaffold": "*",
    "jest": "^27.0.4"
}
```

Next, create your test files e.g. `index.test.js` or `index.test.ts` for testing your `index.js` or `index.ts` file.

### Writing tests

Write tests in Jest, you can learn more about the syntax and best practices in the [Jest documentation](https://jestjs.io/docs/getting-started). We recommend writing tests to cover the primary functions (e.g. does it create events in the expected format) and also for edge cases (e.g. does it crash if no data is sent).

## Logs

Transformations and destinations can make use of the `console` for logging and debugging. `console.log`, `console.warn`, `console.error`, `console.debug`, `console.info` are all supported.

These logs can be seen on the 'Logs' page of each, which can be accessed on the 'Data Pipelines' page of the PostHog UI.

Do not log a line for every event in PostHog Cloud as that would create a lot of spam and waste storage.

## Types

PostHog supports TypeScript natively, without you having to compile the TypeScript yourself (although you can also do that).

To build a TypeScript transformation or destination, you'll probably need some types, so read on.

### Installation

To use the types, you can [install them](https://github.com/PostHog/plugin-scaffold) as follows:

```bash
# if using yarn
yarn add --dev @posthog/plugin-scaffold

# if using npm
npm install --save-dev @posthog/plugin-scaffold
``` 

Then, in your transformation or destination, you can use them like so:

```typescript
import { PluginEvent, PluginMeta } from '@posthog/plugin-scaffold'

export function processEvent(event: PluginEvent, meta: PluginMeta) {
    if (event.properties) {
        event.properties['hello'] = 'world'
    }
    return event
}
```