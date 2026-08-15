import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../app/i18n";
import { QuizApp } from "../app/quiz-app";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <QuizApp />
    </I18nProvider>
  </StrictMode>,
);
