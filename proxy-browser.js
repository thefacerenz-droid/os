(() => {
  let controller;
  let generation = 0;
  async function api(data, signal) {
    const response = await fetch('/api/proxy', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
    let result;
    try { result = JSON.parse(await response.text()); }
    catch { throw new Error(`The proxy server returned an invalid response (HTTP ${response.status}). Check the Vercel deployment logs and rebuild with the updated dependencies.`); }
    if (!response.ok) throw new Error(result.message || 'The proxy request failed.');
    return result;
  }
  window.cancelVelProxyPage = () => { generation++; controller?.abort(); };
  window.loadVelProxyPage = async url => {
    window.cancelVelProxyPage();
    const request = generation;
    controller = new AbortController();
    setWebBrowserStatus('Loading through your proxy...');
    try {
      const result = await api({ action: 'browse', url }, controller.signal);
      if (request !== generation) return;
      webFrame.srcdoc = result.html;
      syncLoadedWebBrowserUrl(result.url);
      setWebBrowserStatus('Loaded through your proxy. Read-only view.');
    } catch (error) {
      if (request !== generation || error.name === 'AbortError') return;
      webFrame.srcdoc = `<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#111518;color:#e7edf1;font:16px/1.6 system-ui;padding:24px"><h2>Unable to load this page</h2><p>${escapeHtml(error.message)}</p></body>`;
      setWebBrowserStatus(error.message, 'error');
    }
  };
  const dialog = document.createElement('dialog');
  dialog.className = 'proxy-settings';
  dialog.setAttribute('aria-labelledby', 'proxySettingsTitle');
  dialog.innerHTML = `<form id="proxyConnectionForm"><header><h2 id="proxySettingsTitle">Proxy connection</h2><button type="button" class="proxy-close" aria-label="Close proxy settings" title="Close">&#215;</button></header>
    <div class="proxy-fields"><label>Connection<select name="protocol"><option value="https">HTTPS</option><option value="http">HTTP</option></select></label><label>Port<input name="port" type="number" min="1" max="65535" value="8080" required></label>
    <label class="proxy-wide">Host<input name="host" placeholder="proxy.example.com" autocomplete="off" spellcheck="false" required maxlength="253"></label>
    <label>Username<input name="username" autocomplete="off" maxlength="256"></label><label>Password<input name="password" type="password" autocomplete="off" maxlength="1024"></label></div>
    <p class="proxy-help">Connection test uses example.com. Credentials expire after one hour. HTTP proxy connections do not encrypt the connection to the proxy.</p>
    <p role="status" aria-live="polite">No proxy connected.</p><footer><button type="button" id="proxyDisconnect">Disconnect</button><button type="submit">Test &amp; connect</button></footer></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[role=status]');
  const submit = form.querySelector('[type=submit]');
  const disconnect = dialog.querySelector('#proxyDisconnect');
  let busy = false;
  async function run(task) {
    if (busy) return;
    busy = true; submit.disabled = true; disconnect.disabled = true;
    try { await task(); } catch (error) { status.textContent = error.message; }
    finally { busy = false; submit.disabled = false; disconnect.disabled = false; }
  }
  document.getElementById('proxySettingsOpen')?.addEventListener('click', () => {
    dialog.showModal();
    run(async () => {
      const result = await api({ action: 'status' });
      status.textContent = result.connected ? `Connected: ${result.protocol}://${result.host}:${result.port}` : 'No proxy connected.';
      if (result.connected) for (const field of ['host', 'port', 'protocol']) form.elements[field].value = result[field];
    });
  });
  dialog.querySelector('.proxy-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { form.elements.password.value = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      status.textContent = 'Testing proxy connection...';
      const input = Object.fromEntries(new FormData(form));
      form.elements.password.value = '';
      const result = await api({ action: 'connect', ...input });
      status.textContent = `Connected: ${result.protocol}://${result.host}:${result.port}`;
      setWebProxyMode('proxy');
    });
  });
  disconnect.addEventListener('click', () => run(async () => {
    await api({ action: 'disconnect' });
    window.cancelVelProxyPage();
    if (activeWeb === 'browser') { webFrame.srcdoc = '<!doctype html><p style="color:#aaa;font:16px system-ui">Proxy disconnected.</p>'; setWebBrowserStatus('Proxy disconnected.'); }
    status.textContent = 'Disconnected. Stored credentials deleted.';
  }));
})();
