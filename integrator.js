/**
 * Created by 4ant0m on 3/23/19.
 */
const Upsales = require('./upsales-sdk');
const Zoho = require('./zoho-sdk');
const logger = require(`./lib/log`);
const config = require(`./config`);
const fixer = require('fixer-api');

class Integrator {
    constructor (data) {
        this.upsales = new Upsales({
            version: 2,
            token: data.upsales.token
        });
        this.fixer = fixer;
        this.fixer.set({accessKey: data.fixer.token})
        this.clientId = data.clientId;
        this.importId = data.importId;
        this.progress = 0;
        this.progressStep = data.progressStep || 20;
        this.logger = new logger({context: `INTEGRATOR`})

        this.initMethods();

    }

    initMethods () {
        let method = this.upsales.orderstages.create;
        this.upsales.orderstages.create = async (params) => {
            //for (let i = 0; i < 10; i++){
                try {
                    let res = await method(params)
                    if (res) {
                        return res
                    }
                } catch (e){
                    this.logger.error(e.message)

                }
            //}
        }
    }

    async prepareData (data, map, extend = {}, custom, functions) {
        let results = []
        for (let i = 0; i < data.length; i++) {
            let item = data[i];

            let result = {};
            for (let prop in extend) {
                result[prop] = extend[prop]
            }

            for (let prop in map) {
                if (item[prop])
                result[map[prop]] = item[prop]
            }

            for (let prop in functions) {
                let element = functions[prop],
                    defaultValue = element.defaultValue,
                    additional = element.additional,
                    param = element.param,
                    params = item[prop] && item[prop][param] && {[param]: item[prop][param]} || item[prop] || {name: defaultValue};

                result[element.name] = new element.type

                if (typeof params != 'object'){
                    params = {
                        name: params
                    }
                }

                if (additional){
                    for (let prop in additional) {
                        if (item[prop])
                            params[additional[prop]] = item[prop]
                    }
                }

                let relationResource = await this.getRelationResource(element.resource, params, params) || {}

                if (Array.isArray(result[element.name])) {
                    result[element.name].push({id: relationResource.id})
                } else {
                    result[element.name] = {id: relationResource.id}
                }
            }
            if (custom) {
                result.custom = []
                for (let i = 0; i < custom.length; i++) {
                    result.custom.push({
                        fieldId: custom[i].fieldId,
                        value: item[custom[i].value]
                    });
                }
            }
            results = results.concat(result)
        }

        return results
    }

    async createCustomFields (resource, name, type = 'String') {
        let customfield = (await this.upsales[`${resource}customfields`].get({name: name}))[0] ||
            (await this.upsales[`${resource}customfields`].create({
                "name": name,
                "default": "",
                "datatype": type,
                "visible": 1,
                "editable": 1,
                "searchable": 0,
                "dropdownDefault": "",
                "sortId": 0,
                "obligatoryField": 0,
                "roles": []
            }));

        return customfield
    }

    matchItems (items1, items2, param1, param2) {
        let results = [];
        for (let i = 0; i < items2.length; i++) {
            let result = this.matchItem(items1, items2[i], param1, param2);
            results.push(result)
        }
        return results
    }

    matchItem (data, item, param1, param2) {
        let p1 = param1,
            p2 = param2 || param1;
        return data.find((result) => {
            return result[p1] == item[p2]
        })
    }

    filterItems (items, item, param1, param2) {
        return items.filter(data => {
            let res = data[param1] && data[param1][param2] || data[param1];
            return res == item[param2]
        })
    }


    async filterDuplicates (resource, param, data) {
        this.logger.action(`Filtering ${resource} duplicates with such param - ${param}`);
        let results = await this.upsales[resource].getAll();

        let filteredData = data.filter((item) =>
            results.find((result) => result[param] == item[param]) == null
        );

        return filteredData
    };

    async create (resource, data, errorHandler = (resource, currentData) => {
    }) {
        let results = [];

        for (let i = 0; i < data.length; i++) {
            try {
                let result;
                try {
                    result = await this.upsales[resource].create(data[i])
                } catch (e) {
                    result = await errorHandler(resource, data[i])
                }
                if (!result) continue;

                this.logger.success(`Created ${resource} - id: ${result.id}`);
                results.push(result)
            } catch (e) {
                this.logger.error(`Can't create ${resource} - ${e.message}`)
            }
        }
        return results
    };

    async clear (resource, field = `id`, method = `getAll`) {
        this.logger.action(`Clearing ${resource}`);
        let results = [],
            duplicates = await this.upsales[resource][method]();

        for (let i = 0; i < duplicates.length; i++) {
            try {
                this.logger.action(`Deleting ${resource}: ${duplicates[i].name} `);
                results.push(await this.upsales[resource].delete({id: duplicates[i][field]}));
            } catch (e) {
                this.logger.error(e.message)
            }
        }
        return results

    }

    async updateMatchItem (resource, upsalesData, preparedData, matchKey) {
        for (let i = 0; i < preparedData.length; i++) {
            let matchedElement = this.matchItem(upsalesData, preparedData[i], matchKey);
            if (matchedElement) {
                let update = (await this.upsales[resource].update({
                    id: matchedElement.id,
                    clientId: this.clientId,
                    custom: preparedData[i].custom
                }));

                this.logger.action(`Was updated - id: ${update.id}`);
                this.logger.info(update);
            }
        }
    }

    async integrateZohoUsers (zohoUsers) {
        let createdUsers = await this.integrate(zohoUsers, {
            read: 'users',
            write: 'masterusers'
        }, {
            dynamic: {
                email: 'email',
                full_name: 'name',
                language: 'language',
                state: 'userState',
                phone: 'userPhone',
                zip: 'userZipCode',
                street: 'userAddress',
            },
            static: {
                "clientId": this.clientId,
                "password": 123456,
                "teamLeader": 0,
                "active": 0,
                "ghost": 0,
                "export": 1,
                "administrator": 1
            }
        }, {
            key: 'email',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                }]
        });

        return createdUsers;
    }

    async integrateZohoCurrencies (iso) {
        this.logger.action(`Getting currencies`);
        let quotes = await fixer.latest({base: 'EUR'}),
            results = [],
            rate = quotes.rates[iso] / quotes.rates['SEK']
        let currencies = [{
            iso: iso,
            rate: rate,
            active: true,
        }]
        currencies = await this.filterDuplicates(`currencies`, `iso`, currencies)
        // let currency = await this.upsales.currencies.update({id: `USD`, masterCurrency: false})
        //let currencyD = await this.upsales.currencies.delete({id: 'USD'})

        this.logger.action(`Creating currency`)

        for (let i = 0; i < currencies; i++) {
            results.push(await this.upsales.currencies.create(currencies[i]));
        }

        this.logger.info(results)

        return results
    }

    async integrate (data, resource = {}, map = {}, update = {}) {
        let customfields = [];
        for (let i = 0; i < update.custom.length; i++) {
            this.logger.action(`Creating custom field`);
            let customfield = await this.createCustomFields(resource.read.slice(0, -1), update.custom[i].name);
            this.logger.info(customfield);
            customfields.push({
                fieldId: customfield.id,
                value: update.custom[i].value
            })
        }

        this.logger.action(`Preparing ${resource.read}`);
        let preparedData = await this.prepareData(data, map.dynamic, map.static, customfields, map.functions);

        this.logger.info(preparedData);

        this.logger.action(`Getting ${resource.read} from upsales`);
        let upsales = await this.upsales[resource.read].getAll();
        this.logger.info(upsales);

        this.logger.action(`Updating ${resource.write} from upsales`);
        await this.updateMatchItem(resource.write, upsales, preparedData, update.key);

        this.logger.info(`Filtering ${resource.read} from upsales`);
        preparedData = await this.filterDuplicates(resource.read, update.key, preparedData)

        this.logger.action(`Creating ${resource.write}`);

        let created = await this.create(resource.write, preparedData, async (resource, currentData) => {
            currentData[update.key] = `${update.prefix}${currentData[update.key]}`;
            return await this.upsales[resource].create(currentData);
        });

        this.logger.info(created);

        return created
    }


    async integrateZohoProducts (zohoProducts) {
        let createdZohoProducts = await this.integrate(zohoProducts, {
            read: `products`,
            write: `products`
        }, {
            dynamic: {
                Product_Name: 'name',
                Unit_Price: 'listPrice',
                Product_Active: 'active',
            },
            static: {}
        }, {
            key: 'name',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                },
                {
                    name: 'code',
                    value: 'code',
                }]
        });

        return createdZohoProducts
    }

    async integrateActivityTypes () {
        let types = [{name: 'Calls'}, {name: 'Tasks'}, {name: `Events`}],
            results = [];

        types = await this.filterDuplicates(`activitytypes`, `name`, types)
        for (let i = 0; i < types.length; i++) {
            results.push(await this.upsales.activitytypes.create({name: types[i].name}))
        }
        return results;
    }

    async integrateAppointmentTypes () {
        let types = [{name: 'Calls'}, {name: 'Tasks'}, {name: `Events`}],
            results = [];

        types = await this.filterDuplicates(`appointmenttypes`, `name`, types)
        for (let i = 0; i < types.length; i++) {
            results.push(await this.upsales.appointmenttypes.create({name: types[i].name}))
        }
        return results;
    }

    async integrateZohoCompanies (zohoCompany) {
        let createdZohoCompanies = await this.integrate(zohoCompany, {
            read: `company`,
            write: `company`
        }, {
            dynamic: {
                Account_Name: 'name',
                Phone: 'phone',
                Website: 'webpage'
            },
            static: {}
        }, {
            key: 'name',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                }]
        });

        return createdZohoCompanies;
    }

    async getRelationResource (resource, params, defaultParams) {
        let relationModel = (await this.upsales[resource].get(params))[0];
        if (!relationModel) {
            relationModel = await this.upsales[resource].create(defaultParams) ||
                (await this.upsales[resource].get({}))[0];
            await new Promise(r => setTimeout(r, 5000));
        }

        return relationModel
    }

    async integrateZohoContacts (contacts, companies) {
        let createdZohoContacts = await this.integrate(contacts, {
            read: `contacts`,
            write: `contacts`
        }, {
            dynamic: {
                Full_Name: 'name',
                Phone: 'phone',
                Email: 'email'
            },
            functions: {
                Account_Name: {
                    type: Object,
                    name: 'client',
                    resource: 'company',
                    param: `name`,
                    defaultValue: `Zoho`
                }
            },
            static: {
                active: 1,
            }
        }, {
            key: 'name',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                }]
        });

        return createdZohoContacts
    }

    async integrateZohoActivities (zohoActivities) {
        let self = this;
        let createdActivities = await this.integrate(zohoActivities, {
            read: `activities`,
            write: `activities`
        }, {
            dynamic: {
                Venue: 'notes',
                Subject: 'description',
                Created_Time: 'regDate',
                Closed_Time: 'closeTime',
                Start_DateTime: 'date',
            },
            functions: {
                Who_Id: {
                    type: Array,
                    name: 'contacts',
                    resource: 'contacts',
                    param: `name`,
                    defaultValue: `Zoho`
                },
                What_Id: {
                    type: Object,
                    name: 'client',
                    resource: 'company',
                    param: `name`,
                    defaultValue: `Zoho`
                },
                Activity_Type: {
                    type: Object,
                    name: 'activityType',
                    resource: `activitytypes`,
                    param: `name`,
                    defaultValue: `Zoho`
                },
                Owner: {
                    type: Array,
                    name: 'users',
                    resource: 'users',
                    param: `name`,
                    defaultValue: `Zoho`
                }
            },
            static: {
                date: new Date()
            }
        }, {
            key: 'name',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                }]
        });

        return createdActivities;
    }

    async integrateZohoDeals (deals) {
        let createdOrders = await this.integrate(deals, {
            read: `orders`,
            write: `orders`
        }, {
            dynamic: {
                Deal_Name: 'description',
                Description: 'notes',
                Probability: 'probability',
                Closing_Date: 'closeData',
                Created_Time: 'regDate',
                Modified_Time: 'modDate',
                Last_Activity_Time: 'date'
            },
            functions: {
                Account_Name: {
                    type: Object,
                    name: 'client',
                    resource: 'company',
                    param: `name`,
                    defaultValue: `Zoho`
                },
                Stage: {
                    type: Object,
                    name: 'stage',
                    resource: 'orderstages',
                    param: `name`,
                    defaultValue: `Zoho`,
                    additional: {
                        Probability: `probability`
                    }
                }
            },
            static: {
                date: new Date(),
                "orderRow": [
                    {
                        "quantity": 1,
                        "price": 1,
                        "listPrice": 1,
                        "product": {
                            "id": (await this.upsales.products.get({name: `Zoho`}))[0]
                        }
                    }
                ],
                probability: 100
            }
        }, {
            key: 'name',
            prefix: 'zoho_',
            custom: [
                {
                    name: 'zohoId',
                    value: 'id',
                }]
        });

        return createdOrders
    }

    async initDefault (name) {
        let company = await this.getRelationResource(`company`, {name: name}, {name: name}),
            contact = await this.getRelationResource(`contacts`, {name: name}, {name: name, client: {id: company.id}}),
            product = await this.getRelationResource(`products`, {name: name}, {name: name, "listPrice": 1, "active": 1})
    }

    async updateProgress (progress) {
        try {
            this.logger.action(`Updating progress`);
            let res = await this.upsales.onboardingimports.update({
                id: this.importId,
                progress: progress || (this.progress + this.progressStep)
            });
            this.logger.info(res);
        } catch (e) {
            this.logger.error(e.message)
        }
    }
}

module.exports = Integrator;

