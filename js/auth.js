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
    return;
  }

  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
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

  sb.auth.getSession().then(function (res) {
    updateUI(res.data.session ? res.data.session.user : null);
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
