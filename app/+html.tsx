import { ScrollViewStyleReset } from 'expo-router/html';

// Sets the HTML shell for the Expo web build.
// viewport-fit=cover is required so env(safe-area-inset-*) env vars are
// populated in iOS Safari, allowing SafeAreaView to add the correct padding
// for the notch / Dynamic Island / home indicator.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <title>WERKR</title>
        {/*
          ScrollViewStyleReset injects:
            html, body { height: 100%; }
            body { overflow: hidden; }
            #root { display: flex; height: 100%; flex: 1; }
          which are required by React Native Web's ScrollView.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
