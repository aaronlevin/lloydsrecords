// Unit tests for the payout logic in static/admin.js.
// Run with: node tests/admin.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const staticDir = path.join(__dirname, '..', 'static');
const src = fs.readFileSync(path.join(staticDir, 'util.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(staticDir, 'admin.js'), 'utf8');

// admin.js expects a browser; stub just enough to load it
const ctx = {
  document: { addEventListener() {} },
  window: {},
  Intl, console, Number, Math, Date, Map, String, RegExp, JSON, parseFloat, Error, Promise,
};
vm.createContext(ctx);
vm.runInContext(src + '\n;__exports = { parseMoney, normalizeId, timeToFraction, ConsignorRate, CardSale, CashSale, Payout, groupByConsignor };', ctx);
const { parseMoney, normalizeId, timeToFraction, ConsignorRate, CardSale, CashSale, Payout, groupByConsignor } = ctx.__exports;

let failures = 0;
function eq(label, actual, expected) {
  const pass = (typeof expected === 'number' && typeof actual === 'number')
    ? (Number.isNaN(expected) ? Number.isNaN(actual) : Math.abs(actual - expected) < 1e-9)
    : actual === expected;
  if (!pass) { failures++; console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${label} = ${JSON.stringify(actual)}`);
}

// parseMoney: Square strings, refunds, comma amounts, raw numbers, blanks
eq('parseMoney("$23.00")', parseMoney("$23.00"), 23);
eq('parseMoney("-$2.30")', parseMoney("-$2.30"), -2.3);
eq('parseMoney("$1,234.00")', parseMoney("$1,234.00"), 1234);
eq('parseMoney("$0.00")', parseMoney("$0.00"), 0);
eq('parseMoney(140)', parseMoney(140), 140);
eq('parseMoney("")', parseMoney(""), 0);
eq('parseMoney(undefined)', parseMoney(undefined), 0);

// normalizeId: canonical 3-digit strings regardless of cell formatting
eq('normalizeId("086")', normalizeId("086"), "086");
eq('normalizeId(86)', normalizeId(86), "086");
eq('normalizeId(420)', normalizeId(420), "420");
eq('normalizeId("???")', normalizeId("???"), "???");
eq('normalizeId(" 001 ")', normalizeId(" 001 "), "001");

// timeToFraction: serial fractions and HH:MM:SS strings
eq('timeToFraction("12:00:00")', timeToFraction("12:00:00"), 0.5);
eq('timeToFraction(0.25)', timeToFraction(0.25), 0.25);
eq('timeToFraction("junk")', timeToFraction("junk"), 0);

// ConsignorRate tiers — boundaries 20 / 150 / 400, no gaps or overlaps
eq('rate($10)', ConsignorRate.amount(10), 5);
eq('rate($19)', ConsignorRate.amount(19), 9.5);
eq('rate($19.50)', ConsignorRate.amount(19.5), 9.75);
eq('rate($20)', ConsignorRate.amount(20), 14);
eq('rate($149)', ConsignorRate.amount(149), 104.3);
eq('rate($150)', ConsignorRate.amount(150), 120);
eq('rate($155)', ConsignorRate.amount(155), 124);
eq('rate($399)', ConsignorRate.amount(399), 319.2);
eq('rate($400)', ConsignorRate.amount(400), 360);

// CardSale note parsing: id must be exactly 3 digits + whitespace (or nothing)
const mk = (note) => new CardSale(45678, "19:52:57", 1, "$23.00", "-$2.30", "$20.70", note);
eq('note "123 cool" id', mk("123 cool").consignor, "123");
eq('note "123 cool" note', mk("123 cool").note, "cool");
eq('note "123" bare id', mk("123").consignor, "123");
eq('note "123" bare note is ""', mk("123").note, "");
eq('note "123  two spaces" note', mk("123  double space").note, "double space");
eq('note "1234 bowie" -> ???', mk("1234 bowie").consignor, "???");
eq('note "123abc" -> ???', mk("123abc").consignor, "???");
eq('note "555-1234 call" -> ???', mk("555-1234 call").consignor, "???");
eq('note "123: cool" -> ??? (strict: space required)', mk("123: cool").consignor, "???");
eq('note "" -> ???', mk("").consignor, "???");
eq('note undefined -> ??? (no crash)', mk(undefined).consignor, "???");
eq('note "bob s" -> ???', mk("bob s").consignor, "???");

// CardSale money + refund behavior
const sale = mk("123 cool");
eq('gross parsed', sale.gross, 23);
eq('discount keeps sign', sale.discount, -2.3);
eq('net parsed', sale.net, 20.7);
eq('owed = 70% of 20.70', sale.owed, 20.7 * 0.7);
const refund = new CardSale(45678, "10:00:00", 1, "-$10.00", "$0.00", "-$10.00", "123 refund");
eq('refund net = -10 (not NaN)', refund.net, -10);
eq('refund owed = -5 (not NaN)', refund.owed, -5);
const big = new CardSale(45678, "10:00:00", 1, "$1,234.00", "$0.00", "$1,234.00", "123 rare");
eq('big sale net 1234 (not 1)', big.net, 1234);
eq('sortKey = date + time fraction', sale.sortKey, 45678 + timeToFraction("19:52:57"));

// CashSale / Payout normalization + rows with truncated trailing columns
const cash = new CashSale(45678, 140, 420, "multiple", undefined);
eq('cash consignor normalized', cash.consignor, "420");
eq('cash owed 70% of 140', cash.owed, 98);
const cashNum = new CashSale(45678, "15", 1, "diva tape", undefined);
eq('cash numeric id 1 -> "001"', cashNum.consignor, "001");
const payout = new Payout(45678, "086", "55");
eq('payout amount parsed', payout.amount, 55);
eq('payout consignor', payout.consignor, "086");
eq('payout missing note ok', payout.note, undefined);

// grouping
const map = groupByConsignor([cash, cashNum, new CashSale(45678, 10, "001", "x", null)]);
eq('group sizes', map.get("001").length, 2);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
