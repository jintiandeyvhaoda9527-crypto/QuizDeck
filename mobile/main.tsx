import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QuizApp } from "../app/quiz-app";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuizApp />
  </StrictMode>,
);
