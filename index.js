/**
 * Created by 4ant0m on 3/21/19.
 */
const Zoho = require('./zoho-sdk');
const Integrator = require('./integrator');
const config = require('./config');

class Import {
    async constructor(data) {
        this.zohoUsers = []
        this.zohoCurrencies = []
        this.zohoProducts = []
        this.zohoCompanies = []
        this.zohoContacts = []
        this.zohoActivities = []
        this.zohoDeals = []

        this.integrator = new Integrator({
            upsales: {
                token: data.upsales.token
            },
            fixer: {
                token: config.APItokens.fixer
            },
            clientId: data.upsales.clientId,
            importId: data.upsales.importId
        });

        let zoho = new Zoho();

        await zoho.init({
            client_id: data.zoho.clientId,
            client_secret: data.zoho.clientSecret,
            redirect_url: data.zoho.redirectUrl,
        });

        if (data.zoho.grantToken)
            console.log(await zoho.generateAuthTokenFromGrant(data.zoho.userId, data.zoho.grantToken))
    }
}

async function integrate (data) {
    let integrator = new Integrator({
        upsales: {
            token: data.upsales.token
        },
        fixer: {
            token: config.APItokens.fixer
        },
        clientId: data.upsales.clientId,
        importId: data.upsales.importId
    });

    let zoho = new Zoho();

    await zoho.init({
        client_id: data.zoho.clientId,
        client_secret: data.zoho.clientSecret,
        redirect_url: data.zoho.redirectUrl,
    });

    if (data.zoho.grantToken)
        console.log(await zoho.generateAuthTokenFromGrant(data.zoho.userId, data.zoho.grantToken))

    let zohoUsers = await zoho.users.getAll(),
        zohoCurrencies = await zoho.org.get() || [{iso: `USD`}],
        zohoProducts = await zoho.products.getAll(),
        zohoCompanies = await zoho.accounts.getAll(),
        zohoContacts = await zoho.contacts.getAll(),
        zohoActivities = await zoho.activities.getAll(),
        zohoDeals = await zoho.deals.getAll();

    if (data.upsales.clear) {
        console.log(await integrator.clear('contacts'))
        console.log(await integrator.clear('currencies'))
        console.log(await integrator.clear('company'))
        console.log(await integrator.clear('activities'))
        console.log(await integrator.clear('orders'))
    }

    console.log(
        `users - `, zohoUsers,
        `currencies - `, zohoCurrencies,
        `products - `, zohoProducts,
        `companies - `, zohoCompanies,
        `contacts - `, zohoContacts,
        `activities - `, zohoActivities,
        `orders - `, zohoDeals);

    await integrator.initDefault(`Zoho`);

    let users = await integrator.integrateZohoUsers(zohoUsers);
    await integrator.updateProgress(15)
    let currencies = await integrator.integrateZohoCurrencies(zohoCurrencies[0].iso_code)
    await integrator.updateProgress(30)
    let activitytypes = await integrator.integrateActivityTypes()
    await integrator.updateProgress(45)
    let products = await integrator.integrateZohoProducts(zohoProducts)
    await integrator.updateProgress(60)
    let companies = await integrator.integrateZohoCompanies(zohoCompanies)
    companies = await integrator.upsales.company.getAll();
    await integrator.updateProgress(75)
    let contacts = await integrator.integrateZohoContacts(zohoContacts, companies)
    await integrator.updateProgress(80)
    let activities = await integrator.integrateZohoActivities(zohoActivities)
    await integrator.updateProgress(90)
    let orders = await integrator.integrateZohoDeals(zohoDeals);
    await integrator.updateProgress(100)

    console.log(
        `users - `, users,
        `currencies - `, currencies,
        `activitytypes - `, activitytypes,
        `products - `, products,
        `companies - `, companies,
        `contacts - `, contacts,
        `activities - `, activities,
        `orders - `, orders);
}

module.exports = integrate;

(async () => {
   /* integrate({
            zoho: {
                clientId: `1000.4MGW0N1L22RP14429KEOMAEHDFRVWR`, //`1000.3VWC60DB9XQY6421320J0TK98882GZ`,
                clientSecret: `d28dcbff21d80d3cf35ddff6e5095c00b95b179a2b`,//`517b8dcec86c97c3d01d65a0ede5b9216d2fc91cc8`,
                redirectUrl: `https://upsales.com`, //`http://localhost:8000/`,
                userId: `christyburgen696@yahoo.com`,
                grantToken: `1000.1eec5879e913e7ba048131546bfe2b41.5cbd4c0bd2596078bc5beec656070291`
            },
            upsales: {
                token: `5b6ead9f7634cdbf9196828dfa134e820732cb59b510b25b4239876ac720e8b6`,
                clientId: 10488,
                importId: 431,
                clear: true
            }
        })

    return*/

    let integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        },
        fixer: {
            token: config.APItokens.fixer
        },
        clientId: 10488,
        importId: 431
    });

    let zoho = new Zoho();
    await zoho.init({
        client_id: "1000.3VWC60DB9XQY6421320J0TK98882GZ",
        client_secret: `517b8dcec86c97c3d01d65a0ede5b9216d2fc91cc8`,
        redirect_url: `http://localhost:8000/`,
        user_id: `fastlittle6@gmail.com`,
    });

    let userId, grantToken;
    userId = `fastlittle6@gmail.com`
    grantToken = `1000.d61f91eddfac29697e80347f092d689b.8e8926051e98578e64484c8080845ad8`

   // console.log(await zoho.generateAuthTokenFromGrant(userId, grantToken))


    console.log();

    console.log(await integrator.upsales.udoobjects.get())
    console.log(await integrator.upsales.udoobjects.delete({id: 435}))

})()