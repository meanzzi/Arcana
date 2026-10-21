import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cardAt, type FanGeometry } from "../utils/cardLayout";

const POP_DISTANCE = 0.18;
const POP_DURATION = 0.25;

type FanHoverOptions = {
  tableRef: RefObject<HTMLDivElement>;
  onSelect: (index: number) => void;
};

// 펼쳐진 부채꼴의 호버(튀어오르기)와 선택. 마우스·손가락·키보드 입력을 받음
export function useFanHover({ tableRef, onSelect }: FanHoverOptions) {
  // 펼치기가 끝나 고를 수 있을 때만 값이 있음
  const fanRef = useRef<FanGeometry | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const { contextSafe } = useGSAP({ scope: tableRef });

  const slotAt = (index: number) =>
    tableRef.current?.querySelectorAll<HTMLElement>(".card-table__slot")[index];

  const hover = contextSafe((index: number | null) => {
    const previous = hoveredRef.current;
    if (previous === index) return;
    hoveredRef.current = index;

    const previousSlot = previous === null ? undefined : slotAt(previous);
    if (previousSlot) {
      gsap.set(previousSlot, { zIndex: 0 });
      gsap.to(previousSlot.firstElementChild, {
        y: 0,
        duration: POP_DURATION,
        ease: "power2.out",
      });
    }
    const slot = index === null ? undefined : slotAt(index);
    if (slot && fanRef.current) {
      gsap.set(slot, { zIndex: 1 });
      gsap.to(slot.firstElementChild, {
        y: fanRef.current.cardWidth * POP_DISTANCE,
        duration: POP_DURATION,
        ease: "power2.out",
      });
    }
  });

  // 고를 수 있는 동안 한 번만 받음
  const select = (index: number) => {
    if (!fanRef.current) return;
    fanRef.current = null;
    // 손가락을 뗀 뒤 들어오는 pointerleave가 뒤집힐 카드의 호버를 되돌리지 않게 비움
    hoveredRef.current = null;
    onSelect(index);
  };

  const cardUnderPointer = (event: React.PointerEvent<HTMLElement>) => {
    const table = tableRef.current;
    const fan = fanRef.current;
    if (!table || !fan) return null;
    const rect = table.getBoundingClientRect();
    return cardAt(fan, event.clientX - rect.left, event.clientY - rect.top);
  };

  // 마우스는 올리면 튀고 누르면 선택, 손가락은 문지르는 동안 튀고 떼면 선택
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (fanRef.current) hover(cardUnderPointer(event));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const index = cardUnderPointer(event);
    if (index !== null) select(index);
    else hover(null);
  };

  return {
    // 펼치기가 끝나면 부채꼴 모양을 받아서 고를 수 있게 함
    ready: (fan: FanGeometry) => {
      fanRef.current = fan;
    },
    tableHandlers: {
      onPointerDown: handlePointerMove,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: () => hover(null),
      onPointerCancel: () => hover(null),
    },
    slotHandlers: (index: number) => ({
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        if (event.detail === 0) select(index);
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        if (event.currentTarget.matches(":focus-visible")) hover(index);
      },
      onBlur: () => {
        if (hoveredRef.current === index) hover(null);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(index);
        }
      },
    }),
  };
}
