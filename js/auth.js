(function () {
  "use strict";

  var listeners = [];
  window.onAuthChange = function (cb) {
    listeners.push(cb);
  };
  window.getCurrentUser = function () {
    return Promise.resolve(null);
  };

  if (!window.supabase) {
    console.error("Supabase JS failed to load; sign-in and venue/comment features are disabled.");
    window.authReady = Promise.resolve(null);
    return;
  }

  // A plain page reload can let the browser serve a cached response for the
  // venues/comments GET requests, so newly-added rows seem missing until a
  // hard refresh bypasses that cache. Force every request from this client
  // to skip the HTTP cache and always hit the network.
  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    global: {
      fetch: function (url, options) {
        return fetch(url, Object.assign({}, options, { cache: "no-store" }));
      }
    }
  });
  window.sb = sb;

  // Supabase auth still needs an email-shaped identifier under the hood.
  // People type a plain username; we append this fixed fake domain for them.
  var USERNAME_DOMAIN = "@baku-resources.local";

  function toEmail(usernameOrEmail) {
    return usernameOrEmail.indexOf("@") === -1
      ? usernameOrEmail + USERNAME_DOMAIN
      : usernameOrEmail;
  }

  var signedOutView = document.getElementById("auth-signed-out");
  var signedInView = document.getElementById("auth-signed-in");
  var emailInput = document.getElementById("auth-email");
  var passwordInput = document.getElementById("auth-password");
  var sendLinkBtn = document.getElementById("auth-send-link");
  var authStatus = document.getElementById("auth-status");
  var userEmailEl = document.getElementById("auth-user-email");
  var signOutBtn = document.getElementById("auth-sign-out");

  window.getCurrentUser = function () {
    return sb.auth.getUser().then(function (res) {
      return res.data.user || null;
    });
  };

  function updateUI(user) {
    signedOutView.hidden = !!user;
    signedInView.hidden = !user;
    if (user) userEmailEl.textContent = "Signed in as " + user.email.split("@")[0];
    listeners.forEach(function (cb) {
      cb(user);
    });
  }

  sb.auth.onAuthStateChange(function (_event, session) {
    updateUI(session ? session.user : null);
  });

  // app.js awaits this before its first render, so the initial render already
  // knows whether a user is signed in instead of flashing CSV-only pins and
  // then re-rendering a moment later once the session check comes back.
  window.authReady = sb.auth.getSession().then(function (res) {
    var user = res.data.session ? res.data.session.user : null;
    updateUI(user);
    return user;
  });

  function signIn() {
    var username = emailInput.value.trim();
    var password = passwordInput.value;
    if (!username || !password) return;
    sendLinkBtn.disabled = true;
    authStatus.textContent = "Signing in…";
    sb.auth
      .signInWithPassword({ email: toEmail(username), password: password })
      .then(function (res) {
        authStatus.textContent = res.error ? "Error: " + res.error.message : "";
        if (!res.error) passwordInput.value = "";
      })
      .finally(function () {
        sendLinkBtn.disabled = false;
      });
  }

  sendLinkBtn.addEventListener("click", signIn);
  passwordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") signIn();
  });

  signOutBtn.addEventListener("click", function () {
    sb.auth.signOut();
  });
})();
