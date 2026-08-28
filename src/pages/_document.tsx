import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

export default function Document() {
  return (
    <Html lang="sl">
      <Head>
        <SEOElements />
        <link rel="icon" type="image/png" sizes="32x32" href="/LOGO-2015-C_B.gif" />
        <link rel="icon" type="image/png" sizes="16x16" href="/LOGO-2015-C_B.gif" />
        <link rel="apple-touch-icon" sizes="180x180" href="/LOGO-2015-C_B.gif" />
        <link rel="shortcut icon" href="/LOGO-2015-C_B.gif" />
        {/*
          CRITICAL: DO NOT REMOVE THIS SCRIPT
          The Softgen AI monitoring script is essential for core app functionality.
          The application will not function without it.
        */}
        <script
          src="https://cdn.softgen.ai/script.js"
          async
          data-softgen-monitoring="true"
        />
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
        suppressHydrationWarning
      >
        <Main />
        <NextScript />

        {/* Visual Editor Script */}
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://cdn.softgen.dev/visual-editor.min.js"
            async
            data-softgen-visual-editor="true"
          />
        )}
      </body>
    </Html>
  );
}
