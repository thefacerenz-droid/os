import { renderAnswers, answerText } from './output.js';
const $ = selector => document.querySelector(selector);
const video = $('#screen'); const canvas = document.createElement('canvas');
let stream, timer, request, running = false, busy = false, generation = 0, previousHash = '', screenshot = '', pending = false, popout;
const answers = new Map();
function status(text, error = false) { $('#status').textContent = text; $('#status').classList.toggle('error', error); }
function state(text, live = false) { $('#state').textContent = text; $('#state').classList.toggle('live', live); }
function render() {
  const values = [...answers.values()]; renderAnswers($('#output'), values); $('#count').textContent = values.length; $('#copy').disabled = !values.length;
  if (popout && !popout.closed) renderAnswers(popout.document.querySelector('#output'), values);
}
function stop(message = 'Stopped.') {
  generation++; running = false; pending = false; clearTimeout(timer); request?.abort(); request = null; busy = false;
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; video.hidden = true;
  $('#empty').hidden = Boolean(screenshot); $('#start').disabled = false; $('#stop').disabled = true; $('#scan').disabled = !screenshot;
  $('#source').textContent = screenshot ? 'Screenshot' : 'Not sharing'; state('Stopped'); status(message);
}
function frame() {
  if (!video.videoWidth || !video.videoHeight) throw new Error('Waiting for the shared screen to become available.');
  const scale = Math.min(1, 1600 / video.videoWidth, 1200 / video.videoHeight);
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}
async function hash(image) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(image)); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function scan(force = false) {
  if (busy || !$('#consent').checked || (!running && !screenshot)) return;
  const token = generation; busy = true; $('#scan').disabled = true;
  try {
    const image = running ? frame() : screenshot;
    const nextHash = await hash(image);
    if (!force && nextHash === previousHash) { state('Watching', true); status('Waiting for the screen to change.'); return; }
    if (token !== generation) return;
    state('Analyzing', running); status('Reading visible questions...');
    request = new AbortController();
    const response = await fetch('/api/test-helper', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, consent: true }), signal: request.signal });
    let data; try { data = await response.json(); } catch { throw new Error(`The server returned an unreadable response (${response.status}).`); }
    if (!response.ok) { const error = new Error(data.message || 'Analysis failed.'); error.code = response.status; throw error; }
    if (token !== generation) return;
    previousHash = nextHash;
    for (const item of data.questions || []) {
      const key = item.number && item.number !== 'Unnumbered' ? item.number : item.question;
      answers.set(key, { ...item, updated: Date.now() });
    }
    while (answers.size > 100) answers.delete(answers.keys().next().value);
    render(); state(running ? 'Watching' : 'Ready', running); status(data.note || (data.questions.length ? `Updated ${data.questions.length} answer${data.questions.length === 1 ? '' : 's'}.` : 'No questions visible.'));
  } catch (error) {
    if (token !== generation || error.name === 'AbortError') return;
    if ([401, 402, 403, 429, 503].includes(error.code)) stop(error.message);
    state('Needs attention'); status(error.message, true);
  } finally {
    if (token === generation) { busy = false; $('#scan').disabled = !running && !screenshot; if (running) timer = setTimeout(() => scan(), 12000); }
  }
}
$('#start').onclick = async () => {
  if (!$('#consent').checked) { status('Enable screen analysis consent before starting.', true); return; }
  if (!navigator.mediaDevices?.getDisplayMedia) { status('This browser does not support screen sharing. Use Upload screenshot instead.', true); return; }
  stop('Choose a screen, window, or tab.'); pending = true; const token = generation;
  $('#start').disabled = true; $('#stop').disabled = false; state('Select screen');
  try {
    const selected = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 2, max: 5 } }, audio: false });
    if (token !== generation || !$('#consent').checked) { selected.getTracks().forEach(track => track.stop()); return; }
    stream = selected; screenshot = ''; previousHash = ''; $('#snapshot').hidden = true; video.srcObject = stream; video.hidden = false; $('#empty').hidden = true;
    stream.getVideoTracks()[0].addEventListener('ended', () => stop('Screen sharing ended.'), { once: true });
    await video.play();
    if (token !== generation) return;
    running = true; pending = false; $('#source').textContent = stream.getVideoTracks()[0].label || 'Shared screen'; $('#scan').disabled = false;
    state('Watching', true); scan(true);
  } catch (error) { if (token === generation) { stop(); status(error.name === 'NotAllowedError' ? 'Screen sharing was cancelled or denied.' : error.message, true); } }
};
$('#stop').onclick = () => stop();
$('#scan').onclick = () => { clearTimeout(timer); scan(true); };
$('#consent').onchange = () => { if (!$('#consent').checked) stop('Screen analysis consent withdrawn.'); };
$('#upload').onclick = () => { if (!$('#consent').checked) return status('Enable screen analysis consent before uploading.', true); $('#file').click(); };
$('#file').onchange = async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) return status('Choose a PNG or JPEG screenshot up to 10 MB.', true);
  stop(); const token = generation;
  try {
    const image = await createImageBitmap(file);
    if (token !== generation) { image.close(); return; }
    const scale = Math.min(1, 1600 / image.width, 1200 / image.height); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
    screenshot = canvas.toDataURL('image/jpeg', 0.82); $('#snapshot').src = screenshot; $('#snapshot').hidden = false; $('#empty').hidden = true; $('#source').textContent = 'Screenshot'; $('#scan').disabled = false; scan(true);
  } catch { status('Could not read this screenshot.', true); }
};
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText(answerText([...answers.values()])); status('Answers copied.'); } catch { status('Clipboard access is unavailable.', true); } };
$('#clear').onclick = () => { answers.clear(); previousHash = ''; render(); };
$('#popout').onclick = () => {
  popout = window.open('', 'veloi-test-helper-answers', 'width=430,height=700');
  if (!popout) return status('Allow popups to open the answer window.', true);
  const doc = popout.document; doc.title = 'Veloi Test Helper - Answers'; doc.body.className = 'popout'; doc.body.replaceChildren();
  if (!doc.querySelector('link')) { const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./style.css', location.href).href; doc.head.append(css); }
  const section = doc.createElement('section'); section.className = 'answers'; const title = doc.createElement('h1'); title.textContent = 'Veloi Test Helper'; const output = doc.createElement('div'); output.id = 'output'; section.append(title, output); doc.body.append(section); render();
};
window.addEventListener('pagehide', () => { stop(); if (popout && !popout.closed) popout.close(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && running && !busy) { clearTimeout(timer); scan(); } });
if (!navigator.mediaDevices?.getDisplayMedia) { $('#support').hidden = false; $('#support').textContent = 'Live screen sharing is unavailable on this device. Screenshot upload is available.'; }
window.lucide?.createIcons();
fetch('/api/test-helper').then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); if (!data.configured) status('Question recognition needs OPENAI_API_KEY configured on the server.', true); }).catch(error => status(error.message || 'Unable to reach the test helper service.', true));
