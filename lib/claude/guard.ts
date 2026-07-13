// Streaming guardrail: in guarded modes (hint/interview/ask/review) the model is
// instructed never to emit a full solution. As a second line of defence we cap the
// number of lines inside any single fenced ``` code block; beyond the cap we
// suppress the rest of that block and emit a short notice. Generic snippets pass;
// a pasted full algorithm gets withheld.

const MAX_CODE_LINES = 8;

export async function* guardStream(
  src: AsyncGenerator<string>,
): AsyncGenerator<string> {
  let buf = "";
  let inFence = false;
  let codeLines = 0;
  let suppressing = false;

  function processLine(line: string, hadNewline: boolean): string {
    const isFence = /^\s*```/.test(line);
    let out = "";
    if (isFence) {
      if (!inFence) {
        inFence = true;
        codeLines = 0;
        suppressing = false;
        out = line + (hadNewline ? "\n" : "");
      } else {
        // closing fence
        inFence = false;
        if (suppressing) {
          out = "// …(solution withheld — try the next hint)\n" + line + (hadNewline ? "\n" : "");
        } else {
          out = line + (hadNewline ? "\n" : "");
        }
        suppressing = false;
      }
      return out;
    }
    if (inFence) {
      codeLines += 1;
      if (codeLines > MAX_CODE_LINES) {
        suppressing = true;
        return ""; // swallow
      }
      return line + (hadNewline ? "\n" : "");
    }
    return line + (hadNewline ? "\n" : "");
  }

  for await (const chunk of src) {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const out = processLine(line, true);
      if (out) yield out;
    }
  }
  if (buf.length) {
    const out = processLine(buf, false);
    if (out) yield out;
  }
}
