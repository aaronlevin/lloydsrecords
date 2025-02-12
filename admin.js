const utils = importUtils();

class ConsignorRate {
  static amount(sale) {
    if(sale < 19) {
      return sale * 0.5;
    } else if(20 <= sale < 159) {
      return sale * 0.7;
    } else if(150 <= sale < 399) {
      return sale * 0.8;
    } else {
      return sale * 0.9;
    }
  }
}

class Payout {
  constructor(date, consignor, amount, note) {
    this.date = date;
    this.consignor = consignor;
    this.amount = amount;
    this.note = note;
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    const dateCell = headerRow.insertCell();
    dateCell.innerHTML = "date";
    const consignorCell = headerRow.insertCell();
    consignorCell.innerHTML = "consignor";
    const netCell = headerRow.insertCell();
    netCell.innerHTML = "amount";
    const noteCell = headerRow.insertCell();
    noteCell.innerHTML = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    const dateCell = row.insertCell();
    dateCell.innerHTML = utils.ValueToDate(this.date).toISOString().split('T')[0];
    const consignorCell = row.insertCell();
    consignorCell.innerHTML = this.consignor;
    const amountCell = row.insertCell();
    amountCell.innerHTML = this.amount;
    const noteCell = row.insertCell();
    noteCell.innerHTML = this.note;
  }
}

class CashSale {
  constructor(date, price, consignor, item, note) {
    this.date = date;
    this.price = price;
    this.consignor = consignor;
    this.item = item;
    this.note = note;
    this.owed = ConsignorRate.amount(this.price);
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    const dateCell = headerRow.insertCell();
    dateCell.innerHTML = "date";
    const consignorCell = headerRow.insertCell();
    consignorCell.innerHTML = "consignor";
    const netCell = headerRow.insertCell();
    netCell.innerHTML = "net";
    const owedCell = headerRow.insertCell();
    owedCell.innerHTML = "owed";
    const noteCell = headerRow.insertCell();
    noteCell.innerHTML = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    const dateCell = row.insertCell();
    dateCell.innerHTML = utils.ValueToDate(this.date).toISOString().split('T')[0];
    const consignorCell = row.insertCell();
    consignorCell.innerHTML = this.consignor;
    const netCell = row.insertCell();
    netCell.innerHTML = Render.float(this.price);
    const payoutCell = row.insertCell();
    payoutCell.innerHTML = Render.float(this.owed);
    const noteCell = row.insertCell();
    if(this.note === undefined || this.note === null) {
      noteCell.innerHTML = `${this.item}`;
    } else {
      noteCell.innerHTML = `${this.item} (${this.note})`;
    }
  }

}

class CardSale {
  ConsignorIdRegex = /[0-9][0-9][0-9]/;
  constructor(date, time, quantity, gross, discount, net, note) {
    this.date = date;
    this.time = time;
    this.quantity = quantity;
    this.gross = parseFloat(gross.slice(1));
    this.discount = parseFloat(discount.slice(2));
    this.net = parseFloat(net.slice(1));
    this.owed = ConsignorRate.amount(this.net);

    const consignor = note.substring(0,3);
    if(this.ConsignorIdRegex.test(consignor)) {
      this.consignor = consignor;
      this.note = note.slice(4);
    } else {
      this.consignor = "???";
      this.note = note;
    }
  }

  static renderRowHeader(table) {
    const headerRow = table.insertRow();
    const dateCell = headerRow.insertCell();
    dateCell.innerHTML = "date";
    const consignorCell = headerRow.insertCell();
    consignorCell.innerHTML = "consignor";
    const quantityCell = headerRow.insertCell();
    quantityCell.innerHTML = "quantity";
    const discountCell = headerRow.insertCell();
    discountCell.innerHTML = "discount";
    const netCell = headerRow.insertCell();
    netCell.innerHTML = "net";
    const owedCell = headerRow.insertCell();
    owedCell.innerHTML = "owed";
    const noteCell = headerRow.insertCell();
    noteCell.innerHTML = "note";
  }

  renderRow(table) {
    const row = table.insertRow();
    const dateCell = row.insertCell();
    dateCell.innerHTML = utils.ValueToDate(this.date).toISOString().split('T')[0];
    const consignorCell = row.insertCell();
    consignorCell.innerHTML = this.consignor;
    const quantityCell = row.insertCell();
    quantityCell.innerHTML = this.quantity;
    const discountCell = row.insertCell();
    discountCell.innerHTML = Render.float(this.discount);
    const netCell = row.insertCell();
    netCell.innerHTML = Render.float(this.net);
    const payoutCell = row.insertCell();
    payoutCell.innerHTML = Render.float(this.owed);
    const noteCell = row.insertCell();
    noteCell.innerHTML = this.note;
  }
}

class Consignor {
  constructor(id, name, email) {
    this.id = id;
    this.name = name;
    this.email = email;
  }
}

class Render {

  static float(number) {
    const rounded = Math.round(number * 100) / 100; // Round to 2 decimal places
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  }

  /**
   *  presumes the type of sales has a `renderRow(table)` function
  */
  static rows(sales, consignorId, rowHeaderFn, resultsDiv, errorsDiv, errorColor, errorMessageFn) {
    // clear previous content
    resultsDiv.innerHTML = '';

    // clear errors
    errorsDiv.innerHTML = '';

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
      errorsDiv.appendChild(utils.htmlToNodes(`<p style="color: ${errorColor};">${errorMessageFn(consignorId)}</p>`));

    }
  }

}

class Summary {
  constructor(consignorId, cardSalesMap, cashSalesMap, payoutsMap) {
    var totalSales = 0;
    this.totalPayout = 0;
    this.cardSalesNet = 0;
    this.cashSalesNet = 0;
    if(cardSalesMap.has(consignorId)) {
      const net = cardSalesMap.get(consignorId).reduce((sum, sale) => sum + sale.net, 0);
      const owed = cardSalesMap.get(consignorId).reduce((sum, sale) => sum + sale.owed, 0);
      this.cardSalesNet += net;
      this.totalPayout += owed;
      totalSales += net;
    }

    if(cashSalesMap.has(consignorId)) {
      const net = cashSalesMap.get(consignorId).reduce((sum, sale) => sum + sale.price, 0);
      const owed = cashSalesMap.get(consignorId).reduce((sum, sale) => sum + sale.owed, 0);
      this.cashSalesNet += net;
      this.totalPayout += owed;
      totalSales += net;
    }

    if(payoutsMap.has(consignorId)) {
      const net = payoutsMap.get(consignorId).reduce((sum, out) => sum + out.amount, 0);
      this.payoutsNet = net;
    } else {
      this.payoutsNet = 0;
    }
    this.totalSales = totalSales;
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
    cardSalesLi.innerHTML = `card sales: ${Summary.format(this.cardSalesNet)}`;
    ul.appendChild(cardSalesLi);

    const cashSalesLi = document.createElement("li");
    cashSalesLi.innerHTML = `ca$h sales: ${Summary.format(this.cashSalesNet)}`;
    ul.appendChild(cashSalesLi);

    const totalSalesLi = document.createElement("li");
    totalSalesLi.innerHTML = `<strong>total sales</strong>: ${Summary.format(this.totalSales)}`;
    ul.appendChild(totalSalesLi);

    const totalOwedLi = document.createElement("li");
    totalOwedLi.innerHTML = `consignor's cut: ${Summary.format(this.totalPayout)}`;
    ul.appendChild(totalOwedLi);

    const totalPayoutsLi = document.createElement("li");
    totalPayoutsLi.innerHTML = `payouts to date: ${Summary.format(this.payoutsNet)}`;
    ul.appendChild(totalPayoutsLi);

    const totalPaymentLi = document.createElement("li");
    totalPaymentLi.innerHTML = `<strong>amount owed</strong> (total sales - payouts to date): ${Summary.format(this.calculatePayout())}`;
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
  } else {

    // add consignors selections
    const selectElem = document.getElementById("consignor-select");
    selectElem.addEventListener("change", (event) => {
      consignorId = event.target.value;
    });
    utils.handleSpreadsheet(spreadsheetId, "consignors", utils.clientId, accessToken)
      .then((json) => {
        json.valueRanges[0].values.slice(1).forEach((v) => {
          const consignor = new Consignor(...v);
          const option = document.createElement("option");
          option.value = consignor.id;
          option.innerHTML = `${consignor.id}: ${consignor.name}`;
          selectElem.appendChild(option);
        });
      });

    const consignorsPromise =
      utils.handleSpreadsheet(spreadsheetId, "consignors", utils.clientId, accessToken)
        .then((json) => {
          return new Map(json.valueRanges[0].values.slice(1));
        });


    const consignorPayoutsPromise =
      utils.handleSpreadsheet(spreadsheetId, "consignor-payouts", utils.clientId, accessToken)
        .then((json) => {
          const outs = json.valueRanges[0].values.slice(1).map((e) => new Payout(...e));
          return outs.reduce((map, obj) => {
            if(map.has(obj.consignor)) {
              map.get(obj.consignor).push(obj);
            } else {
              map.set(obj.consignor, [obj]);
            }
            return map;
          }, new Map());

        });

    const salesPromise =
      utils.handleSpreadsheet(spreadsheetId, "sales", utils.clientId, accessToken)
        .then((json) => {
          const sales = json.valueRanges[0].values.slice(1).map((e) => {
            return new CardSale(e[0], e[1], e[5], e[9], e[10], e[11], e[16]);
          });
          return sales.reduce((map, obj) => {
            if(map.has(obj.consignor)) {
              map.get(obj.consignor).push(obj);
            } else {
              map.set(obj.consignor, [obj]);
            }
            return map
          }, new Map());
        });

    const cashSalesPromise =
      utils.handleSpreadsheet(spreadsheetId, "tracker", utils.clientId, accessToken)
        .then((json) => {
          const sales = json.valueRanges[0].values.slice(1).map((e) => {
            return new CashSale(...e);
          });
          return sales.reduce((map, obj) => {
            if(map.has(obj.consignor)) {
              map.get(obj.consignor).push(obj);
            } else {
              map.set(obj.consignor, [obj]);
            }
            return map
          }, new Map());
        });

    Promise.all([consignorsPromise, consignorPayoutsPromise, salesPromise, cashSalesPromise])
      .then((results) => {
        const consignors = results[0];
        const consignorPayouts = results[1];
        const cardSales = results[2];
        const cashSales = results[3];

        const button = document.getElementById("consignor-sales-button");
        button.addEventListener("click", (e) => {

          // clear errors
          document.getElementById("errors").innerHTML = '';

          // divs to render results
          const errors = document.getElementById("errors");

          // render summary
          const summary = new Summary(consignorId, cardSales, cashSales, consignorPayouts);
          summary.render(document.getElementById("summary-results"));

          // render sales
          Render.rows(
            cardSales,
            consignorId,
            CardSale.renderRowHeader,
            document.getElementById("card-sales-results"),
            errors,
            "red",
            (id) => `ERROR: no card sales for ${id}`
          );

          // render cash sales
          Render.rows(
            cashSales,
            consignorId,
            CashSale.renderRowHeader,
            document.getElementById("cash-sales-results"),
            errors,
            "purple",
            (id) => `WARNING: no cash sales for ${id}`
          );

          // render payouts
          Render.rows(
            consignorPayouts,
            consignorId,
            Payout.renderRowHeader,
            document.getElementById("payouts-results"),
            errors,
            "purple",
            (id) => `WARNING: no previous payouts for ${id}`
          );
        });
      });
  }

});
