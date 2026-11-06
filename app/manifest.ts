import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "하루쿼리",
    short_name: "하루쿼리",
    description: "하루 SQL 카드와 데이터 분석가 라이브 쿼리 연습",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fc",
    theme_color: "#f4f7fc",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
