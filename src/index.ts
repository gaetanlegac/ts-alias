/*----------------------------------
- DEPENDANCES
----------------------------------*/

import JSON5 from 'json5'; // Because tsconfig.json is closer to json5 rather than json
import fs from 'fs';
import path from 'path';

/*----------------------------------
- CONFIG
----------------------------------*/

const LogPrefix = '[ts-alias]';

/*----------------------------------
- TYPES
----------------------------------*/

export type TOptions = ({
    rootDir?: string,
} | {
    aliases: AliasDefinition[]
}) & {
    modulesDir?: string[],
    debug?: boolean,
}

type TsConfig = { paths: TsAliasList, baseUrl: string }

export type AliasDefinition = { 
    alias: string,
    pathnames: string[], 
    exact: boolean
}

type TsAliasList = { [alias: string]: string[] };

type ModuleAliasList = { [alias: string]: string | Function };

type TWebpackExternals = (
    data: { request: string }, 
    callback: (err: undefined, result: string) => void
) => void;

/*----------------------------------
- MODULE
----------------------------------*/
export default class TsAlias {

    // Original typescript aliases
    public typescript: TsAliasList;
    // Normalized list
    public list: AliasDefinition[];

    public constructor( private options: TOptions = {} ) {

        this.options.debug && console.log(LogPrefix, `Instanciate with the following options:`, options);

        let tsFile: string;
        let tsDir: string;

        // Aliases list already provided
        // No need to search and read the tsconfig file
        if ('aliases' in options) {
            this.list = options.aliases.map((alias) => ({
                ...alias,
                pathnames: alias.pathnames.map(
                    pathname => path.join( process.cwd(), pathname )
                )
            }))
            this.options.debug && console.log(LogPrefix, `Loaded aliases from object`, options.aliases, '=>', this.list);
            return;
        }

        // Use the CWD by default
        if (options.rootDir === undefined)
            options.rootDir = process.cwd();
        else {

            // Ensure the path is absolute
            if (!path.isAbsolute( options.rootDir ))
                options.rootDir = path.join(process.cwd(), options.rootDir);

            // And it exists
            if (!fs.existsSync( options.rootDir ))
                throw new Error(`The provided rootDir "${options.rootDir}" doesn't exists.`);
        }

        // options.rootDir = config file
        if (fs.lstatSync( options.rootDir ).isFile()) {

            tsDir = path.dirname(options.rootDir);
            tsFile = path.basename(options.rootDir);

        // options.rootDir = Project dir
        } else {

            tsDir = options.rootDir;
            tsFile = 'tsconfig.json';

        }

        // Module resolution directories
        // Default = rootDir
        if (options.modulesDir === undefined)
            options.modulesDir = [path.join(options.rootDir, 'node_modules')]
        options.debug && console.log(LogPrefix, `Using the following dirs for module resolution:`, options.modulesDir);

        // Parse the tsconfig.json file
        let tsBaseDir: string;
        ({
            paths: this.typescript,
            baseUrl: tsBaseDir
        } = this.readTsConfig(tsDir, tsFile));

        // Build the list of aliases
        this.list = this.processTsAliases(this.typescript, tsBaseDir);
    }

    /*----------------------------------
    - PARSING
    ----------------------------------*/
    
    private readTsConfig( dir: string, file: string = 'tsconfig.json' ): TsConfig {

        // TODO: prise en compte de extends si baseurl ou paths manquant

        const fullpath = dir + '/' + file;

        this.options.debug && console.log(LogPrefix, `Reading config ${fullpath}`);

        const raw = fs.readFileSync(fullpath, 'utf-8');
        const tsconfig = JSON5.parse(raw);
        let { paths, baseUrl } = tsconfig.compilerOptions as Partial<TsConfig>;

        // baseUrl is specified
        if (baseUrl !== undefined) {
            baseUrl = path.resolve(dir, baseUrl);
        // if not, try to het it from the extended config file
        } else if (tsconfig.extends) {
            
        // If no extended file, use config file directory as base url
        } else
            baseUrl = dir;

        if (paths === undefined)
            paths = {};

        this.options.debug && console.log(LogPrefix, `Processed config: ${fullpath}`, paths, { baseUrl });

        return { paths, baseUrl };

    }

    private processTsAliases( tsAliases: TsAliasList, tsBaseDir: string ): AliasDefinition[] {

        const list: AliasDefinition[] = [];

        for (let alias in tsAliases) {

            const destinations = tsAliases[alias];

            // Détermine if it must be exact alias
            let exact = !alias.endsWith('/*');
            if (!exact)
                alias = alias.substring(0, alias.length - 2);
            
            // Process each destination path
            const pathnames: string[] = [];
            for (let destination of destinations) {

                // Remove wildcard
                if (destination.endsWith('*'))
                    destination = destination.substring(0, destination.length - 1);
                // Remove trailing slash
                if (destination.endsWith('/'))
                    destination = destination.substring(0, destination.length - 1);

                // If the destination is a node module, prefix with options.modulesDir
                const isNpmModule = destination[0] !== '.' && destination[0] !== '/';
                if (isNpmModule)
                    pathnames.push(
                        ...this.options.modulesDir.map( 
                            dir => path.join(dir, destination) 
                        )
                    )
                // Otherwise, concat the path with the base dir (the one given in the tsconfig)
                else if (destination)   
                    pathnames.push( path.join(tsBaseDir, destination) );
                else
                    pathnames.push( tsBaseDir );
            }

            list.push({ alias, exact, pathnames })
        }

        this.options.debug && console.log(LogPrefix, `Processed aliases:`, list, { tsBaseDir });

        return list;

    }

    /*----------------------------------
    - TRANSFORM PATHS
    ----------------------------------*/

    /**
     * Replace real path by alias
     * @param realpath The path you want to replace with alias
     * @param strict true to return null when no alias could be applied to the path
     */
    public apply( realpath: string, strict?: false ): string;
    public apply( realpath: string, strict: true ): string | null;
    public apply( realpath: string, strict?: boolean ): string | null {

        for (const alias in this.list) {
            const { exact, pathnames } = this.list[alias];
            for (const pathname of pathnames) {

                if (exact) {

                    if (realpath === pathname)
                        return alias;

                } else if (realpath.startsWith(pathname + '/')) {

                    return alias + realpath.substring(pathname.length);

                }
            }
        }

        // No matching alias
        return strict ? null : realpath;
    }

    /**
     * Check if the provided path can be shorten with aliases
     * @param filename The path to check
     * @returns If filename can be shorten an alias
     */
    public isAliased( filename: string ): boolean {
        return this.apply(filename, true) !== null;
    }

    // Replace alias by the real path
    public realpath( request: string, strict?: false): string;
    public realpath( request: string, strict: true): string | null;
    public realpath( request: string, strict?: boolean): string | null {

        for (const { alias, exact, pathnames } of this.list) {
            for (const pathname of pathnames) {

                if (exact) {

                    if (request === alias)
                        return pathname;

                } else if (request.startsWith(alias + '/')) {

                    return pathname + request.substring(alias.length);

                }
            }
        }

        // No matching alias
        return strict ? null : request;
    }

    /**
     * If the provided path contains an alias
     * @param filename The path to check
     * @returns If filename contains an alias
     */
    public containsAlias( filename: string ): boolean {
        return this.realpath( filename, true ) !== null;
    }

    /*----------------------------------
    - TRANSFORM LIST
    ----------------------------------*/

    // https://webpack.js.org/configuration/resolve/#resolvealias
    public forWebpack( modulesPath?: string ): { aliases: TsAliasList };
    public forWebpack( modulesPath: string, nodeExternals: true ): { 
        aliases: TsAliasList, 
        externals: TWebpackExternals 
    };
    public forWebpack( modulesPath?: string, nodeExternals?: boolean ): { 
        aliases: TsAliasList, 
        externals?: TWebpackExternals 
    } {

        this.options.debug && console.log(LogPrefix, `Generating webpack aliases ...`);

        const aliases: TsAliasList = {};
        const externalsList: {[alias: string]: { pathname: string, exact: boolean }} = {};

        aliasesIt:
        for (let { alias, exact, pathnames } of this.list) {

            let curAliases: string[] = [];
            if (modulesPath === undefined)
                curAliases = pathnames;
            else for (let pathname of pathnames) {

                // Reference to node_modules
                if (pathname.startsWith(modulesPath)) {

                    // Transforms paths to node_module into module reference
                    // Ex: "../node_modules/declarative-scraper" => "declarative-scraper"
                    pathname = pathname.substring(modulesPath.length + 1);

                    // Externals
                    if (nodeExternals === true && pathnames.length === 1) {

                        externalsList[alias] = { pathname, exact };
                        continue aliasesIt;

                    }
                }
                
                curAliases.push(pathname);
            }

            // From webpack doc: « A trailing $ can also be added to the given object's keys to signify an exact match: »
            if (exact)
                alias += '$';

            aliases[alias] = curAliases;
        }

        this.options.debug && console.log(LogPrefix, `Webpack aliases =`, aliases, 'Webpakc externals =', externalsList);

        if (nodeExternals === undefined)
            return { aliases };

        // https://webpack.js.org/configuration/externals/#function
        const externals = ({ request }, callback) => {

            for (const alias in externalsList) {
                const { pathname, exact } = externalsList[alias];
                if (exact) {

                    if (request === alias) {
                        this.options.debug && console.log(LogPrefix, request, '=>', pathname);
                        return callback(null, pathname);
                    }

                } else if (request.startsWith( alias )) {

                    const destination = pathname + request.substring(alias.length);
                    this.options.debug && console.log(LogPrefix, request, '=>', destination);
                    return callback(undefined, destination);

                }
            }
            
            callback();
        }

        this.options.debug && console.log(LogPrefix, `Webpack aliases:`, aliases);
        return { aliases, externals };

    }

    // https://github.com/ilearnio/module-alias#advanced-usage
    public forModuleAlias( enableCache: boolean = true ): ModuleAliasList {

        const moduleAlias: ModuleAliasList = {};
        const cache: {[request: string]: string} = {};

        // For each registered alias
        for (const { alias, exact, pathnames } of this.list) {

            // Create a resolver
            moduleAlias[alias] = (from, request, requestAlias) => {

                // Exact alias
                if (exact && request !== alias)
                    return requestAlias;

                this.options.debug && console.log(LogPrefix, `Resolving ${request} from ${from}`);

                // From cache
                const cacheId = from + '::' + request;
                if (enableCache && cache[cacheId] !== undefined) {
                    this.options.debug && console.log(LogPrefix, 'Found from cache:', cache[cacheId]);
                    return cache[cacheId];
                }

                // Chemin du module sans l'alias
                const modulePath = request.substring(requestAlias.length);

                // Recherche de la première destinaiton existante
                for (const pathname of pathnames) try {

                    const searchPath = pathname + modulePath;
                    this.options.debug && console.log(LogPrefix, '- Trying:', searchPath);

                    // Si le chemin existe, il sera retourné
                    if (require.resolve(searchPath)) {

                        // Retourne un chemin relatif au fichier qui a importé le module
                        const relative = path.relative(
                            path.dirname(from),
                            pathname
                        );
                        this.options.debug && console.log(LogPrefix, 'Found:', relative);

                        cache[cacheId] = relative;

                        return relative;
                    }

                } catch (e) {
                    this.options.debug && console.log(LogPrefix, 'Unable to resolve', e);
                }

                this.options.debug && console.warn(`Unable to resolve alias for ${request} from ${from}`);
                return requestAlias;

            };
        }

        this.options.debug && console.log(LogPrefix, `Module AliasDefinition:`, moduleAlias);

        return moduleAlias;

    }
}