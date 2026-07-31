/**
 * Getty Images 스타일 가시적 워터마크.
 *
 * 화면 캡처나 사진 촬영은 기술적으로 막을 수 없다는 것을 전제로, 유출된
 * 사본에서 "누가 받은 문서인지"를 되짚을 수 있게 만드는 것이 목적이다.
 * 그래서 지우기 쉬운 모서리 배지가 아니라 지면 전체를 가로지르게 깔았다.
 */
type Props = {
  /** 수신자 식별자 — 이메일이 없으면 링크 열람임을 나타낸다. */
  label: string;
  /** 열람 시각. 같은 문서라도 열람 건마다 달라 추적 단위가 된다. */
  openedAt: string;
};

export function Watermark({ label, openedAt }: Props) {
  const text = `${label} · ${openedAt}`;
  const rows = Array.from({ length: 14 });

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden"
    >
      <div className="absolute inset-0 -rotate-[30deg] scale-150">
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap py-6 font-mono text-[13px] tracking-[0.2em] text-black/20 mix-blend-multiply"
            // 행마다 어긋나게 밀어서 세로줄이 생기지 않게 한다.
            style={{ transform: `translateX(${(i % 3) * 120 - 120}px)` }}
          >
            {`${text} `.repeat(8)}
          </div>
        ))}
      </div>
    </div>
  );
}
