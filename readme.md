# Typescript Aliases Transform

Small tool to parse & play with Typscript aliases.

Path Checking:

* If it contains an alias
* If it can be aliased

Path Transformation:

* Resolve full path from aliased path
* Apply aliases to a filename

Aliases list conversion:

* Generate webpack aliases
* Generate module-alias resolver

**/!\ WARNING: This package is not enough mature to be used in production.**

[![npm](https://img.shields.io/npm/v/ts-alias)](https://www.npmjs.com/package/ts-alias)

## Installation

```bash
npm install --save ts-alias
```

## API

```typescript
type AliasList = { 
    [alias: string]: { pathnames: string[], exact: boolean }
};

type TsAliasList = { [alias: string]: string[] };

type ModuleAliasList = { [alias: string]: string | Function };

type TWebpackExternals = (data: { request: string }, callback: (err: undefined, result: string) => void) => void;

class TsAlias {

    constructor( input: string | AliasList, private debug: boolean = false );

    // Original typescript aliases
    public typescript: TsAliasList;
    // Normalized list
    public list: AliasList;

    // Path transformation
    public apply(filename: string, strict?: false): string;
    public apply(filename: string, strict: true): string | null;
    public apply(filename: string, strict?: boolean): string | null;

    public containsAlias(request: string): boolean;

    public realpath(request: string, strict?: false): string;
    public realpath(request: string, strict: true): string | null;
    public realpath(request: string, strict?: boolean): string | null;

    public isAliased(filename: string): boolean;
    
    // List transformation
    public forWebpack( modulesPath?: string ): { aliases: TsAliasList };
    public forWebpack( modulesPath: string, nodeExternals: true ): { 
        aliases: TsAliasList, 
        externals: TWebpackExternals 
    };
    
    public forModuleAlias( enableCache: boolean = true ): ModuleAliasList;

}
```

## Example

```typescript
import Aliases from 'ts-alias';
const aliases = new Aliases();
// or parseAliases("./tsconfig.json");
// or parseAliases( process.cwd() + '/tsconfig.json );

console.log( 

    aliases.typescript,
    // { "@server": ["./src/server/*"] }
    
    aliases.apply('/home/dopamyn/www/project/src/server/models'),
    // "@server/models"
    
    aliases.isAliased('/home/dopamyn/www/project/src/common'),
    // false
    
    aliases.realpath('@server/models'),
    //  "/home/dopamyn/www/project/src/server/models"
    
    aliases.containsAlias('@nonExistingAlias/directory'),
    // false
    
);
```

## TODO

* More examples
* Better path resolving (traverse extends)
* Strict types checking
* Tests