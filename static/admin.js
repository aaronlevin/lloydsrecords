document.addEventListener('DOMContentLoaded', function() {

  /**
   * @param {Number} GoogleDateValue - Days passed since dec 30 1899, time in fraction
   * @returns {Date object} - javascript date object
   *
   */
  function ValueToDate(GoogleDateValue) {
    return new Date(new Date(1899,11,30+Math.floor(GoogleDateValue),0,0,0,0).getTime()+(GoogleDateValue%1)*86400000) ;
  }

  /**
   * @param {Date object} - javascript date object{Number} 
   * @returns {Number} GoogleDateValue - Days passed since dec 30 1899, time in fraction
   *
   */

  function DateToValue(date) {
    return 25569 + (date.getTime()-date.getTimezoneOffset()*60000)/86400000 ;
  }

  const clientId = "854834269816-846dbhdislm8v1f7t4479kkligliu33g.apps.googleusercontent.com";
  const clientIdEncoded = encodeURIComponent(clientId);
  const redirectUri = encodeURIComponent(`${window.location.origin}/admin`);
  const scope = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly');
  const oAuthUri = "https://accounts.google.com/o/oauth2/v2/auth?" + `client_id=${clientIdEncoded}` + `&redirect_uri=${redirectUri}` + `&scope=${scope}` + "&response_type=token";

  const parsedHash = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = parsedHash.get("access_token");
  if (accessToken === null || accessToken === undefined) {
    const initiateOAuthDiv = document.getElementById('initiate-oauth');
    console.log(`div = ${initiateOAuthDiv}`);
    const button = document.createElement("button");
    button.innerText = "Initiate OAuth";
    button.addEventListener("click", () => {
      window.location.href = oAuthUri;
    });
    initiateOAuthDiv.appendChild(button);
 } else {
   console.log(`access_token = ${accessToken}`);

   const spreadsheetId = '1QqJPRSB-RnfRlFm3oNRrc9g9_lue_02jH6dworn7mdE';

   var xhr = new XMLHttpRequest();
   const requestUri =
     `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?` +
     'ranges=' + "Transactions" + // encodeURIComponent('Transactions!A1:B3') +
     //'https://www.googleapis.com/drive/v3/about?fields=user&' +
     '&valueRenderOption=UNFORMATTED_VALUE' + 
     '&access_token=' + accessToken;
   console.log(`request url\n${requestUri}`);
   xhr.open('GET', requestUri);
   xhr.onreadystatechange = function (e) {
     console.log(xhr.response);
   };
   xhr.send(null);
 }


});
