const utils = importUtils();

class Payout {
  constructor(date, consignor, amount, note) {
    this.date = date;
    this.consignor = consignor;
    this.amount = amount;
    this.note = note;
  }
}

class Sale {
  ConsignorIdRegex = /[0-9][0-9][0-9]/;
  constructor(date, time, quantity, gross, discount, net, note) {
    this.date = date;
    this.time = time;
    this.quantity = quantity;
    this.gross = parseFloat(gross.slice(1));
    this.discount = parseFloat(discount.slice(2));
    this.net = parseFloat(net.slice(1));

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
    discountCell.innerHTML = this.discount;
    const netCell = row.insertCell();
    netCell.innerHTML = this.net;
    const noteCell = row.insertCell();
    noteCell.innerHTML = this.note;
  }
}

document.addEventListener('DOMContentLoaded', function() {

  var consignorId = "";
  /** setup buttons **/
  const consignorIdInput = document.getElementById("consignor-id-input");
  consignorIdInput.addEventListener("input", (e) => {
    consignorId = e.target.value;
  });


  const spreadsheetId = "14O0EDOq9luZvaxUd69uyFBWFe0tQt5xxQEas2E_i0pc";
  const accessToken = utils.getAccessToken();
  if(accessToken === null || accessToken === undefined) {
    utils.createOAuthButton(utils.clientId, "initiate-oauth", "admin");
  } else {

    const consignorsPromise =
      utils.handleSpreadsheet(spreadsheetId, "consignors", utils.clientId, accessToken)
        .then((json) => {
          return new Map(json.valueRanges[0].values.slice(1));
        });


    const consignorOutsPromise =
      utils.handleSpreadsheet(spreadsheetId, "consignor-outs", utils.clientId, accessToken)
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
            return new Sale(e[0], e[1], e[5], e[9], e[10], e[11], e[16]);
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

    Promise.all([consignorsPromise, consignorOutsPromise, salesPromise])
      .then((results) => {
        const consignors = results[0];
        const consignorOuts = results[1];
        const sales = results[2];

        const button = document.getElementById("consignor-sales-button");
        button.addEventListener("click", (e) => {

          // clear previous content
          document.getElementById("results").innerHTML = '';

          // clear errors
          document.getElementById("errors").innerHTML = '';

          if(sales.has(consignorId)) {
            const resultsDiv = document.getElementById("results");
            const table = document.createElement("table");
            Sale.renderRowHeader(table);
            sales.get(consignorId).forEach((sale) => {
              sale.renderRow(table)
            });
            resultsDiv.appendChild(table);
          } else {
            const errors = document.getElementById("errors");
            errors.innerHTML = `<p style="color: red;">ERROR: unknown consignor id: ${consignorId}</p>`;
          }
        });
      });
  }


});
