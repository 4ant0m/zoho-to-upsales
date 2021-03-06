/**
 * Created by 4ant0m on 3/8/19.
 */
const request = require('superagent');
const RESOURCES = require('./resources');
const METHODS = require('./methods');

const LINK = `https://integration.upsales.com/api`;

class Upsales {
    constructor (data) {
        this.token = data.token;
        this.version = data.version;
        this.link = `${LINK}/v${this.version}`;
        this.limit = 500;

        this._makeResources(RESOURCES, METHODS)
    }

    _makeResources (resources, methods) {
        for (let resource in resources) {
            if (!RESOURCES.hasOwnProperty(resource)) {
                continue;
            }
            this._makeMethods(resource, methods)

        }
    }

    _makeMethods (resource, methods) {
        Upsales.prototype[resource] = {};
        for (let method in methods) {
            if (!RESOURCES.hasOwnProperty(resource)) {
                continue;
            }
            if (method == `getAll`) {
                Upsales.prototype[resource][method] = this.getAll.bind(this, resource);
            } else
                Upsales.prototype[resource][method] = this.makeRequest.bind(this, resource, methods[method]);
        }
    }

    _getAPILink (resource) {
        return `${this.link}${RESOURCES[resource]}`
    }

    async getAll (resource, params = {}) {
        let offset = 1000,
            result = {
                data: [],
                metadata: {}
            };
        params.offset = 0;
        params.limit = offset;
        for (let i = 0; i < this.limit; i++) {
            let data = await this.makeRequest(resource, `get`, params, ``);
            if (data.data.length == 0 || !data.metadata) {
                break
            }
            result.metadata.total = data.metadata.total;
            result.error = data.error;
            result.data = result.data.concat(data.data);
            params.offset += offset
        }
        return result.data
    }

    async makeRequest (resource, method, params, _return = 'data') {
        let link,
            res;
        console.log(params)
        try {
            let id = params && params.id || ``;
                link = `${this._getAPILink(resource)}/${id}`;
                res = await request
                    [method](link)
                    .set({Accept: 'application/json'})
                    .query({token: this.token})
                    .query(params)
                    .send(params);
            if (res.body.error) {
                throw new Error(`Error Response. Link: ${link}, method: ${method}, message: ${res.body.error}`);
            }
            res = res.body;
            if (_return)
                res = res[_return] || res
            return res
        } catch (e) {
            let response =  e && e.response && e.response.text || e;
            throw new Error(`Error Response. Link: ${link}, method: ${method}, message: ${response}`);
        }
    }
}

module.exports = Upsales;
