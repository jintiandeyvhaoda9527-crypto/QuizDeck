import { QuizApp } from "./quiz-app";
import { I18nProvider } from "./i18n";

export default function Home() {
  return (
    <I18nProvider>
      <QuizApp />
    </I18nProvider>
  );
}
