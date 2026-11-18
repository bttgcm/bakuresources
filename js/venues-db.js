(function () {
  "use strict";

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function csvVenueRef(categoryId, name) {
    return "csv:" + categoryId + ":" + slugify(name);
  }

  function dbVenueRef(id) {
    return "db:" + id;
  }

  function fetchDbVenues(categoryId) {
    return window.sb
      .from("venues")
      .select("*")
      .eq("category_id", categoryId)
      .then(function (res) {
        if (res.error) {
          console.error("fetchDbVenues", res.error);
          return [];
        }
        return (res.data || []).map(function (row) {
          return {
            name: row.name,
            lat: row.lat,
            lon: row.lon,
            description: row.description,
            address: row.address,
            url: row.url,
            venueRef: dbVenueRef(row.id),
            source: "db"
          };
        });
      });
  }

  function addVenue(categoryId, data) {
    return window.getCurrentUser().then(function (user) {
      if (!user) return Promise.reject(new Error("Not signed in"));
      return window.sb
        .from("venues")
        .insert({
          category_id: categoryId,
          name: data.name,
          lat: data.lat,
          lon: data.lon,
          description: data.description || null,
          address: data.address || null,
          url: data.url || null,
          created_by: user.id,
          created_by_email: user.email
        })
        .select()
        .single();
    });
  }

  function fetchComments(venueRef) {
    return window.sb
      .from("comments")
      .select("*")
      .eq("venue_ref", venueRef)
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) {
          console.error("fetchComments", res.error);
          return [];
        }
        return res.data || [];
      });
  }

  function addComment(venueRef, body) {
    return window.getCurrentUser().then(function (user) {
      if (!user) return Promise.reject(new Error("Not signed in"));
      return window.sb
        .from("comments")
        .insert({
          venue_ref: venueRef,
          body: body,
          created_by: user.id,
          created_by_email: user.email
        })
        .select()
        .single();
    });
  }

  window.VenuesDB = {
    csvVenueRef: csvVenueRef,
    dbVenueRef: dbVenueRef,
    fetchDbVenues: fetchDbVenues,
    addVenue: addVenue,
    fetchComments: fetchComments,
    addComment: addComment
  };
})();
