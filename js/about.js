(function () {
  "use strict";

  var btn = document.getElementById("about-btn");
  var overlay = document.getElementById("about-overlay");
  var closeBtn = document.getElementById("about-close");
  var content = document.getElementById("about-content");

  var loaded = false;

  function open() {
    overlay.hidden = false;
    if (loaded) return;
    content.textContent = "Loading…";
    fetch("data/about.md")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data/about.md");
        return res.text();
      })
      .then(function (text) {
        content.innerHTML = window.marked.parse(text);
        loaded = true;
      })
      .catch(function (err) {
        console.error("about.md", err);
        content.textContent = "Could not load the about text.";
      });
  }

  function close() {
    overlay.hidden = true;
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) close();
  });
})();
