import { useEffect, useRef, useState } from "react";
import type { DrawResult } from "../types/card";

const NOTICE_DURATION = 2000;

// 결과 링크 공유.
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
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("링크를 복사했어요");
    } catch {
      setNotice("링크를 복사하지 못했어요");
    }
  };

  return { notice, share };
}
