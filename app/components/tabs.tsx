import { NavLink } from "react-router";

const TABS = [
  { to: "/", label: "점수 계산기" },
  { to: "/stats", label: "통산 전적" },
];

/** 계산기 ↔ 전적 DB 탭 이동 */
export default function Tabs() {
  return (
    <nav className="mt-5 flex gap-1 border-b border-gray-200 dark:border-gray-800">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            [
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
            ].join(" ")
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
