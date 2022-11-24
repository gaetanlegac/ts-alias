# Typescript Aliases Transform

A NodeJS library to parse, process and convert Typescript aliases from tsconfig.json.

[![npm](https://img.shields.io/npm/v/ts-alias)](https://www.npmjs.com/package/ts-alias) [![npm](https://img.shields.io/npm/dw/ts-alias)](https://www.npmjs.com/package/ts-alias)

## Use cases

We all agree that module aliases are useful to maintain a clean and readable code.

But it's frequent that, in large projects, you have to define your same aliases in multiple tools in order to ensure everything runs correctly.

Also, some tools doesn't support defining custom node_module paths for these aliases, which can be locking in some complex projects.

**I wrote this library to avoid the redondancy between my tsconfig.js, Webpack and module-alias configuration in my projects.**

I assumed that the tsconfig.js format is the most universal, and can be reliably converted to aliases list for other tools like [module-alias](https://github.com/ilearnio/module-alias) and the [Webpack](https://github.com/webpack/webpack) package.

By parsing your tsconfig, defining custom rules if necessary, and exporting them for your other aliasing tools, it lightens your maintenance and debugging work.

**Are you using this module for another purpose ? Don't hesitate to create a PR so we can list it here!**

-----------

<p align="center">
    This project helped you ? Let me know,
    <a target="_blank" href="https://github.com/gaetanlegac/ts-alias/stargazers"><b>⭐ Give it a Star :)</b></a>
</p>

------------

## Install

```bash
npm i --save ts-alias
```

## Instanciate

The constructor loads the Typescript aliases in the memory.
It can be loaded by two different ways:

### From a tsconfig.json file

1. By default, it will search the tsconfig in the current working directory of the process (`process.cwd()`).

```typescript
import Aliases from 'ts-alias';
const aliases = new Aliases();
```

2. You can specify in path of the directory containing the tsconfig with the `rootDir` option.
This path can be absolute, or relative (from the process working directory).

```typescript
const aliases = new Aliases({ 
    rootDir: './packages/module-containing-a-tsconfig' 
});
```

3. It's possible to directly provide the tsconfig file path:

```typescript
const aliases = new Aliases({ 
    rootDir: './packages/module-containing-a-tsconfig/tsconfig.json' 
});
```

An Error will be throwed if rootDir doesn't exists.

### From an AliasList object

If for any reason, you already loaded the tsconfig aliases in memory, you can provide them via the `aliases` option:

```typescript
const list = {
    '@server': {
        // A list of destination paths
        pathnames: ['./src/server'],
        // If exact = true, only "@server" will be matched
        // If exact = false, "@server" and "@server/*" will be matched
        exact: false
    },
    'react': {
        // pathnames can also be module names
        pathnames: ['preact'],
        exact: true
    },
}

const aliases = new Aliases({ aliases: list });
```

### Specify the module path

As you saw upper, alias destinations can also be package names.
Thanks to the `modulesDir` option, you can define in which node_modules directory your package should be looked for.

```typescript
const aliases = new Aliases({
    modulesDir: ['./node_modules', '../../global_node_modules']
});
```

**Warning**: This feature is experimental. It could lead to resolution problems in some cases.

**Note**: Only relative paths are supported for now.

### Debug

Are you facing to a resolution problem ? Do you balieve these is a bug in this lib ?

That's not impossible 🤔

To better understands what ts-alias actually does in your case, you can enable advanced logs with the `debug` option:

```typescript
const aliases = new Aliases({
    debug: true
});
```

## Test if a path can be shorten with an alias

```typescript
public isAliased( filename: string ): boolean;
```

```typescript
aliases.isAliased("./src/server/services/user");
// Result: true

aliases.isAliased("./src");
// Result: false
```

## Shorten / Replace real path by alias

```typescript
public apply( realpath: string, strict?: false ): string;
public apply( realpath: string, strict: true ): string | null;
public apply( realpath: string, strict?: boolean ): string | null;
```

```typescript
aliases.apply("./src/server/services/user");
// Result: "@server/services/user"

aliases.apply("react");
// Result: "./node_modules/react"
```

When the realpath couldn't be replaced with an alias:
* When strict is true, null will be returned.
* Otherwise, the original realpath will be returned, without any alias

## Test if a path contains an alias

```typescript
 public isAliased( filename: string ): boolean;
```

```typescript
aliases.containsAlias("@server/services/user");
// Result: true

aliases.containsAlias("./src/server/services/user");
// Result: false
```

## Replace alias by real path

```typescript
public realpath( request: string, strict?: false): string;
public realpath( request: string, strict: true): string | null;
public realpath( request: string, strict?: boolean): string | null;
```

```typescript
aliases.realpath("@server/services/user");
// Result: "/home/gaetan/projects/myproject/src/server/services/user"

aliases.realpath("./node_modules/react");
// Result: "preact"
```

## Convert the aliases list for [Webpack 5](https://github.com/webpack/webpack)

```typescript
const webpackAliases = aliases.forWebpack();

module.export = {
    ...
    resolve: {
        alias: webpackAliases
    }
    ...
}
```

## Convert the aliases list for [module-alias](https://github.com/ilearnio/module-alias)

```typescript
import moduleAlias from 'module-alias';

moduleAlias.addAliases( aliases.forModuleAlias() );
```

-----------

<p align="center">
    This project helped you ? Let me know,
    <a target="_blank" href="https://github.com/gaetanlegac/ts-alias/stargazers"><b>⭐ Give it a Star :)</b></a>
</p>

-----------

## TODO

* Tests (the current version lacks of tests)
* Strict types checking
* Better path resolving (traverse extends)