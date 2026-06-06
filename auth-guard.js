/**
 * auth-guard.js — Doxnote Auth Guard
 * 
 * Add this as the FIRST <script> tag on ANY page you want to protect:
 * 
 *   <script src="auth-guard.js"></script>
 * 
 * That's it. If the user isn't logged in they get redirected to login.html.
 * If they ARE logged in, the page loads normally.
 * 
 * To log out from any page:
 *   DoxnoteAuth.logout();
 */

(function() {
  var SESSION_KEY = 'doxnote_session';

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (Date.now() > s.expires) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch(e) { return null; }
  }

  var session = getSession();

  if (!session) {
    // Not logged in → redirect to login, preserving current page as ?next=
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    var query = window.location.search;
    window.location.replace('login.html?next=' + encodeURIComponent(currentPath + query));
    // Stop page from rendering
    document.documentElement.style.display = 'none';
    throw new Error('Not authenticated');
  }

  // Expose helper globally
  window.DoxnoteAuth = {
    session: session,
    username: session.username,
    logout: function(redirectTo) {
      localStorage.removeItem(SESSION_KEY);
      window.location.replace('login.html' + (redirectTo ? '?next=' + encodeURIComponent(redirectTo) : ''));
    }
  };
})();
