/**
 * Created by 4ant0m on 3/21/19.
 */
let ZCRM = require('zcrmsdk')

class Zoho {
    constructor (data) {
        this.ZCRMRestClient = ZCRM;
        this.LIMIT = 2;
    }

    async init () {
        await this.ZCRMRestClient.initialize();
        await this._makeMethods(`users`,
            {getAll: `_getAll`}
        );
        await this._makeMethods(`products`,
            {getAll: `_getAll`}, `MODULES`
        )
        await this._makeMethods(`activities`,
            {getAll: `_getAll`}, `MODULES`
        )
        await this._makeMethods(`org`,
            {get: `_get`}
        )
    }

    async generateAuthTokenFromGrant (userId, grantToken) {
        let authResponse = await this.ZCRMRestClient.generateAuthTokens(userId, grantToken)
        return authResponse
    }

    _makeMethods (resource, methods, context) {
        Zoho.prototype[resource] = {};
        for (let method in methods) {
            Zoho.prototype[resource][method] = this[methods[method]].bind(this, resource, 1000, context);
        }
    }

    async _getAll (resource, perPage, context) {
        let results = [],
            page = 1;

        for (let i = 0; i < this.LIMIT; i++) {
            let response = await this._get(resource, perPage, context, page);
            if (!response) {
                break
            }
            results = results.concat(response);
            page++
        }
        return results
    }

    async _get (resource, perPage, context, page = 1) {
        let input = {},
            params = {};
        params.page = page;
        params.per_page = perPage;
        input.module = resource.toUpperCase();
        input.params = params;

        let apiFunction = (context) ? this.ZCRMRestClient.API[context] : this.ZCRMRestClient.API[resource.toUpperCase()];
        let response = (await apiFunction.get(input)).body;
        response = response ? JSON.parse(response) : {};
        response = response.data || response[resource];
        return response;
    }

    async getModule (module) {

        var input = {};
        input.module = module;

        var params = {};
        params.page = 1;
        params.per_page = 200;
        input.params = params;

        let response = (await this.ZCRMRestClient.API.MODULES.get(input)).body
        return response
    }

}

module.exports = Zoho;
/*
 ZCRMRestClient.initialize().then(function () {
 var input = {};
 input.module = "Users";

 var params = {};
 params.page = 0;
 params.per_page = 5;
 input.params = params;

 ZCRMRestClient.API.USERS.get(input).then(function (response) {

 var data = response.body
 console.log(data)
 })


 })*/
