/*----------------------------------
- DEPENDANCES
----------------------------------*/

import JSON5 from 'json5'; // Because tsconfig.json is closer to json5 rather than json
import fs from 'fs';
import path from 'path';

/*----------------------------------
- TYPES
----------------------------------*/

type TsConfig = { paths: TsAliasList, baseUrl: string }

export type AliasList = { 
    [alias: string]: { pathnames: string[], exact: boolean }
};

type TsAliasList = { [alias: string]: string[] };

type ModuleAliasList = { [alias: string]: string | Function };

type TWebpackExternals = (data: { request: string }, callback: (err: undefined, result: string) => void) => void;

/*----------------------------------
- MODULE
----------------------------------*/
export default class TsAlias {

    // Original typescript aliases
    public typescript: TsAliasList;
    // Normalized list
    public list: AliasList;

    public constructor( input: string | AliasList, private debug: boolean = false ) {

        let tsFile: string;
        let tsDir: string;

        if (typeof input === 'object') {
            this.list = {}
            for (const alias in input)
                this.list[alias] = {
                    ...input[alias],
                    pathnames: input[alias].pathnames.map(
                        pathname => path.join( process.cwd(), pathname )
                    )
                }
            this.debug && console.log(`Loaded aliases from object`, input, '=>', this.list);
            return;
        }

        // Absolute path
        if (!path.isAbsolute( input ))
            input = path.join(process.cwd(), input);

        // input = config file
        if (input.endsWith('.json')) {

            tsDir = path.dirname(input);
            tsFile = path.basename(input);

        // input = Project dir
        } else {

            tsDir = input;
            tsFile = 'tsconfig.json';

        }

        let tsBaseDir: string;
        ({
            paths: this.typescript,
            baseUrl: tsBaseDir
        } = this.readTsConfig(tsDir, tsFile));

        this.list = this.processAliases(this.typescript, tsBaseDir);

    }

    /*----------------------------------
    - PARSING
    ----------------------------------*/
    
    private readTsConfig( dir: string, file: string = 'tsconfig.json' ): TsConfig {

        // TODO: prise en compte de extends si baseurl ou paths manquant

        const fullpath = dir + '/' + file;

        this.debug && console.log(`Reading config ${fullpath}`);

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

        this.debug && console.log(`Processed config: ${fullpath}`, paths, { baseUrl });

        return { paths, baseUrl };

    }

    private processAliases( typescript: TsAliasList, tsBaseDir: string ): AliasList {

        const list: AliasList = {};

        for (let match in typescript) {

            const destinations = typescript[match];

            // Détermine if it must be exact match
            let exact = !match.endsWith('/*');
            if (!exact)
                match = match.substring(0, match.length - 2);
            
            const pathnames = destinations.map((destination) => {

                // Remove wildcard
                if (destination.endsWith('*'))
                    destination = destination.substring(0, destination.length - 1);

                // Remove trailing slash
                if (destination.endsWith('/'))
                    destination = destination.substring(0, destination.length - 1);

                return destination
                    ? path.join(tsBaseDir, destination)
                    : tsBaseDir;

            });

            list[match] = { exact, pathnames }
        }

        this.debug && console.log(`Processed aliases:`, list, { tsBaseDir });

        return list;

    }

    /*----------------------------------
    - TRANSFORM PATHS
    ----------------------------------*/

    public apply(filename: string): string {

        for (const alias in this.list) {
            const { exact, pathnames } = this.list[alias];
            for (const pathname of pathnames) {

                if (exact) {

                    if (filename === pathname)
                        return alias;

                } else if (filename.startsWith(pathname + '/')) {

                    return alias + filename.substring(pathname.length);

                }

            }
        }

        // Unchanged
        return filename;
    }

    public realpath(request: string): string {

        for (const alias in this.list) {
            const { exact, pathnames } = this.list[alias];
            for (const pathname of pathnames) {

                if (exact) {

                    if (request === alias)
                        return pathname;

                } else if (request.startsWith(alias + '/')) {

                    return pathname + request.substring(alias.length);

                }

            }
        }

        // Unchanged
        return request;
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

        this.debug && console.log(`Generating webpack aliases ...`);

        const aliases: TsAliasList = {};
        const externalsList: {[alias: string]: { pathname: string, exact: boolean }} = {};

        aliasesIt:
        for (let match in this.list) {

            const { exact, pathnames } = this.list[match];

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

                        externalsList[match] = { pathname, exact };
                        continue aliasesIt;

                    }
                }
                
                curAliases.push(pathname);
            }

            // From webpack doc: « A trailing $ can also be added to the given object's keys to signify an exact match: »
            if (exact)
                match += '$';

            aliases[match] = curAliases;
        }

        this.debug && console.log(`Webpack aliases =`, aliases, 'Webpakc externals =', externalsList);

        if (nodeExternals === undefined)
            return { aliases };

        // https://webpack.js.org/configuration/externals/#function
        const externals = ({ request }, callback) => {

            for (const alias in externalsList) {
                const { pathname, exact } = externalsList[alias];
                if (exact) {

                    if (request === alias) {
                        this.debug && console.log(request, '=>', pathname);
                        return callback(null, pathname);
                    }

                } else if (request.startsWith( alias )) {

                    const destination = pathname + request.substring(alias.length);
                    this.debug && console.log(request, '=>', destination);
                    return callback(undefined, destination);

                }
            }
            
            callback();
        }

        this.debug && console.log(`Webpack aliases:`, aliases);
        return { aliases, externals };

    }

    // https://github.com/ilearnio/module-alias#advanced-usage
    public forModuleAlias( enableCache: boolean = true ): ModuleAliasList {

        const moduleAlias: ModuleAliasList = {};
        const cache: {[request: string]: string} = {};

        for (const alias in this.list) {

            const { exact, pathnames } = this.list[alias];

            moduleAlias[alias] = (from, request, requestAlias) => {

                // Exact alias
                if (exact && request !== alias)
                    return requestAlias;

                this.debug && console.log(`Resolving ${request} from ${from}`);

                // From cache
                const cacheId = from + '::' + request;
                if (enableCache && cache[cacheId] !== undefined) {
                    this.debug && console.log('Found from cache:', cache[cacheId]);
                    return cache[cacheId];
                }

                // Chemin du module sans l'alias
                const modulePath = request.substring(requestAlias.length);

                // Recherche de la première destinaiton existante
                for (const pathname of pathnames) try {

                    const searchPath = pathname + modulePath;
                    this.debug && console.log('- Trying:', searchPath);

                    // Si le chemin existe, il sera retourné
                    if (require.resolve(searchPath)) {

                        // Retourne un chemin relatif au fichier qui a importé le module
                        const relative = path.relative(
                            path.dirname(from),
                            pathname
                        );
                        this.debug && console.log('Found:', relative);

                        cache[cacheId] = relative;

                        return relative;
                    }

                } catch (e) {
                    this.debug && console.log('Unable to resolve', e);
                }

                this.debug && console.warn(`Unable to resolve alias for ${request} from ${from}`);
                return requestAlias;

            };
        }

        this.debug && console.log(`Module Alias:`, moduleAlias);

        return moduleAlias;

    }
}