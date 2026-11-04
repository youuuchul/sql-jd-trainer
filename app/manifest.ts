import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SQL JD Trainer",
    short_name: "SQL 카드",
    description: "데이터 분석가 라이브 쿼리 연습과 하루 SQL 카드",
    start_url: "/daily",
    scope: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
