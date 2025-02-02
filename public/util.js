function importUtils() {
  return {
    /*
     * @param {Number} GoogleDateValue - Days passed since dec 30 1899, time in fraction
     * @returns {Date object} - javascript date object
     *
     */
    "ValueToDate": function(GoogleDateValue) {
      return new Date(new Date(1899,11,30+Math.floor(GoogleDateValue),0,0,0,0).getTime()+(GoogleDateValue%1)*86400000) ;
    },

    /**
     * @param {Date object} - javascript date object{Number} 
     * @returns {Number} GoogleDateValue - Days passed since dec 30 1899, time in fraction
     *
     */
    "DateToValue": function(date) {
      return 25569 + (date.getTime()-date.getTimezoneOffset()*60000)/86400000 ;
    },

    "readStreamToString": async function(stream) {
      const reader = stream.getReader();
      let result = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
      }

      return result;
    },

    // ranges=Transactions, Sheet1
    "handleSpreadsheet": function(spreadsheetId, ranges, clientId, accessToken) {
      const requestUri =
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?` +
        'ranges=' + ranges +
        '&valueRenderOption=UNFORMATTED_VALUE' +
        '&access_token=' + accessToken;

      const request = new Request(requestUri, {
        "method": "GET"
      });

      const promise =
        window.fetch(request)
        .then((response) => response.body)
        .then((body) => this.readStreamToString(body))
        .then((body) => JSON.parse(body));

      return(promise);
    },

    "oauthURI": function(clientId, redirectLocation) {
      const clientIdEncoded = encodeURIComponent(clientId);
      const redirectUri = encodeURIComponent(`${window.location.origin}/${redirectLocation}`);
      const scope = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly');
      const oAuthUri = "https://accounts.google.com/o/oauth2/v2/auth?" + `client_id=${clientIdEncoded}` + `&redirect_uri=${redirectUri}` + `&scope=${scope}` + "&response_type=token";

      return oAuthUri;
    },

    "getAccessToken": function() {
      const parsedHash = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = parsedHash.get("access_token");
      return accessToken;
    },

    "createOAuthButton": function(clientId, elementId, redirectLocation) {
      const initiateOAuthDiv = document.getElementById(elementId);
      const button = document.createElement("button");
      button.innerText = "Initiate OAuth";
      button.addEventListener("click", () => {
        window.location.href = this.oauthURI(clientId, redirectLocation);
      });
      initiateOAuthDiv.appendChild(button);
    },
    "clientId": "854834269816-846dbhdislm8v1f7t4479kkligliu33g.apps.googleusercontent.com",

    "htmlToNodes": function(html) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content.childNodes.item(0);
    }
  };

}
