/**
 * Created by 4ant0m on 3/23/19.
 */
const Upsales = require('./upsales-sdk');
const Zoho = require('./zoho-sdk');
const logger = require(`./lib/log`);
const config = require(`./config`);

class Integrator {
    constructor (data) {
        this.upsales = new Upsales({
            version: 2,
            token: data.upsales.token
        });
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

    async clear (resource) {
        this.logger.action(`Clearing ${resource}`);
        let results = [],
            duplicates = await this.upsales[resource].getAll();

        for (let i = 0; i < duplicates.length; i++) {
            this.logger.action(`Deleting ${resource}: ${duplicates[i].name} `);
            results.push(await this.upsales[resource].delete({id: duplicates[i].id}));
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

    async integrateCurrencies () {
        let currency = await integrator.upsales.currencies.get()

        this.logger.action(`Creating currency`)
        let currencyCreated = await integrator.upsales.currencies.create({
            iso: 'USD',
            rate: 0.1111111111111111,
            active: true
        })

        this.logger.info(currencyCreated)
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


    async integrateProducts (zohoProducts) {
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
}

(async () => {
    let integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        }
    });

    let zoho = new Zoho();
    await zoho.init();

    let res = await zoho.generateAuthTokenFromGrant('fastlittle6@gmail.com', '1000.8b77adbe52d0deaf6313dcb6a12bee9f.d69b6e786a50847d2f800caa66d59379')

    console.log(res)
    //let zohoUsers = await zoho.users.getAll();

   /* let products = await zoho.ZCRMRestClient.API.USERS.get({params: {
        page: 1
    }});

    console.log(products)*/
    //console.log(await integrator.upsales.udoobjects.get())
   //console.log(await integrator.upsales.udoobjects.delete({id: 411}))

    console.log(await zoho.org.get())

    //console.log(await zoho.currencies.getAll())

    //await integrator.integrateZohoUsers(zohoUsers)


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


