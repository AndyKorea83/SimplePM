import { useEffect, useMemo, useState } from 'react'
import { PageShell } from '../ui/PageShell'
import { MonthPicker, buildMonthOptions, type MonthOption } from '../ui/MonthPicker'
import { QaSectionHeader } from './QaSectionHeader'
import { BugHistoryModal } from './BugHistoryModal'
import { fetchQAMetrics } from './api'
import { SEVERITY_COLORS, SEVERITY_ORDER } from './qaColors'
import type { MonthlySeverityDTO, QAMetricsDTO } from './types'

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

// Диапазон совпадает с internal/qa.RangeStart/RangeEnd на бэкенде (Гантту
// свой диапазон, Календарю свой — тот же принцип независимых предметных
// областей, см. architect.md). Контрол выбора месяца — тот же, что в
// Календаре (ui/MonthPicker, issue #59/#71), со своим диапазоном.
const QA_RANGE_START: MonthOption = { year: 2025, month: 8 }
const QA_RANGE_END: MonthOption = { year: 2026, month: 7 }
const RANGE_MONTHS = buildMonthOptions(QA_RANGE_START, QA_RANGE_END)

function SeverityBar({ bySeverity, total }: { bySeverity: Record<string, number>; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {SEVERITY_ORDER.map((sev) => {
        const count = bySeverity[sev] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={sev} className="flex items-center gap-2 text-[12px]">
            <span className="w-[56px] shrink-0 text-[var(--text-secondary)]">{sev}</span>
            <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#f1f5f9] dark:bg-[#1c1c1e]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SEVERITY_COLORS[sev].bg }} />
            </div>
            <span className="w-[24px] shrink-0 text-right font-semibold text-[var(--text-primary)]">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// Высота, отведённая под сам столбец (без числа и подписи месяца) — общее
// число багов месяца рисуется отдельной строкой сразу над столбцом и растёт
// вместе с ним, а не висит фиксированно в верху графика.
const BAR_MAX_HEIGHT = 160

function DistributionChart({ months }: { months: MonthlySeverityDTO[] }) {
  const maxTotal = Math.max(1, ...months.map((m) => m.total))
  return (
    <div className="flex h-[220px] items-end gap-2">
      {months.map((m) => {
        const barAreaHeight = Math.round((m.total / maxTotal) * BAR_MAX_HEIGHT)
        // Только реально присутствующие типы багов — иначе нулевые сегменты
        // сбивали бы нумерацию разделителей между соседними столбцами.
        const segments = [...SEVERITY_ORDER]
          .reverse()
          .map((sev) => ({ sev, count: m.bySeverity[sev] ?? 0 }))
          .filter((s) => s.count > 0)
        return (
          <div key={monthKey(m.year, m.month)} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {m.total > 0 && (
              <div className="flex w-full flex-col items-center" style={{ height: `${barAreaHeight}px` }}>
                <span className="shrink-0 pb-1 text-[11px] font-semibold text-[var(--text-primary)]">{m.total}</span>
                <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t">
                  {segments.map((s, i) => (
                    <div
                      key={s.sev}
                      className={i > 0 ? 'border-t-2 border-[var(--surface)]' : undefined}
                      style={{ height: `${(s.count / m.total) * 100}%`, backgroundColor: SEVERITY_COLORS[s.sev].bg }}
                      title={`${s.sev}: ${s.count}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <span className="text-[10px] text-[var(--text-secondary)]">
              {MONTH_LABELS[m.month - 1]} {String(m.year).slice(2)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function QaMetricsPage() {
  const defaultPeriod = RANGE_MONTHS[RANGE_MONTHS.length - 1]
  const [year, setYear] = useState(defaultPeriod.year)
  const [month, setMonth] = useState(defaultPeriod.month)
  const [metrics, setMetrics] = useState<QAMetricsDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyBugUid, setHistoryBugUid] = useState<number | null>(null)

  useEffect(() => {
    setMetrics(null)
    fetchQAMetrics(year, month)
      .then(setMetrics)
      .catch((err: Error) => setError(err.message))
  }, [year, month])

  const selectedLabel = useMemo(() => `${MONTH_LABELS[month - 1]} ${year}`, [month, year])

  return (
    <PageShell>
      <QaSectionHeader />
      <div className="flex items-center gap-3 px-4 py-3">
        <MonthPicker
          value={{ year, month }}
          onChange={(v) => {
            setYear(v.year)
            setMonth(v.month)
          }}
          rangeStart={QA_RANGE_START}
          rangeEnd={QA_RANGE_END}
        />
      </div>

      {/* Не растягиваем на всю ширину — ориентир на экран Full HD (решение
          пользователя по итогам ревью). */}
      <div className="min-h-0 max-w-[1600px] flex-1 overflow-y-auto p-4">
        {error && <p className="text-[14px] text-[#d93333]">Не удалось загрузить метрики: {error}</p>}
        {!error && !metrics && <p className="text-[14px] text-[#94a3b8]">Загрузка…</p>}

        {metrics && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="text-[13px] text-[var(--text-secondary)]">Критичность багов за {selectedLabel}</p>
                <p className="mb-3 text-[28px] font-bold text-[var(--text-primary)]">
                  {metrics.selectedMonth.total} <span className="text-[14px] font-normal text-[var(--text-secondary)]">всего</span>
                </p>
                <SeverityBar bySeverity={metrics.selectedMonth.bySeverity} total={metrics.selectedMonth.total} />
              </div>

              <div className="col-span-2 rounded-lg border border-[var(--border)] p-4">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Распределение критичности с {MONTH_LABELS[RANGE_MONTHS[0].month - 1]} {RANGE_MONTHS[0].year} по{' '}
                  {MONTH_LABELS[RANGE_MONTHS[RANGE_MONTHS.length - 1].month - 1]} {RANGE_MONTHS[RANGE_MONTHS.length - 1].year}
                </p>
                <p className="mb-3 text-[28px] font-bold text-[var(--text-primary)]">
                  {metrics.totalBugs} <span className="text-[14px] font-normal text-[var(--text-secondary)]">всего багов</span>
                </p>
                <DistributionChart months={metrics.monthlyDistribution} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="mb-3 text-[15px] font-bold text-[var(--text-primary)]">Статистика багов за {selectedLabel}</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="text-left text-[var(--text-secondary)]">
                        <th className="py-1 pr-3">Проект</th>
                        <th className="py-1 pr-3">Заведено</th>
                        <th className="py-1 pr-3">Закрыто</th>
                        <th className="py-1 pr-3">Лайфтайм сред.</th>
                        <th className="py-1 pr-3">Лайфтайм макс.</th>
                        <th className="py-1 pr-3">Переносы сред.</th>
                        <th className="py-1">Переносы макс.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.projectStats.map((ps) => (
                        <tr key={ps.theme} className="border-t border-[var(--border)] text-[var(--text-primary)]">
                          <td className="py-1.5 pr-3 font-semibold">{ps.theme}</td>
                          <td className="py-1.5 pr-3">{ps.created}</td>
                          <td className="py-1.5 pr-3">{ps.closed}</td>
                          <td className="py-1.5 pr-3">{ps.avgLifetimeDays || '—'}</td>
                          <td className="py-1.5 pr-3">{ps.maxLifetimeDays || '—'}</td>
                          <td className="py-1.5 pr-3">{ps.avgTransfers || '—'}</td>
                          <td className="py-1.5">{ps.maxTransfers || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="mb-3 text-[15px] font-bold text-[var(--text-primary)]">Лидерборд</p>
                <div className="flex flex-col gap-3">
                  {metrics.leaderboard.slice(0, 5).map((entry) => (
                    <div key={entry.reporterName} className="flex items-center justify-between gap-3">
                      <span className="w-[140px] shrink-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {entry.reporterName}
                      </span>
                      <div className="flex h-[10px] flex-1 overflow-hidden rounded-full bg-[#f1f5f9] dark:bg-[#1c1c1e]">
                        {SEVERITY_ORDER.map((sev) => ({ sev, count: entry.bySeverity[sev] ?? 0 }))
                          .filter((s) => s.count > 0)
                          .map((s, i) => (
                            <div
                              key={s.sev}
                              className={i > 0 ? 'border-l-2 border-[var(--surface)]' : undefined}
                              style={{
                                width: `${entry.total > 0 ? (s.count / entry.total) * 100 : 0}%`,
                                backgroundColor: SEVERITY_COLORS[s.sev].bg,
                              }}
                              title={`${s.sev}: ${s.count}`}
                            />
                          ))}
                      </div>
                      <span className="w-[24px] shrink-0 text-right text-[13px] font-bold text-[var(--text-primary)]">{entry.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="mb-3 text-[15px] font-bold text-[var(--text-primary)]">Требует внимания</p>
              <div className="grid grid-cols-3 gap-4">
                {(
                  [
                    ['Слишком долгие', metrics.tooLong],
                    ['Много переносов', metrics.tooManyTransfers],
                    ['Question', metrics.questions.map((bug) => ({ bug, value: '' }))],
                  ] as const
                ).map(([title, items]) => (
                  <div key={title} className="flex flex-col gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
                      {title} <span className="text-[var(--text-primary)]">{items.length}</span>
                    </p>
                    {items.length === 0 && <p className="text-[12px] text-[#94a3b8]">Нет</p>}
                    {items.map((item) => (
                      <button
                        key={item.bug.uid}
                        type="button"
                        onClick={() => setHistoryBugUid(item.bug.uid)}
                        className="cursor-pointer text-left"
                      >
                        <p className="text-[13px] font-medium text-[#2563eb] underline">
                          #{item.bug.uid} {item.bug.title}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {item.bug.theme}
                          {item.value ? ` · ${item.value}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {historyBugUid !== null && <BugHistoryModal bugUid={historyBugUid} onClose={() => setHistoryBugUid(null)} />}
    </PageShell>
  )
}
