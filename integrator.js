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
        this.fixer.set({ accessKey: config.APItokens.fixer })
        this.clientId = 10488;
        this.logger = new logger({context: `INTEGRATOR`})
    }

    prepareData (data, map, extend = {}, custom) {
        let results = data.map(item => {
            let result = {};
            for (let prop in map) {
                result[map[prop]] = item[prop]
            }
            for (let prop in extend) {
                result[prop] = extend[prop]
            }
            if (custom) {
                for (let i = 0; custom.length; i++) {
                    result.custom.push({
                        fieldId: custom[i].fieldId,
                        value: item[custom[i].value]
                    });
                }
            }
            return result
        });
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

    matchItem (data, item, param) {
        return data.find((result) => result[param] == item[param])
    }

    async filterDuplicates (resource, param, data) {
        this.logger.action(`Filtering ${resource} duplicates with such param - ${param}`);
        let results = await this.upsales[resource].getAll();

        let filteredData = data.filter((item) =>
            results.find((result) => result[param] == item[param]) == null
        );

        return filteredData
    };

    async update () {

    }

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
            this.logger.action(`Deleting ${resource}: ${duplicates[i].name} `);
            results.push(await this.upsales[resource].delete({id: duplicates[i][field]}));
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
                this.logger.info(update)
            }
        }
    }

    async integrateZohoUsers (zohoUsers) {
        let createdUser = await this.integrate(zohoUsers, {
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
                //role: 'role'
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
            custom: 'zohoId'
        });

        this.logger.info(createdUser);

        return createdUser;

        /*let upsalesUsers = await this.upsales.users.getAll();
         this.logger.info(upsalesUsers);

         await this.updateMatchItem('masterusers', upsalesUsers, preparedZohoUsers, `email`);

         let createdUsers = await this.create('masterusers', preparedZohoUsers, async (resource, currentData) => {
         currentData.email = `zoho_${currentData.email}`;
         return await this.upsales[resource].create(currentData);
         });

         this.logger.info(createdUsers);*/
    }

    async integrateZohoCurrencies (iso) {
        let isoCodes = []
            isoCodes.push(iso);
        this.logger.action(`Getting currencies`)
        let quotes = await fixer.latest({ base: 'EUR'})
        let currencies = await this.upsales.currencies.get()
        //let currency = await this.upsales.currencies.update({id: `USD`, masterCurrency: false})
        //let currencyD = await this.upsales.currencies.delete({id: 'USD'})
        let rate = quotes.rates[iso] / quotes.rates['USD']
        this.logger.info(currencies)

        this.logger.action(`Creating currency`)

        let currencyCreated = await this.upsales.currencies.create({
            iso: iso,
            rate: rate,
            active: true,
        });

        this.logger.info(currencyCreated)
        return currencyCreated
    }

    async integrate (data, resource = {}, map = {}, update = {}) {
        let customfields = [];
        for (let i = 0; i < update.custom; i++) {
            let customfield = await this.createCustomFields(resource.read.slice(0, -1), update.custom[i].name);
            this.logger.info(customfield);
            customfields.push({
                fieldId: customfield.id,
                value: update.custom[i].value
            })
        }

        this.logger.action(`Preparing ${resource.read}`);
        let preparedData = this.prepareData(data, map.dynamic, map.static, customfields);

        this.logger.info(preparedData);

        this.logger.action(`Getting ${resource.read} from upsales`);
        let upsales = await this.upsales[resource.read].getAll();
        this.logger.info(upsales);

        this.logger.action(`Updating ${resource.write} from upsales`);
        await this.updateMatchItem(resource.write, upsales, preparedData, update.key);

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
            custom: [{
                name: 'zohoId',
                value: 'id'
            }]
        });

        return createdZohoProducts
    }

    async integrateActivityTypes
}

async function integrate () {
    let integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        }
    });

    let zoho = new Zoho();
    await zoho.init();

    let zohoUsers = await zoho.users.getAll(),
        zohoCurrencies = await zoho.org.get(),
        zohoProducts = await zoho.products.getAll()

    let users = await integrator.integrateZohoUsers(zohoUsers),
        currency = await integrator.integrateZohoCurrencies(zohoCurrencies[0].iso_code),
        products = await integrator.integrateZohoProducts(zohoProducts);
}

(async () => {
    let integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        }
    });

    let zoho = new Zoho();
    await zoho.init();

    //let res = await zoho.generateAuthTokenFromGrant('fastlittle6@gmail.com', '1000.4d2169a731c728efc729cfefe9ae4da5.6ff4524865b78b926e272bba68d53348')

    //console.log(res)
    //

    //console.log(products)

    /*console.log(await integrator.upsales.udoobjects.get())
   console.log(await integrator.upsales.udoobjects.delete({id: 412}))*/



    //await integrator.clear('currencies', `iso`, `get`)
    let zohoCurrencies = await zoho.org.get()
   // await integrator.integrateCurrencies(zohoCurrencies[0].iso_code)

    let activities = await zoho.activities.getAll();
    console.log(activities)

    //console.log(await zoho.currencies.getAll())

    //


    //console.log(zohoUsers)


    //let filteredUsers = await integrator.filterDuplicates(`users`, `email`, preparedUsers)
    //console.log(filteredUsers)


    //console.log(usersUpsales)

    /*let user = await integrator.upsales.masterusers.create({
     "email": "dssd12@gmal.com",
     "clientId": 9129,
     "name": "Anders Andersson",
     "language": "en-EN"
     })

     let user = (await integrator.upsales.users.get({email: 'fastlittle6@gmail.com'}))[0]
     console.log(user)
     let deletedUser = await integrator.upsales.users.delete({id: user.id})
     */

    /*let customfield = await integrator.upsales.usercustomfields.create({
     "name": "zohoId",
     "default": "",
     "datatype": "String",
     "visible": 1,
     "editable": 1,
     "searchable": 0,
     "dropdownDefault": "",
     "sortId": 0,
     "obligatoryField": 0,
     "roles": []
     })*/

    //let customfield = await integrator.upsales.usercustomfields.get()

    //console.log(customfield)

    //let users = await integrator.upsales.users.getAll()

    //console.log(users)


    /* let user = await integrator.upsales.masterusers.create({
     "email": "dssd13@gmal.com",
     "clientId": 9129,
     "name": "Anders Andersson",
     "language": "en-EN",
     "teamLeader": 0,
     "active": 1,
     "ghost": 0,
     "export": 1,
     "password": "123456",
     "administrator": 1,
     "custom": [{
     "fieldId": 10,
     "value": "lets"
     }]
     })*/

    //console.log(user)

})()


