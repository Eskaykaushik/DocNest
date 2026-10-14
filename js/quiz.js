/**
 * quiz.js
 * Builds interactive "check yourself" quizzes from ```quiz fences. Each block
 * holds JSON: { questions: [{ q, options: [...], answer, why }] }. Answers are
 * scored in place; a perfect score fires options.onPerfect (once).
 */

const CHECK_LABEL = "Check answers";
const RETRY_LABEL = "Try again";

export function initQuizzes(container, options = {}) {
  container.querySelectorAll(".quiz:not([data-bound])").forEach((node) => {
    node.setAttribute("data-bound", "true");
    let data;
    try {
      data = JSON.parse(decodeURIComponent(node.dataset.quiz || "{}"));
    } catch {
      node.remove();
      return;
    }
    if (!Array.isArray(data.questions) || !data.questions.length) {
      node.remove();
      return;
    }
    build(node, data.questions, options);
  });
}

function build(node, questions, options) {
  const answers = questions.map(() => null);

  node.innerHTML = `
    <p class="quiz-eyebrow">Check yourself</p>
    <div class="quiz-questions"></div>
    <div class="quiz-actions">
      <button type="button" class="quiz-check" disabled>${CHECK_LABEL}</button>
      <span class="quiz-score" aria-live="polite"></span>
    </div>
  `;

  const list = node.querySelector(".quiz-questions");
  const checkBtn = node.querySelector(".quiz-check");
  const scoreEl = node.querySelector(".quiz-score");

  questions.forEach((question, qi) => {
    const card = document.createElement("div");
    card.className = "quiz-question";
    const optionsHtml = question.options
      .map(
        (opt, oi) =>
          `<button type="button" class="quiz-option" data-q="${qi}" data-o="${oi}">${opt}</button>`
      )
      .join("");
    card.innerHTML = `
      <p class="quiz-q">${question.q}</p>
      <div class="quiz-options">${optionsHtml}</div>
      <p class="quiz-why" hidden>${question.why || ""}</p>
    `;
    list.appendChild(card);
  });

  function refreshEnabled() {
    checkBtn.disabled = answers.some((a) => a === null);
  }

  node.addEventListener("click", (event) => {
    const option = event.target.closest(".quiz-option");
    if (option && !node.classList.contains("quiz-scored")) {
      const qi = Number(option.dataset.q);
      answers[qi] = Number(option.dataset.o);
      node
        .querySelectorAll(`.quiz-option[data-q="${qi}"]`)
        .forEach((btn) => btn.classList.toggle("selected", btn === option));
      refreshEnabled();
      return;
    }
    if (event.target.closest(".quiz-check") && !node.classList.contains("quiz-scored")) {
      score(node, questions, answers, scoreEl, checkBtn, options);
      return;
    }
    if (event.target.closest(".quiz-retry")) {
      node.classList.remove("quiz-scored", "quiz-perfect");
      node.querySelectorAll(".quiz-option").forEach((btn) => btn.classList.remove("selected", "correct", "wrong"));
      node.querySelectorAll(".quiz-why").forEach((el) => (el.hidden = true));
      answers.fill(null);
      scoreEl.textContent = "";
      checkBtn.textContent = CHECK_LABEL;
      checkBtn.disabled = true;
    }
  });
}

function score(node, questions, answers, scoreEl, checkBtn, options) {
  let correct = 0;
  questions.forEach((question, qi) => {
    const chosen = answers[qi];
    if (chosen === question.answer) correct += 1;
    node.querySelectorAll(`.quiz-option[data-q="${qi}"]`).forEach((btn) => {
      const oi = Number(btn.dataset.o);
      if (oi === question.answer) btn.classList.add("correct");
      else if (oi === chosen) btn.classList.add("wrong");
    });
    const why = node.querySelectorAll(".quiz-why")[qi];
    if (why) why.hidden = false;
  });

  node.classList.add("quiz-scored");
  const total = questions.length;
  const perfect = correct === total;
  scoreEl.textContent = `${correct} / ${total} correct`;
  scoreEl.classList.toggle("perfect", perfect);

  if (perfect) {
    node.classList.add("quiz-perfect");
    options.onPerfect?.();
  } else {
    checkBtn.textContent = RETRY_LABEL;
    checkBtn.classList.add("quiz-retry");
    checkBtn.disabled = false;
  }
}
