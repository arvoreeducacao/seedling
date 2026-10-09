const focusEvents = /\u001b\[[IO]/g;

export function trackFocusMode(current: boolean, output: string) {
  let mode = current;
  for (const match of output.matchAll(/\u001b\[\?([\d;]+)([hl])/g)) {
    if (match[1].split(";").includes("1004")) mode = match[2] === "h";
  }
  return mode;
}

export function filterInput(input: string, focusReporting: boolean) {
  return focusReporting ? input : input.replace(focusEvents, "");
}
