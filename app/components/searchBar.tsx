/** 닉네임 검색창. 전적표를 닉네임으로 걸러낸다. */
export default function SearchBar({
  query,
  setQuery,
  matched,
  total,
}: {
  query: string;
  setQuery: (v: string) => void;
  /** 검색에 걸린 인원 수 */
  matched: number;
  /** 전체 인원 수 */
  total: number;
}) {
  return (
    <div className="mt-4">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="닉네임 검색…"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            title="검색어 지우기"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>
      {query && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {matched > 0 ? `${total}명 중 ${matched}명 표시 중` : `'${query}' 와(과) 일치하는 닉네임이 없습니다.`}
        </p>
      )}
    </div>
  );
}
