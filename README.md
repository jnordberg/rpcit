
rpcit
=====

Command-line [Steem-flavoured](https://github.com/steemit/rpc-auth) [JSON-RPC 2.0](http://www.jsonrpc.org/specification) Client.


Install
-------

With [node.js](https://nodejs.org) installed do:

```bash
$ npm install -g rpcit
```

Or with [yarn](https://yarnpkg.com):

```bash
$ yarn global add rpcit
```


Usage
-----

```

  Usage: rpcit [options] <method> [params...]


  Options:

    -a, --address [url]  address to the RPC server (default: https://api.steemit.com)
    --dev                set address to https://api.steemitdev.com
    --stage              set address to https://api.steemitstage.com
    -s, --sign           sign the request using credentials from env vars RPCIT_ACCOUNT and RPCIT_KEY
    -r, --raw            write the raw JSON-RPC 2.0 response to stdout
    -v, --verbose        print debug info to stderr
    -h, --help           output usage information


  Params:

    Params can be passed as positional or by keyword
      param1 param2 param3 OR bar=param2 foo=param1

    You can pass JSON by prefixing the param with a colon (:)
      :'{"foo": "bar"}' OR key:='{"foo": "bar"}'

    Params can be read from stdin by passing a dash (-)
      $ echo '["foo", "bar"]' | rpcit some_method -

    Pass an underscore (_) for newline separated JSON, one line per param
      $ echo '{"foo": "bar"}\nfalse' | rpcit baz _


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

```


---

*Share and Enjoy!*
