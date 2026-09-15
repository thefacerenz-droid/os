export function renderAnswers(root, answers) {
  root.replaceChildren();
  if (!answers.length) { const empty = document.createElement('p'); empty.className = 'output-empty'; empty.textContent = 'No questions detected yet.'; root.append(empty); return; }
  for (const item of answers) {
    const row = document.createElement('article'); row.className = 'answer';
    const header = document.createElement('header'); const number = document.createElement('strong'); number.textContent = item.number === 'Unnumbered' ? 'Unnumbered question' : `Question ${item.number}`;
    const time = document.createElement('time'); time.textContent = new Date(item.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); header.append(number, time);
    const question = document.createElement('h2'); question.textContent = item.question;
    const answer = document.createElement('p'); answer.className = 'result'; answer.textContent = item.answer;
    row.append(header, question, answer);
    if (item.uncertain) { const uncertainty = document.createElement('p'); uncertainty.className = 'uncertain'; uncertainty.textContent = 'Needs review'; row.append(uncertainty); }
    if (item.explanation) { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Explanation'; const text = document.createElement('p'); text.textContent = item.explanation; details.append(summary, text); row.append(details); }
    root.append(row);
  }
}
export const answerText = answers => answers.map(item => `${item.number === 'Unnumbered' ? 'Unnumbered' : 'Question ' + item.number}: ${item.answer}${item.uncertain ? ' (needs review)' : ''}`).join('\n\n');
