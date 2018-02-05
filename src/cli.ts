import * as program from 'commander'
import { inspect } from 'util'
import { VError } from 'verror'
import { RPC, RPCSigner } from './index'

const { argv, env, exit, stderr, stdin, stdout } = process

const KEYWORD_PATTERN = /^[0-9a-z]+:?=.+$/i

function log(out: NodeJS.WriteStream, ...msgs) {
    const fmt = out.isTTY
        ? v => inspect(v, { colors: true, depth: null })
        : JSON.stringify
    for (const msg of msgs) {
        out.write(typeof msg === 'string' ? msg : fmt(msg))
    }
}

function parseKeywordParam(param: string) {
    let idx = param.indexOf('=')
    if (idx === -1) {
        throw new VError({ name: 'InvalidParam' }, 'Missing key=value pair')
    }
    let rawValue = param.slice(idx + 1)
    if (param[idx - 1] === ':') {
        rawValue = ':' + rawValue
        idx -= 1
    }
    const key = param.slice(0, idx)
    let value: any
    try {
        value = parseParam(rawValue)
    } catch (cause) {
        throw new VError(
            { name: 'InvalidParam', cause },
            `Unable to parse '${key}'`
        )
    }
    return { key, value }
}

function parseParam(param: string) {
    if (param[0] === ':') {
        return JSON.parse(param.slice(1))
    }
    return param
}

function readStream(stream: NodeJS.ReadStream) {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        stream.on('data', chunk => {
            chunks.push(chunk)
        })
        stream.on('end', () => {
            resolve(Buffer.concat(chunks))
        })
        stream.on('error', reject)
    })
}

interface Options {
    address: string
    raw: boolean
    sign: boolean
    verbose: boolean
}

async function main(method: string, params: string[], options: Options) {
    if (options.verbose) {
        log(stderr, { method, params, options }, '\n')
    }
    let parsedParams: any
    if (params.length === 1 && ['-', '_'].includes(params[0])) {
        const input = await readStream(stdin)
        try {
            if (params[0] === '_') {
                parsedParams = input
                    .toString('utf8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length)
                    .map(line => JSON.parse(line))
            } else {
                parsedParams = JSON.parse(input.toString('utf8'))
            }
        } catch (cause) {
            throw new VError(
                { name: 'InvalidParam', cause },
                'Unable to parse stdin'
            )
        }
    } else {
        if (params.some(param => KEYWORD_PATTERN.test(param))) {
            parsedParams = {}
            for (const { key, value } of params.map(parseKeywordParam)) {
                parsedParams[key] = value
            }
        } else {
            parsedParams = []
            for (let i = 0; i < params.length; i++) {
                try {
                    parsedParams.push(parseParam(params[i]))
                } catch (cause) {
                    throw new VError(
                        { name: 'InvalidParam', cause },
                        `Unable to parse param at index ${i}`
                    )
                }
            }
        }
    }
    const client = new RPC(options.address)
    let request = client.buildRequest(method, parsedParams)
    if (options.verbose) {
        log(stderr, request, '\n')
    }
    if (options.sign) {
        const signer: RPCSigner = {
            account: env.RPCIT_ACCOUNT as string,
            key: env.RPCIT_KEY as string
        }
        if (!signer.account || !signer.key) {
            throw new VError(
                { name: 'SigningError' },
                'Credentials missing, make sure to set RPCIT_ACCOUNT and RPCIT_KEY'
            )
        }
        try {
            request = client.signRequest(signer, request)
        } catch (cause) {
            throw new VError(
                { name: 'SigningError', cause },
                'Unable to sign request'
            )
        }
        if (options.verbose) {
            log(stderr, request, '\n')
        }
    }
    const response = await client.send(request)
    const out = options.raw ? response : response.error || response.result
    if (out != null) {
        log(stdout, out, '\n')
    }
    return !options.raw && response.error ? 1 : 0
}

/*______________"\
                    /.----------------.\
                 ~~ ||                ||
                    ||                ||
                    ||                || ~~
                    ||                ||
 .---------------.__|||              |||
( . ACTIONsaw__  |__||=:____________:=||
 '---------------'   \VVVVVVVVVVVVVVV*/
let sawAction = false

const extraHelp = `

  Params:

    Params can be passed as positional or by keyword
      param1 param2 param3 OR bar=param2 foo=param1

    You can pass JSON by prefixing the param with a colon (:)
      :'{"foo": "bar"}' OR key:='{"foo": "bar"}'

    Params can be read from stdin by passing a dash (-)
      $ echo '["foo", "bar"]' | rpcit some_method -

    Pass an underscore (_) for newline separated JSON, one line per param
      $ echo '{"foo": "bar"}\\nfalse' | rpcit baz _


  Examples:

    Get latest global props
      $ rpcit get_dynamic_global_properties

    Get account info
      $ rpcit get_accounts :'["almost-digital"]'

    Get the account details for the first 100 accounts starting with foo
      $ rpcit lookup_accounts foo 100 | rpcit get_accounts _

    Get the witness-decided chain properties from gtg's node
      $ rpcit -a https://gtg.steem.house:8090 get_chain_properties

    Get user data from conveyor
      $ RPCIT_ACCOUNT=admin RPCIT_KEY=5POSTINGWIF rpcit -s conveyor.get_user_data user

`

program
    .arguments('<method> [params...]')
    .option(
        '-a, --address [url]',
        'address to the RPC server',
        'https://api.steemit.com'
    )
    .option('--dev', 'set address to https://api.steemitdev.com')
    .option('--stage', 'set address to https://api.steemitstage.com')
    .option(
        '-s, --sign',
        'sign the request using credentials from env vars RPCIT_ACCOUNT and RPCIT_KEY'
    )
    .option('-r, --raw', 'write the raw JSON-RPC 2.0 response to stdout')
    .option('-v, --verbose', 'print debug info to stderr')
    .action((method, params) => {
        sawAction = true
        const { sign, verbose, raw } = program
        let address = program.address
        if (program.stage) {
            address = 'https://api.steemitstage.com'
        }
        if (program.dev) {
            address = 'https://api.steemitdev.com'
        }
        main(method, params, { sign, verbose, address, raw })
            .then(code => {
                process.exitCode = code
            })
            .catch(error => {
                stderr.write(String(error))
                stderr.write('\n')
                exit(1)
            })
    })
    .on('--help', () => {
        log(stdout, extraHelp)
    })
    .parse(argv)

if (!sawAction) {
    stderr.write('No method specified. For usage see --help\n')
    exit(1)
}
