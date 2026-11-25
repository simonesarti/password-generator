/* Apply the saved theme before first paint to avoid a flash. */
(function () {
  // Suppress CSS transitions until the UI has rendered its initial state.
  document.documentElement.classList.add('preload');
  try {
    var t = localStorage.getItem('pwg:theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage unavailable: follow the system theme */ }
})();
