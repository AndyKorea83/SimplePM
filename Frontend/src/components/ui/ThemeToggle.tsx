import toggleOffIcon from '../../assets/icons/toggle-off.svg'
import toggleTrackIcon from '../../assets/icons/toggle-track.svg'
import toggleKnobIcon from '../../assets/icons/toggle-knob.svg'
import { useTheme } from '../../theme/ThemeContext'

// Вынесен из Calendar/TimeSectionHeader.tsx (issue #38) — теперь нужен и
// разделу «Время», и разделу «Гантт» (issue #64), так что живёт в общих
// компонентах, а не в фичевой папке одного раздела.
// Figma (189:3450): светлая тема — оранжевый трек + солнце (toggle-track/
// toggle-knob), тёмная — отдельный цельный ассет (серый трек + луна), а не
// затемнённая/сдвинутая версия светлого.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative h-5 w-[47px] shrink-0 cursor-pointer"
      aria-pressed={isLight}
      aria-label="Переключить тему"
    >
      {isLight ? (
        <>
          <img src={toggleTrackIcon} alt="" className="absolute inset-0 size-full" />
          <img src={toggleKnobIcon} alt="" className="absolute bottom-[2px] right-[2px] h-4 w-[42px]" />
        </>
      ) : (
        <img src={toggleOffIcon} alt="" className="absolute inset-0 size-full" />
      )}
    </button>
  )
}
