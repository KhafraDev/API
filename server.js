const app = require('express')();
const fetch = require('node-fetch'); // no need for axios' features, make it simple and lighter.
const { load } = require('cheerio');

const results = {}; // why use a database when you can use a global object?

/**
 * Fetches the site's HTML to be parsed.
 * @returns {Promise<string>} site HTML
 */
const makeRequest = async () => {
  try {
    const res = await fetch('https://www.worldometers.info/coronavirus/');
    if(res.status !== 200) {
      throw new Error(`Received status ${res.status} (${res.statusText})`);
    }
    return res.text();
  } catch(err) {
    console.error(err);
    return null;
  }
}

const globalInfo = async () => {
  const response = await makeRequest();
  if(response === null) {
    return null;
  }

  // to store parsed data
  const result = {};

  // get HTML and parse death rates
  const html = load(response);
  html('.maincounter-number').filter((i, el) => {
    let count = el.children[0].next.children[0].data || '0';
    count = parseInt(count.replace(/,/g, '') || '0', 10);
    // first one is
    if (i === 0) {
      result.cases = count;
    } else if (i === 1) {
      result.deaths = count;
    } else {
      result.recovered = count;
    }
  });

  for(const [k, v] of Object.entries(result)) {
    results[k] = v;
  }
  console.log('Updated The Cases', result);
}

const countryInfo = async () => {
  const response = await makeRequest();
  if(response === null) {
    return null;
  }

  // to store parsed data
  const result = [];

  // get HTML and parse death rates
  const html = load(response);
  const countriesTable = html('table#main_table_countries');
  const countriesTableCells = countriesTable
    .children('tbody')
    .children('tr')
    .children('td');

  // NOTE: this will change when table format change in website
  const totalColumns = 9;
  const countryColIndex = 0;
  const casesColIndex = 1;
  const todayCasesColIndex = 2;
  const deathsColIndex = 3;
  const todayDeathsColIndex = 4;
  const curedColIndex = 5;
  const criticalColIndex = 7;

  // minus totalColumns to skip last row, which is total
  for (let i = 0; i < countriesTableCells.length - totalColumns; i += 1) {
    const cell = countriesTableCells[i];
    const data = cell.children[0].data || '';
    // get country
    if (i % totalColumns === countryColIndex) {
      let country =
        cell.children[0].data ||
        cell.children[0].children[0].data ||
        // country name with link has another level
        cell.children[0].children[0].children[0].data ||
        cell.children[0].children[0].children[0].children[0].data ||
        '';
      country = country.trim();
      if (country.length === 0) {
        // parse with hyperlink
        country = cell.children[0].next.children[0].data || '';
      }
      result.push({ country: country.trim() || '' });
    }
    // get cases
    if (i % totalColumns === casesColIndex) {
      result.pop().cases = parseInt(data.trim().replace(/,/g, '') || '0', 10);
    }
    // get today cases
    if (i % totalColumns === todayCasesColIndex) {
      result.pop().todayCases = parseInt(data.trim().replace(/,/g, '') || '0', 10);
    }
    // get deaths
    if (i % totalColumns === deathsColIndex) {
      result.pop().deaths = parseInt(data.trim().replace(/,/g, '') || '0', 10);
    }
    // get today deaths
    if (i % totalColumns === todayDeathsColIndex) {
      result.pop().todayDeaths = parseInt(data.trim().replace(/,/g, '') || '0', 10);
    }
    // get cured
    if (i % totalColumns === curedColIndex) {
      result.pop().recovered = parseInt(data.trim().replace(/,/g, '') || 0, 10);
    }
    // get critical
    if (i % totalColumns === criticalColIndex) {
      result.pop().critical = parseInt(data.trim().replace(/,/g, '') || '0', 10);
    }
  }

  results.countries = result;
  console.log('Updated The Countries', result);
}

setInterval(globalInfo, 60000);
setInterval(countryInfo, 60000);

app.get('/', (_, res) => response.send(`${res.cases} cases are reported of the COVID-19 Novel Coronavirus strain<br> ${res.deaths} have died from it <br>\n${res.recovered} have recovered from it <br> Get the endpoint /all to get information for all cases <br> get the endpoint /countries for getting the data sorted country wise`));
app.get('/all/', (_, res) => res.send({ cases: results.cases, deaths: results.deaths, recovered: results.recovered }));
app.get('/invite/', (_, res) => res.status(302).redirect('https://discordapp.com/oauth2/authorize?client_id=685268214435020809&scope=bot&permissions=52224'))
app.get('/countries/', (_, res) => res.send(results.countries));
app.listen(process.env.PORT, () => console.log('Your app is listening on port ' + process.env.PORT));

// run on start-up, instead of waiting 60 seconds.
setTimeout(() => Promise.all([globalInfo(), countryInfo()]), 10);