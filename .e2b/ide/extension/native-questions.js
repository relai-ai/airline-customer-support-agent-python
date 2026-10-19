const { randomUUID } = require("node:crypto");

// Questions and answers live only in this runtime, never in saved chat.
class InlineQuestions {
  constructor(changed) { this.changed = changed; this.pending = null; }
  snapshot() { return this.pending?.view || null; }
  publish() { this.changed(this.snapshot()); }
  async ask(questions, signal) {
    if (!Array.isArray(questions) || !questions.length ||
        questions.some((q) => !q.id || !q.question || q.isSecret))
      throw Error("Questions must be nonsecret; enter credentials in the terminal.");
    if (this.pending) throw Error("Another question is already pending.");
    const answers = Object.create(null);
    for (const [index, question] of questions.entries()) {
      if (signal.aborted) break;
      const answer = await new Promise((resolve) => {
        const id = randomUUID();
        const abort = () => this.finish(id, undefined);
        this.pending = { resolve, signal, abort, view: {
          id, header: question.header || "Review", question: question.question,
          options: (question.options || []).map(({ label, description }) => ({ label, description })),
          isOther: Boolean(question.isOther), index: index + 1, total: questions.length,
        } };
        signal.addEventListener("abort", abort, { once: true });
        this.publish();
        if (signal.aborted) abort();
      });
      if (signal.aborted) break;
      answers[question.id] = { answers: answer === undefined ? [] : [answer] };
      if (answer === undefined) break;
    }
    return answers;
  }
  answer(id, kind, value) {
    const view = this.snapshot();
    if (!view || view.id !== id) throw Error("This question is no longer pending.");
    if (kind === "skip") return this.finish(id, undefined);
    if (typeof value !== "string" || !value.trim() || value.length > 12000)
      throw Error("Enter an answer before submitting.");
    if (kind === "choice" && view.options.some((o) => o.label === value))
      return this.finish(id, value);
    if (kind === "text" && (!view.options.length || view.isOther))
      return this.finish(id, value);
    throw Error("Choose one of the current question's options.");
  }
  finish(id, answer) {
    const pending = this.pending;
    if (!pending || pending.view.id !== id) return;
    this.pending = null;
    pending.signal.removeEventListener("abort", pending.abort);
    this.publish();
    pending.resolve(answer);
  }
  close() { if (this.pending) this.finish(this.pending.view.id, undefined); }
}
module.exports = { InlineQuestions };
