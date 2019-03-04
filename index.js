const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const qs = require("querystring");

const category = 'aksesoris-fashin';

(async function run () {
    try {
        let page = (await axios.get('https://www.indonetwork.co.id/' + category + '/perusahaan')).data;
        fs.writeFileSync('page.html', page);
        let $ = cheerio.load(fs.readFileSync('page.html', 'utf8'));

        let companies = $('.list-item-company').toArray();

        const pageCount = $('span.black').text();

        let leads = [];

        for (i=1; i<=pageCount; i++) {
            if (i>1) {
                page = (await axios.get('https://www.indonetwork.co.id/' + category + '/perusahaan?page=' + i)).data;
                $ = cheerio.load(fs.readFileSync('page.html', 'utf8'));
                companies = $('.list-item-company').toArray();
            }
            const abc = companies.map(async (el, i) => {
                let company = cheerio.load(el);

                let url = 'https:' + company('.link_product').attr('href');

                let detailPage = (await axios.get(url)).data;
                let dp = cheerio.load(detailPage);

                let data = {
                    url: url,
                    name: cleanup(company('.link_product').text()),
                    description: cleanup(company('.desc').text()),
                    address: cleanup(company('.seller-name').text()),
                    location: cleanup(company('.lokasi').text()),
                    leads: {
                        phone: await leadRequest({
                            id: dp('.mask-phone-button').attr('id'),
                            dataText: dp('.mask-phone-button').attr('data-text')
                        }, 'phone'),
                        email: await leadRequest({
                            id: dp('.mask-email-button').attr('id'),
                            dataText: dp('.mask-email-button').attr('data-text')
                        }, 'email'),
                        wa: await leadRequest({
                            id: dp('.mask-wa-button').attr('id'),
                            dataText: dp('.mask-wa-button').attr('data-text')
                        }, 'wa')
                    }
                };

                console.log(data);

                leads.push(data);
            });
            console.log('PAGE: ' + i);
            await Promise.all(abc);
        }

        console.log('LEADS COUNT: ' + leads.length);
        fs.writeFileSync('leads.json', JSON.stringify(leads));
    } catch (error) {
        console.log(error);
    }
})();

const leadRequest = async (data, type = 'phone') => {
    return (await axios({
        method: 'post',
        url: 'https://www.indonetwork.co.id/leads',
        data: qs.stringify({
            'id': data.dataText,
            'text': data.id,
            'type': type
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
    })).data.text;
};

const getLeads = async (data) => {
    const leads = {
        phone: await leadRequest(data, 'phone'),
        email: await leadRequest(data, 'email'),
        wa: await leadRequest(data, 'wa')
    };
    return leads;
};

const cleanup = (text) => {
    text = text.replace(/\s+/g, " ")
       .replace(/^\s+|\s+$/gm, "");
    return text;
};
