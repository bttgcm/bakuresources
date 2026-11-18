(function () {
  "use strict";

  // Loose bounding box around greater Baku/Absheron, used only to bias results.
  var BAKU_VIEWBOX = "49.50,40.60,50.30,40.10"; // left,top,right,bottom

  function searchPlace(query) {
    var url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=5&viewbox=" +
      BAKU_VIEWBOX +
      "&q=" +
      encodeURIComponent(query);

    return fetch(url, { headers: { "Accept-Language": "en" } })
      .then(function (res) {
        return res.json();
      })
      .then(function (results) {
        return (results || []).map(function (r) {
          return { label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
        });
      });
  }

  window.Geocode = { searchPlace: searchPlace };
})();
