(function () {
  "use strict";

  var BAKU_CENTER = [40.3777, 49.8920];
  var DEFAULT_ZOOM = 12;
  var MARKER_COLOR = "#ff3366"; // accent-title — curated (CSV) venues
  var DB_MARKER_COLOR = "#0066ff"; // accent-link — community-added venues
  var MARKER_RADIUS = 5;

  var map = L.map("map", { zoomControl: true }).setView(BAKU_CENTER, DEFAULT_ZOOM);

  L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/liberty",
    attribution: "&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap contributors"
  }).addTo(map);

  var markersLayer = L.layerGroup().addTo(map);
  var select = document.getElementById("category-select");
  var loadingEl = document.getElementById("loading");
  var venueListPanel = document.getElementById("venue-list-panel");
  var venueListToggle = document.getElementById("venue-list-toggle");
  var venueListSearch = document.getElementById("venue-list-search");
  var venueListEl = document.getElementById("venue-list");

  var categories = [];
  var csvCache = {}; // categoryId -> array of row objects
  var currentUser = null;
  var currentCategoryId = null;
  var currentListRows = []; // all rows (located + unlocated) in the current category
  var commentsByRef = {}; // venueRef -> array of comment rows, for the current category
  var markerByRef = {}; // venueRef -> Leaflet marker, for the current category

  // ---- add-venue UI state ----
  var addVenuePanel = document.getElementById("add-venue-panel");
  var addVenueBtn = document.getElementById("add-venue-btn");
  var addVenueClose = document.getElementById("add-venue-close");
  var addVenueQuery = document.getElementById("add-venue-query");
  var addVenueSearchBtn = document.getElementById("add-venue-search-btn");
  var addVenueResults = document.getElementById("add-venue-results");
  var addVenueLocation = document.getElementById("add-venue-location");
  var addVenueForm = document.getElementById("add-venue-form");
  var addVenueName = document.getElementById("add-venue-name");
  var addVenueCategory = document.getElementById("add-venue-category");
  var addVenueDescription = document.getElementById("add-venue-description");
  var addVenueAddress = document.getElementById("add-venue-address");
  var addVenueUrl = document.getElementById("add-venue-url");

  var addingVenue = false;
  var pendingMarker = null;

  function setLoading(isLoading) {
    loadingEl.hidden = !isLoading;
  }

  function populateCategoryOptions(selectEl) {
    categories.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.label;
      selectEl.appendChild(opt);
    });
  }

  function loadCategories() {
    return fetch("data/categories.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data/categories.json");
        return res.json();
      })
      .then(function (data) {
        categories = data;
        populateCategoryOptions(select);
        populateCategoryOptions(addVenueCategory);
      });
  }

  function loadCategoryData(cat) {
    if (csvCache[cat.id]) {
      return Promise.resolve(csvCache[cat.id]);
    }
    return new Promise(function (resolve, reject) {
      Papa.parse(cat.file, {
        download: true,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function (results) {
          var rows = (results.data || [])
            .filter(function (r) {
              return r.name;
            })
            .map(function (r) {
              r.venueRef = window.VenuesDB.csvVenueRef(cat.id, r.name);
              r.source = "csv";
              return r;
            });
          csvCache[cat.id] = rows;
          resolve(rows);
        },
        error: function (err) {
          reject(err);
        }
      });
    });
  }

  function hasCoords(row) {
    return (
      typeof row.lat === "number" &&
      typeof row.lon === "number" &&
      !isNaN(row.lat) &&
      !isNaN(row.lon)
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  // ---- popup content, with lazily-loaded comments ----

  function renderCommentList(listEl, comments) {
    listEl.innerHTML = "";
    if (!comments.length) {
      var empty = document.createElement("li");
      empty.className = "comment-muted";
      empty.textContent = "No comments yet.";
      listEl.appendChild(empty);
      return;
    }
    comments.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "comment-item";
      var who = document.createElement("span");
      who.className = "comment-author";
      who.textContent = c.created_by_email || "Someone";
      var body = document.createElement("div");
      body.textContent = c.body;
      li.appendChild(who);
      li.appendChild(body);
      listEl.appendChild(li);
    });
  }

  function buildPopupContent(row) {
    var container = document.createElement("div");
    container.className = "venue-popup";

    var html = "<b>" + escapeHtml(row.name || "Unnamed") + "</b>";
    if (row.description) html += "<br>" + escapeHtml(row.description);
    if (row.address) html += "<br><i>" + escapeHtml(row.address) + "</i>";
    if (row.url)
      html += '<br><a href="' + escapeAttr(row.url) + '" target="_blank" rel="noopener">Website</a>';
    if (row.maps_url)
      html +=
        '<br><a href="' + escapeAttr(row.maps_url) + '" target="_blank" rel="noopener">Open in Google Maps</a>';
    if (row.comment) html += '<div class="popup-comment">' + escapeHtml(row.comment) + "</div>";
    container.innerHTML = html;

    var section = document.createElement("div");
    section.className = "comments-section";
    section.innerHTML = '<div class="comments-heading">Comments</div><ul class="comment-list"></ul>';
    container.appendChild(section);

    var listEl = section.querySelector(".comment-list");
    var loadingLi = document.createElement("li");
    loadingLi.className = "comment-muted";
    loadingLi.textContent = "Loading…";
    listEl.appendChild(loadingLi);

    window.getCurrentUser().then(function (user) {
      if (!user) {
        listEl.innerHTML = "";
        var li = document.createElement("li");
        li.className = "comment-muted";
        li.textContent = "Sign in to see and add comments.";
        listEl.appendChild(li);
        return;
      }

      window.VenuesDB.fetchComments(row.venueRef).then(function (comments) {
        renderCommentList(listEl, comments);
      });

      var form = document.createElement("form");
      form.className = "comment-form";
      form.innerHTML =
        '<textarea placeholder="Add a comment…" required></textarea><button type="submit">Post</button>';
      section.appendChild(form);

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var textarea = form.querySelector("textarea");
        var body = textarea.value.trim();
        if (!body) return;
        var btn = form.querySelector("button");
        btn.disabled = true;
        window.VenuesDB.addComment(row.venueRef, body)
          .then(function () {
            textarea.value = "";
            return window.VenuesDB.fetchComments(row.venueRef);
          })
          .then(function (comments) {
            renderCommentList(listEl, comments);
          })
          .catch(function (err) {
            console.error("addComment", err);
            alert("Could not post comment. See console for details.");
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    });

    return container;
  }

  // ---- venue list panel (searchable listing for the current category) ----

  function rowMatchesQuery(row, query) {
    if (!query) return true;
    var userComments = (commentsByRef[row.venueRef] || [])
      .map(function (c) {
        return c.body;
      })
      .join(" ");
    var haystack = [row.name, row.description, row.comment, row.address, userComments]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function buildVenueListItem(row) {
    var li = document.createElement("li");
    var located = hasCoords(row);
    if (located) li.className = "venue-list-locatable";

    var html = '<span class="venue-list-name">' + escapeHtml(row.name || "Unnamed") + "</span>";
    if (row.description) html += "<br>" + escapeHtml(row.description);
    if (row.address) html += '<br><span class="venue-list-muted">' + escapeHtml(row.address) + "</span>";
    if (row.url)
      html += '<br><a href="' + escapeAttr(row.url) + '" target="_blank" rel="noopener">Website</a>';
    if (row.maps_url)
      html +=
        '<br><a href="' + escapeAttr(row.maps_url) + '" target="_blank" rel="noopener">Open in Google Maps</a>';
    if (row.comment) html += '<div class="popup-comment">' + escapeHtml(row.comment) + "</div>";

    var userComments = commentsByRef[row.venueRef];
    if (userComments && userComments.length) {
      html += '<div class="venue-list-comments">';
      userComments.forEach(function (c) {
        html +=
          '<div class="venue-list-comment"><span class="comment-author">' +
          escapeHtml(c.created_by_email || "Someone") +
          "</span>" +
          escapeHtml(c.body) +
          "</div>";
      });
      html += "</div>";
    }

    if (!located) html += '<br><span class="venue-list-muted">No exact map location</span>';
    li.innerHTML = html;

    if (located) {
      li.addEventListener("click", function (e) {
        if (e.target.tagName === "A") return;
        var marker = markerByRef[row.venueRef];
        if (!marker) return;
        map.setView(marker.getLatLng(), 16);
        marker.openPopup();
        venueListPanel.classList.remove("open");
      });
    }

    return li;
  }

  function applyVenueListFilter() {
    var query = venueListSearch.value.trim().toLowerCase();
    var filtered = currentListRows.filter(function (row) {
      return rowMatchesQuery(row, query);
    });

    venueListEl.innerHTML = "";
    if (!filtered.length) {
      var empty = document.createElement("li");
      empty.className = "venue-list-muted";
      empty.textContent = "No matches.";
      venueListEl.appendChild(empty);
      return;
    }
    filtered.forEach(function (row) {
      venueListEl.appendChild(buildVenueListItem(row));
    });
  }

  function renderVenueList(rows, cat) {
    currentListRows = rows;
    commentsByRef = {};
    venueListSearch.value = "";
    venueListToggle.textContent =
      "📋 " + rows.length + " " + cat.label.toLowerCase() + " — tap to search ▾";
    applyVenueListFilter();

    if (!currentUser || !rows.length) return;
    var refs = rows.map(function (row) {
      return row.venueRef;
    });
    window.VenuesDB.fetchCommentsForRefs(refs).then(function (byRef) {
      commentsByRef = byRef;
      applyVenueListFilter();
    });
  }

  function addMarkerFor(row, bounds) {
    var color = row.source === "db" ? DB_MARKER_COLOR : MARKER_COLOR;
    var marker = L.circleMarker([row.lat, row.lon], {
      radius: MARKER_RADIUS,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2
    });

    marker.bindPopup(function () {
      return buildPopupContent(row);
    });
    marker.addTo(markersLayer);
    bounds.push([row.lat, row.lon]);
    markerByRef[row.venueRef] = marker;
  }

  function renderCategory(catId) {
    var cat = categories.find(function (c) {
      return c.id === catId;
    });
    if (!cat) return;

    currentCategoryId = catId;
    setLoading(true);

    var dbVenuesPromise = currentUser
      ? window.VenuesDB.fetchDbVenues(cat.id)
      : Promise.resolve([]);

    Promise.all([loadCategoryData(cat), dbVenuesPromise])
      .then(function (results) {
        var csvRows = results[0];
        var dbRows = results[1];
        markersLayer.clearLayers();
        markerByRef = {};

        var located = csvRows.filter(hasCoords).concat(dbRows);
        var unlocated = csvRows.filter(function (r) {
          return !hasCoords(r);
        });

        var bounds = [];
        located.forEach(function (row) {
          addMarkerFor(row, bounds);
        });

        if (bounds.length) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }

        renderVenueList(located.concat(unlocated), cat);
        venueListPanel.classList.remove("open");
      })
      .catch(function (err) {
        console.error("Error loading category " + catId, err);
        alert("Could not load data for this category. See console for details.");
      })
      .finally(function () {
        setLoading(false);
      });
  }

  // ---- add-venue flow ----

  function exitAddingMode() {
    addingVenue = false;
    addVenuePanel.hidden = true;
    map.getContainer().style.cursor = "";
    if (pendingMarker) {
      map.removeLayer(pendingMarker);
      pendingMarker = null;
    }
    addVenueResults.innerHTML = "";
    addVenueQuery.value = "";
    addVenueLocation.textContent = "No location chosen yet.";
    addVenueForm.reset();
  }

  function placePendingMarker(latlng) {
    if (pendingMarker) {
      pendingMarker.setLatLng(latlng);
    } else {
      pendingMarker = L.marker(latlng, { draggable: true }).addTo(map);
      pendingMarker.on("dragend", function () {
        updateLocationText(pendingMarker.getLatLng());
      });
    }
    updateLocationText(latlng);
  }

  function updateLocationText(latlng) {
    addVenueLocation.textContent =
      "Pin at " + latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
  }

  if (addVenueBtn) {
    addVenueBtn.addEventListener("click", function () {
      addingVenue = true;
      addVenuePanel.hidden = false;
      if (currentCategoryId) addVenueCategory.value = currentCategoryId;
      map.getContainer().style.cursor = "crosshair";
    });
  }

  addVenueClose.addEventListener("click", exitAddingMode);

  map.on("click", function (e) {
    if (!addingVenue) return;
    placePendingMarker(e.latlng);
  });

  addVenueSearchBtn.addEventListener("click", function () {
    var query = addVenueQuery.value.trim();
    if (!query) return;
    addVenueSearchBtn.disabled = true;
    addVenueResults.innerHTML = "<li>Searching…</li>";
    window.Geocode.searchPlace(query)
      .then(function (results) {
        addVenueResults.innerHTML = "";
        if (!results.length) {
          addVenueResults.innerHTML = "<li>No matches found.</li>";
          return;
        }
        results.forEach(function (r) {
          var li = document.createElement("li");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = r.label;
          btn.addEventListener("click", function () {
            var latlng = L.latLng(r.lat, r.lon);
            map.setView(latlng, 16);
            placePendingMarker(latlng);
          });
          li.appendChild(btn);
          addVenueResults.appendChild(li);
        });
      })
      .catch(function (err) {
        console.error("searchPlace", err);
        addVenueResults.innerHTML = "<li>Search failed. Try again.</li>";
      })
      .finally(function () {
        addVenueSearchBtn.disabled = false;
      });
  });

  addVenueForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!pendingMarker) {
      alert("Pick a location first: click the map or search a name.");
      return;
    }
    var name = addVenueName.value.trim();
    var chosenCategoryId = addVenueCategory.value;
    if (!name || !chosenCategoryId) return;

    var latlng = pendingMarker.getLatLng();
    var data = {
      name: name,
      lat: latlng.lat,
      lon: latlng.lng,
      description: addVenueDescription.value.trim(),
      address: addVenueAddress.value.trim(),
      url: addVenueUrl.value.trim()
    };

    var saveBtn = document.getElementById("add-venue-save");
    saveBtn.disabled = true;
    window.VenuesDB.addVenue(chosenCategoryId, data)
      .then(function () {
        exitAddingMode();
        select.value = chosenCategoryId;
        renderCategory(chosenCategoryId);
      })
      .catch(function (err) {
        console.error("addVenue", err);
        alert("Could not save venue. See console for details.");
      })
      .finally(function () {
        saveBtn.disabled = false;
      });
  });

  // ---- wiring ----

  select.addEventListener("change", function () {
    renderCategory(select.value);
  });

  venueListToggle.addEventListener("click", function () {
    venueListPanel.classList.toggle("open");
  });

  venueListSearch.addEventListener("input", applyVenueListFilter);

  window.onAuthChange(function (user) {
    currentUser = user;
    if (!user) exitAddingMode();
    if (currentCategoryId) renderCategory(currentCategoryId);
  });

  loadCategories().then(function () {
    if (categories.length) {
      select.value = categories[0].id;
      renderCategory(categories[0].id);
    }
  });
})();
