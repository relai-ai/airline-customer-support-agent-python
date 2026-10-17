// Present app-server questions through the IDE, keeping answers out of saved chat.
async function askUser(vscode, questions, signal) {
  if (!Array.isArray(questions) || !questions.length ||
      questions.some((q) => !q.id || !q.question || q.isSecret))
    throw Error("Questions must be nonsecret; enter credentials in the terminal.");
  const cancellation = new vscode.CancellationTokenSource();
  const cancel = () => cancellation.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const answers = Object.create(null);
  try {
    for (const [index, question] of questions.entries()) {
      if (signal.aborted) break;
      const title = `Codex + RELAI · ${question.header || "Question"} (${index + 1}/${questions.length})`;
      let answer;
      if (question.options?.length) {
        const choices = question.options.map((option) => ({
          label: option.label, description: option.description,
        }));
        if (question.isOther) choices.push({ label: "Write an answer…", custom: true });
        const choice = await vscode.window.showQuickPick(choices, {
          title, placeHolder: question.question, ignoreFocusOut: true,
        }, cancellation.token);
        if (choice && !choice.custom) answer = choice.label;
        else if (choice?.custom && !signal.aborted)
          answer = await vscode.window.showInputBox({
            title, prompt: question.question, ignoreFocusOut: true,
            validateInput: (value) => value.trim() ? undefined : "Enter an answer or press Escape to skip.",
          }, cancellation.token);
      } else {
        answer = await vscode.window.showInputBox({
          title, prompt: question.question, ignoreFocusOut: true,
          validateInput: (value) => value.trim() ? undefined : "Enter an answer or press Escape to skip.",
        }, cancellation.token);
      }
      if (signal.aborted) break;
      // Escape is an explicit skipped response, never approval or a default.
      answers[question.id] = { answers: answer === undefined ? [] : [answer] };
      if (answer === undefined) break;
    }
    return answers;
  } finally {
    signal.removeEventListener("abort", cancel);
    cancellation.dispose();
  }
}
module.exports = { askUser };
