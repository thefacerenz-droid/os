(() => {
  let panel;
  let busy = false;
  let interval;
  async function api(action, data) {
    const response = await fetch(`/api/billing/${action}`, {
      method: data ? "POST" : "GET", credentials: "same-origin",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to check access.");
    return result;
  }
  function unlock() {
    window.velBillingActive = true;
    panel?.remove();
    panel = null;
    document.body.classList.remove("vel-payment-locked");
    completeCleverEntryGate();
    const url = new URL(location.href);
    url.searchParams.delete("payment");
    history.replaceState(null, "", url);
    clearInterval(interval);
    interval = setInterval(async () => {
      try { if (!(await api("status")).active) { window.velBillingActive = false; window.openVelPaywall(); } } catch { /* Retry on the next check after a connection loss. */ }
    }, 60000);
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    panel.querySelectorAll("button").forEach(b => b.disabled = true);
    const status = panel.querySelector("[role=status]");
    status.textContent = "One moment...";
    try { await task(); } catch (error) { status.textContent = error.message; }
    finally { busy = false; panel?.querySelectorAll("button").forEach(b => b.disabled = false); }
  }
  window.openVelPaywall = () => {
    if (panel) return;
    document.body.classList.add("vel-payment-locked");
    panel = document.createElement("section");
    panel.className = "vel-paywall";
    panel.setAttribute("aria-label", "Access passes");
    panel.innerHTML = `<div class="vel-paywall-inner"><a class="vel-paywall-brand" href="/">vel.os</a>
      <p class="vel-paywall-eyebrow">YOUR NEXT SESSION STARTS HERE</p><h1>Choose your access.</h1>
      <p class="vel-paywall-subtitle">One payment. Your time. No automatic renewal.</p>
      <div class="vel-paywall-plans"><article><h2>7 days</h2><p class="vel-paywall-price">$1 <span>USD</span></p><p>A week of access.</p><button data-plan="week">Get 7 days</button></article>
      <article><h2>1 month</h2><p class="vel-paywall-price">$5 <span>USD</span></p><p>A calendar month of access.</p><button data-plan="month">Get 1 month</button></article></div>
      <p class="vel-paywall-note">Secure checkout with Stripe. Available payment options appear at checkout.</p>
      <form class="vel-paywall-key"><label for="vel-private-key">Have a private key?</label><div><input id="vel-private-key" type="password" autocomplete="off" required maxlength="256" placeholder="Private key"><button type="submit">Unlock</button></div></form>
      <button class="vel-paywall-check" type="button">Already paid? Check access</button><p role="status" aria-live="polite"></p></div>`;
    document.body.append(panel);
    panel.querySelectorAll("[data-plan]").forEach(button => button.addEventListener("click", () => run(async () => {
      const result = await api("checkout", { plan: button.dataset.plan });
      location.assign(result.url);
    })));
    panel.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      run(async () => { await api("key", { key: panel.querySelector("input").value }); unlock(); });
    });
    const check = async () => {
      const status = await api("status");
      if (status.active) return unlock();
      if (status.pending) { await api("verify", {}); return unlock(); }
      panel.querySelector("[role=status]").textContent = status.paymentsReady ? "Choose a pass or enter your private key." : "Payments are not configured yet. Private-key access is available once configured.";
    };
    panel.querySelector(".vel-paywall-check").addEventListener("click", () => run(check));
    run(check);
  };
  document.addEventListener("DOMContentLoaded", () => {
    if (new URL(location.href).searchParams.has("payment")) window.openVelPaywall();
  });
})();
