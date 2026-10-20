import { useEffect, useRef, useState } from "react";
import type { DrawResult } from "../types/card";

// 안내 문구가 떠 있는 시간(ms)
const NOTICE_DURATION = 2000;

/*
  결과 링크 공유.
  1) 휴대폰 기본 공유창(navigator.share)이 있으면 그걸 띄움
  2) 없으면(대부분의 데스크톱 브라우저) 공유 문구 + 링크를 클립보드에 복사하고 안내 문구를 띄움
  백엔드가 없어서 링크는 결과 페이지가 아니라 앱 주소. 어떤 카드가 나왔는지는 함께 보내는 문구에 담음
*/
export function useShare() {
  const [notice, setNotice] = useState<string | null>(null);
  // 공유창이 떠 있는 동안 다시 누르면 navigator.share가 에러를 내므로 연타를 막음
  const sharingRef = useRef(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DURATION);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const share = async ({ card }: DrawResult) => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    try {
      await shareOrCopy(card.nameKr, card.keywords);
    } finally {
      sharingRef.current = false;
    }
  };

  const shareOrCopy = async (nameKr: string, keywords: string[]) => {
    const url = window.location.origin + window.location.pathname;
    const text = `오늘의 타로 카드는 '${nameKr}' — ${keywords.join(" · ")}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Arcana of the Day", text, url });
      } catch {
        // 사용자가 공유창을 닫은 경우(AbortError)도 여기로 옴. 실패로 안내하지 않고 조용히 끝냄
      }
      return;
    }

    try {
      // 클립보드는 https나 localhost에서만 쓸 수 있음(휴대폰에서 http://192.168... 로 열면 실패)
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("링크를 복사했어요");
    } catch {
      setNotice("링크를 복사하지 못했어요");
    }
  };

  return { notice, share };
}
