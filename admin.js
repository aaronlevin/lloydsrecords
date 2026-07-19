const utils = importUtils();

/**
 * Parse a money value from the spreadsheet, which may arrive as a number
 * or as a Square-formatted string like "$23.00", "-$2.30", or "$1,234.00".
 */
function parseMoney(value) {
  if(typeof value === "number") {
    return value;
  }
  if(value === undefined || value === null) {
    return 0;
  }
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize a consignor id to its canonical 3-digit string form
 * ("086", not 86) so Map lookups work no matter how the cell is formatted.
 */
function normalizeId(value) {
  const id = String(value).trim();
  return /^[0-9]+$/.test(id) ? id.padStart(3, "0") : id;
}

/**
 * Convert a time value to a fraction of a day. Handles both spreadsheet
 * serial fractions (numbers) and "HH:MM:SS" strings.
 */
function timeToFraction(value) {
  if(typeof value === "number") {
    return value;
  }
  const match = /^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/.exec(String(value).trim());
  if(match === null) {
    return 0;
  }
  return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) / 86400;
}

function formatDateValue(value) {
  const date = utils.ValueToDate(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().split('T')[0];
}

function groupByConsignor(items) {
  return items.reduce((map, obj) => {
    if(map.has(obj.consignor)) {
      map.get(obj.consignor).push(obj);
    } else {
      map.set(obj.consignor, [obj]);
    }
    return map;
  }, new Map());
}

class ConsignorRate {
  static amount(sale) {
    if(sale < 20) {
      return sale * 0.5;
    } else if(sale < 150) {
      return sale * 0.7;
    } else if(sale < 400) {
      return sale * 0.8;
    } else {
      return sale * 0.9;
    }
  }
}

class Payout {
  constructor(date, consignor, amount, note) {
    this.date = date;
    this.consignor = normalizeId(consignor);
    this.amount = parseMoney(amount);
    this.note = note;
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    headerRow.insertCell().textContent = "date";
    headerRow.insertCell().textContent = "consignor";
    headerRow.insertCell().textContent = "amount";
    headerRow.insertCell().textContent = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    row.insertCell().textContent = formatDateValue(this.date);
    row.insertCell().textContent = this.consignor;
    row.insertCell().textContent = this.amount;
    row.insertCell().textContent = this.note ?? "";
  }
}

class CashSale {
  constructor(date, price, consignor, item, note) {
    this.date = date;
    this.price = parseMoney(price);
    this.consignor = normalizeId(consignor);
    this.item = item;
    this.note = note;
    this.owed = ConsignorRate.amount(this.price);
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    headerRow.insertCell().textContent = "date";
    headerRow.insertCell().textContent = "consignor";
    headerRow.insertCell().textContent = "net";
    headerRow.insertCell().textContent = "owed";
    headerRow.insertCell().textContent = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    row.insertCell().textContent = formatDateValue(this.date);
    row.insertCell().textContent = this.consignor;
    row.insertCell().textContent = Render.float(this.price);
    row.insertCell().textContent = Render.float(this.owed);
    const noteCell = row.insertCell();
    if(this.note === undefined || this.note === null || this.note === "") {
      noteCell.textContent = `${this.item ?? ""}`;
    } else {
      noteCell.textContent = `${this.item ?? ""} (${this.note})`;
    }
  }

}

class CardSale {
  // exactly three digits followed by whitespace (or nothing);
  // anything else ("1234 x", "123abc", "555-1234 call me") goes to the ??? bucket
  ConsignorIdRegex = /^([0-9]{3})(?:\s+([\s\S]*))?$/;
  constructor(date, time, quantity, gross, discount, net, note) {
    this.date = date;
    this.time = time;
    this.sortKey = (typeof date === "number" ? date : 0) + timeToFraction(time);
    this.quantity = quantity;
    this.gross = parseMoney(gross);
    this.discount = parseMoney(discount);
    this.net = parseMoney(net);
    this.owed = ConsignorRate.amount(this.net);

    const match = this.ConsignorIdRegex.exec(String(note ?? "").trim());
    if(match !== null) {
      this.consignor = match[1];
      this.note = match[2] ?? "";
    } else {
      this.consignor = "???";
      this.note = String(note ?? "");
    }
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    headerRow.insertCell().textContent = "date";
    headerRow.insertCell().textContent = "consignor";
    headerRow.insertCell().textContent = "quantity";
    headerRow.insertCell().textContent = "discount";
    headerRow.insertCell().textContent = "net";
    headerRow.insertCell().textContent = "owed";
    headerRow.insertCell().textContent = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    row.insertCell().textContent = formatDateValue(this.date);
    row.insertCell().textContent = this.consignor;
    row.insertCell().textContent = this.quantity;
    row.insertCell().textContent = Render.float(this.discount);
    row.insertCell().textContent = Render.float(this.net);
    row.insertCell().textContent = Render.float(this.owed);
    row.insertCell().textContent = this.note;
  }
}

class Consignor {
  constructor(id, name, email) {
    this.id = normalizeId(id);
    this.name = name;
    this.email = email;
  }
}

class Render {

  static float(number) {
    const rounded = Math.round(number * 100) / 100; // Round to 2 decimal places
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  }

  static error(errorsDiv, color, message) {
    const p = document.createElement("p");
    p.style.color = color;
    p.textContent = message;
    errorsDiv.appendChild(p);
  }

  /**
   *  presumes the type of sales has a `renderRow(table)` function
  */
  static rows(sales, consignorId, rowHeaderFn, resultsDiv, errorsDiv, errorColor, errorMessageFn) {
    // clear previous content (errorsDiv is cleared once per report, by the caller)
    resultsDiv.innerHTML = '';

    // render sales
    if(sales.has(consignorId)) {
      const table = document.createElement("table");
      table.classList.add("results-table");
      rowHeaderFn(table);
      sales.get(consignorId).forEach((sale) => {
        sale.renderRow(table)
      });
      resultsDiv.appendChild(table);
    } else {
      Render.error(errorsDiv, errorColor, errorMessageFn(consignorId));
    }
  }

}

class Summary {
  constructor(consignorId, cardSalesMap, cashSalesMap, payoutsMap) {
    this.totalPayout = 0;
    this.cardSalesNet = 0;
    this.cashSalesNet = 0;
    this.payoutsNet = 0;

    if(cardSalesMap.has(consignorId)) {
      for(const sale of cardSalesMap.get(consignorId)) {
        this.cardSalesNet += sale.net || 0;
        this.totalPayout += sale.owed || 0;
      }
    }

    if(cashSalesMap.has(consignorId)) {
      for(const sale of cashSalesMap.get(consignorId)) {
        this.cashSalesNet += sale.price || 0;
        this.totalPayout += sale.owed || 0;
      }
    }

    if(payoutsMap.has(consignorId)) {
      for(const out of payoutsMap.get(consignorId)) {
        this.payoutsNet += out.amount || 0;
      }
    }
    this.totalSales = this.cardSalesNet + this.cashSalesNet;

    // store-wide totals, logged to the console
    let storeSales = 0;
    let consignorsOwed = 0;
    let storePayouts = 0;
    for(const sales of cardSalesMap.values()) {
      for(const sale of sales) {
        storeSales += sale.net || 0;
        consignorsOwed += sale.owed || 0;
      }
    }
    for(const sales of cashSalesMap.values()) {
      for(const sale of sales) {
        storeSales += sale.price || 0;
        consignorsOwed += sale.owed || 0;
      }
    }
    for(const outs of payoutsMap.values()) {
      for(const out of outs) {
        storePayouts += out.amount || 0;
      }
    }

    console.log(`TOTALS\n\ttotal sales = ${storeSales}\n\tConsignors Owed = ${consignorsOwed}\n\tpayouts = ${storePayouts}\n\tShop Takehome = ${storeSales-consignorsOwed}`);
  }

  static format(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  calculatePayout() {
    return (this.totalPayout - this.payoutsNet);
  }

  render(div) {
    // clear div
    div.innerHTML = '';

    const ul = document.createElement("ul");
    const cardSalesLi = document.createElement("li");
    cardSalesLi.textContent = `card sales: ${Summary.format(this.cardSalesNet)}`;
    ul.appendChild(cardSalesLi);

    const cashSalesLi = document.createElement("li");
    cashSalesLi.textContent = `ca$h sales: ${Summary.format(this.cashSalesNet)}`;
    ul.appendChild(cashSalesLi);

    const totalSalesLi = document.createElement("li");
    totalSalesLi.innerHTML = `<strong>total sales</strong>: ${Summary.format(this.totalSales)}`;
    ul.appendChild(totalSalesLi);

    const totalOwedLi = document.createElement("li");
    totalOwedLi.textContent = `consignor's cut: ${Summary.format(this.totalPayout)}`;
    ul.appendChild(totalOwedLi);

    const totalPayoutsLi = document.createElement("li");
    totalPayoutsLi.textContent = `payouts to date: ${Summary.format(this.payoutsNet)}`;
    ul.appendChild(totalPayoutsLi);

    const totalPaymentLi = document.createElement("li");
    totalPaymentLi.innerHTML = `<strong>amount owed</strong> (consignor's cut - payouts to date): ${Summary.format(this.calculatePayout())}`;
    ul.appendChild(totalPaymentLi);

    div.appendChild(ul);
  }

}

document.addEventListener('DOMContentLoaded', function() {

  var consignorId = "000";
  /** setup buttons **/

  const spreadsheetId = "14O0EDOq9luZvaxUd69uyFBWFe0tQt5xxQEas2E_i0pc";
  const accessToken = utils.getAccessToken();
  if(accessToken === null || accessToken === undefined) {
    utils.createOAuthButton(utils.clientId, "initiate-oauth", "admin");
    return;
  }

  const errorsDiv = document.getElementById("errors");
  const reportError = (error) => {
    console.error(error);
    Render.error(errorsDiv, "red", `ERROR: ${error.message} — your login may have expired, re-authenticate and try again.`);
    if(document.getElementById("initiate-oauth").childNodes.length === 0) {
      utils.createOAuthButton(utils.clientId, "initiate-oauth", "admin");
    }
  };

  // add consignors selections
  const selectElem = document.getElementById("consignor-select");
  selectElem.addEventListener("change", (event) => {
    consignorId = event.target.value;
  });

  const consignorsPromise =
    utils.handleSpreadsheet(spreadsheetId, "consignors", utils.clientId, accessToken)
      .then((json) => {
        const consignors = json.valueRanges[0].values.slice(1).map((v) => new Consignor(...v));
        consignors.sort((a, b) => a.id.localeCompare(b.id));
        consignors.forEach((consignor) => {
          const option = document.createElement("option");
          option.value = consignor.id;
          option.textContent = `${consignor.id}: ${consignor.name}`;
          selectElem.appendChild(option);
        });
        // keep the tracked id in sync with whatever the select now shows
        consignorId = selectElem.value;
        return consignors;
      });

  const consignorPayoutsPromise =
    utils.handleSpreadsheet(spreadsheetId, "consignor-payouts", utils.clientId, accessToken)
      .then((json) => {
        const outs = json.valueRanges[0].values.slice(1).map((e) => new Payout(...e));
        return groupByConsignor(outs);
      });

  const salesPromise =
    utils.handleSpreadsheet(spreadsheetId, "sales", utils.clientId, accessToken)
      .then((json) => {
        const sales = json.valueRanges[0].values.slice(1).map((e) => {
          return new CardSale(e[0], e[1], e[5], e[9], e[10], e[11], e[16]);
        });
        const salesMap = groupByConsignor(sales);
        for(const grouped of salesMap.values()) {
          grouped.sort((a,b) => a.sortKey - b.sortKey);
        }
        return salesMap;
      });

  const cashSalesPromise =
    utils.handleSpreadsheet(spreadsheetId, "tracker", utils.clientId, accessToken)
      .then((json) => {
        const sales = json.valueRanges[0].values.slice(1).map((e) => {
          return new CashSale(...e);
        });
        const salesMap = groupByConsignor(sales);
        // sort the payments
        for(const grouped of salesMap.values()) {
          grouped.sort((a,b) => a.date - b.date);
        }
        return salesMap;
      });

  Promise.all([consignorsPromise, consignorPayoutsPromise, salesPromise, cashSalesPromise])
    .then((results) => {
      const consignorPayouts = results[1];
      const cardSales = results[2];
      const cashSales = results[3];

      const button = document.getElementById("consignor-sales-button");
      button.addEventListener("click", (e) => {

        // clear errors from the previous report
        errorsDiv.innerHTML = '';

        // render summary
        const summary = new Summary(consignorId, cardSales, cashSales, consignorPayouts);
        summary.render(document.getElementById("summary-results"));

        // render sales
        Render.rows(
          cardSales,
          consignorId,
          CardSale.renderRowHeader,
          document.getElementById("card-sales-results"),
          errorsDiv,
          "red",
          (id) => `ERROR: no card sales for ${id}`
        );

        // render cash sales
        Render.rows(
          cashSales,
          consignorId,
          CashSale.renderRowHeader,
          document.getElementById("cash-sales-results"),
          errorsDiv,
          "purple",
          (id) => `WARNING: no cash sales for ${id}`
        );

        // render payouts
        Render.rows(
          consignorPayouts,
          consignorId,
          Payout.renderRowHeader,
          document.getElementById("payouts-results"),
          errorsDiv,
          "purple",
          (id) => `WARNING: no previous payouts for ${id}`
        );
      });
    })
    .catch(reportError);

});
