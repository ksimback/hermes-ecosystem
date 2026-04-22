(function () {
  var forms = document.querySelectorAll("[data-email-form]");
  forms.forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit(form);
    });
  });

  function submit(form) {
    var input = form.querySelector('input[name="email"]');
    var button = form.querySelector("button");
    var status = form.parentElement.querySelector(".email-cta-status");
    var email = (input.value || "").trim();
    if (!email) return;

    button.disabled = true;
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = "sending…";
    status.removeAttribute("data-status");
    status.textContent = "";

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        referrer: document.referrer || "",
        page: window.location.pathname
      })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok) {
          status.setAttribute("data-status", "success");
          status.textContent = "check your inbox to confirm.";
          input.value = "";
        } else {
          status.setAttribute("data-status", "error");
          status.textContent = (r.data && r.data.error) || "something went wrong. try again?";
        }
      })
      .catch(function () {
        status.setAttribute("data-status", "error");
        status.textContent = "network error. try again?";
      })
      .then(function () {
        button.disabled = false;
        button.textContent = button.dataset.label;
      });
  }
})();
