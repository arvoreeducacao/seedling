import type { BeforeMount } from "@monaco-editor/react";

export const editorTheme = "live-coding";

export const defineEditorTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(editorTheme, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c792ea" },
      { token: "string", foreground: "c3e88d" },
      { token: "number", foreground: "f78c6c" },
      { token: "comment", foreground: "6c6f9c", fontStyle: "italic" },
      { token: "type", foreground: "ffcb6b" },
      { token: "type.identifier", foreground: "ffcb6b" },
      { token: "identifier.function", foreground: "82aaff" },
    ],
    colors: {
      "editor.background": "#0e0f2d",
      "editor.foreground": "#e4e5f7",
      "editor.lineHighlightBackground": "#16183a",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#5a5d8c",
      "editorLineNumber.activeForeground": "#babcd9",
      "editorCursor.foreground": "#5865f2",
      "editor.selectionBackground": "#5865f255",
      "editorIndentGuide.background1": "#23264f",
      "editorGutter.background": "#0e0f2d",
      "scrollbarSlider.background": "#2b2e5e80",
    },
  });
};
