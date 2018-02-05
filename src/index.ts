import { utils } from "@steemit/koa-jsonrpc";
import { JsonRpcRequest, sign as signRequest } from "@steemit/rpc-auth";
import { parse as parseUrl } from "url";
import { VError } from "verror";

export interface RPCSigner {
    account: string;
    key: string;
}

export class RPC {
    private requestOpts: any;
    private seqNo = 0;

    constructor(url: string) {
        this.requestOpts = parseUrl(url);
        this.requestOpts.method = "post";
    }

    public async call(method: string, params?: any) {
        return this.send(this.buildRequest(method, params));
    }

    public async signedCall(signer: RPCSigner, method: string, params?: any) {
        return this.send(
            this.signRequest(signer, this.buildRequest(method, params))
        );
    }

    public async send(request: JsonRpcRequest) {
        const response = await utils.jsonRequest(this.requestOpts, request);
        // Disabled for now since jussi omits ids when result is undefined
        // https://github.com/steemit/jussi/issues/93
        // if (!response.error && response.id !== request.id) {
        //     throw new VError({name: 'RPCError'}, 'Response id mismatch')
        // }
        return response;
    }

    public signRequest(signer: RPCSigner, request: JsonRpcRequest) {
        return signRequest(request, signer.account, [signer.key]);
    }

    public buildRequest(method: string, params?: any): JsonRpcRequest {
        const req: JsonRpcRequest = {
            id: ++this.seqNo,
            jsonrpc: "2.0",
            method
        };
        if (params) {
            req.params = params;
        }
        return req;
    }
}
