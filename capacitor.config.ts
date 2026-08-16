import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.quizdeck.mobile",
  appName: "QuizDeck",
  webDir: "android-web",
  loggingBehavior: "none",
  server: {
    androidScheme: "https",
  },
};

export default config;
