import type { CapacitorConfig } from "@capacitor/cli";

/*
 * The iOS app is a native shell around the deployed site.
 *
 * Why not a static export: the storefront is genuinely dynamic — prices,
 * offers and stock are all read per request, and the admin console changes
 * them at runtime. Bundling a static build would ship prices that go stale
 * the first time someone edits a product.
 *
 * What makes it more than a web view: the app uses the native camera for
 * Grezzo Lens, native haptics on add-to-bag, a native splash screen, and the
 * system status bar. Apple's review guideline 4.2 turns down shells that add
 * nothing — these are the things that make it an app rather than a bookmark.
 *
 * Point GREZZO_APP_URL at your deployment before running `npx cap sync`.
 */
const liveUrl = process.env.GREZZO_APP_URL ?? "https://grezzojeans.com";

const config: CapacitorConfig = {
  appId: "store.grezzo.app",
  appName: "Grezzo",
  webDir: "public",          // only the fallback assets; the shell loads liveUrl
  server: {
    url: liveUrl,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#16233a",
    // The unzip intro is dark; a light scroll indicator reads better on it.
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#16233a",
      showSpinner: false,
      iosSpinnerStyle: "small",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#16233a",
    },
  },
};

export default config;
