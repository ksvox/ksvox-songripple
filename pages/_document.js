import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        {/* Tailwind CSS (CDN版) - デザインを反映させるために必須 */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
