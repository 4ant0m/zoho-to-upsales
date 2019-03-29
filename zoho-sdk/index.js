/**
 * Created by 4ant0m on 3/21/19.
 */
let ZCRM = require('zcrmsdk')

class Zoho {
    constructor (data) {
        this.ZCRMRestClient = ZCRM;
        this.LIMIT = 5;
    }

    async init () {
        await this.ZCRMRestClient.initialize();
        await this._makeMethods(`users`,
            {getAll: `_getAll`}
        );
        await this._makeMethods(`products`,
            {getAll: `_getAll`}, `MODULES`
        )
        await this._makeMethods(`org`,
            {get: `_getAll`}
        )
    }

    async generateAuthTokenFromGrant (userId, grantToken) {
        let authResponse = await this.ZCRMRestClient.generateAuthTokens(userId, grantToken)
        return authResponse
    }

    _makeMethods (resource, methods, isModule) {
        Zoho.prototype[resource] = {};
        for (let method in methods) {
            Zoho.prototype[resource][method] = this[methods[method]].bind(this, resource, 1000, isModule);
        }
    }

    async _getAll (resource, perPage, context) {
        let input = {},
            params = {},
            results = [];
        params.page = 1;
        params.per_page = perPage;
        input.module = resource.toUpperCase();
        input.params = params;

        let apiFunction = (context) ? this.ZCRMRestClient.API[context] : this.ZCRMRestClient.API[resource.toUpperCase()];
        for (let i = 0; i < this.LIMIT; i++) {
            let response = (await apiFunction.get(input)).body;
            response = JSON.parse(response);
            response = response.data || response[resource]
            if (!response) {
                break
            }
            results = results.concat(response);
            params.page++
        }
        return results
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

    async getOrg (){
        crmclient.API.ORG.get(params)
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
