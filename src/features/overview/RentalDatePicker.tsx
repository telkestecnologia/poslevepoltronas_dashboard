import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

type Props = { date: string; onChange: (date: string) => void; label?: string; minDate?: string; maxDate?: string }

function parts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function RentalDatePicker({ date, onChange, label = 'Data do aluguel', minDate, maxDate }: Props) {
  const id = useId()
  const selected = parts(date)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selected.year, selected.month - 1, 1))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const selectedDay = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)


  // O calendário abre por cima de tudo (fora do cartão ou da janela que o cortava), encostado no botão e sempre
  // inteiro na tela: sem passar da borda nem ficar sob o menu lateral; sem espaço embaixo, abre para cima.
  useLayoutEffect(() => {
    const calendar = popover.current
    if (!open || !calendar) return
    const fit = () => {
      const button = trigger.current?.getBoundingClientRect()
      if (!button) return
      const area = root.current?.closest('.main-area')?.getBoundingClientRect()
      const minLeft = Math.max(area?.left ?? 0, 0) + 8
      const maxRight = Math.min(area?.right ?? window.innerWidth, window.innerWidth) - 8
      const width = calendar.offsetWidth
      const height = calendar.offsetHeight
      const left = Math.max(minLeft, Math.min(button.right - width, maxRight - width))
      const below = button.bottom + 8
      const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, button.top - 8 - height)
      calendar.style.left = `${left}px`
      calendar.style.top = `${top}px`
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', fit, true)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', fit, true)
    }
  }, [open, visibleMonth])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!root.current?.contains(target) && !popover.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    selectedDay.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstWeekday + days }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
  const displayDate = new Intl.DateTimeFormat('pt-BR').format(
    new Date(selected.year, selected.month - 1, selected.day, 12))

  function choose(nextDate: string) {
    onChange(nextDate)
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div className="overview-rentals-date" ref={root}>
      <span id={`${id}-label`}>{label}</span>
      <button type="button" className="overview-rentals-date-trigger" ref={trigger}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog" aria-expanded={open}
        onClick={() => {
          setVisibleMonth(new Date(selected.year, selected.month - 1, 1))
          setOpen(value => !value)
        }}>
        <CalendarDays size={16} aria-hidden="true" />
        <span id={`${id}-value`}>{displayDate}</span>
      </button>
      {open && createPortal(
        <div className="overview-rentals-calendar" ref={popover} role="dialog" aria-label={`Escolher ${label.toLowerCase()}`}
          style={{ position: 'fixed', right: 'auto', top: 0, left: 0, zIndex: 1000 }}>
          <div className="overview-rentals-calendar-header">
            <button type="button" aria-label="Mês anterior"
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}>
              <ChevronLeft size={18} />
            </button>
            <strong>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(visibleMonth)}</strong>
            <button type="button" aria-label="Próximo mês"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="overview-rentals-calendar-grid">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(weekday =>
              <span className="overview-rentals-weekday" key={weekday}>{weekday}</span>)}
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />
              const value = isoDate(year, month + 1, day)
              const isSelected = value === date
              return <button type="button" key={value} ref={isSelected ? selectedDay : undefined}
                className={isSelected ? 'selected' : ''} aria-pressed={isSelected}
                aria-current={value === today ? 'date' : undefined}
                disabled={(minDate !== undefined && value < minDate) || (maxDate !== undefined && value > maxDate)}
                aria-label={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' })
                  .format(new Date(year, month, day, 12))}
                onClick={() => choose(value)}>{day}</button>
            })}
          </div>
          <button type="button" className="overview-rentals-calendar-today"
            disabled={(minDate !== undefined && today < minDate) || (maxDate !== undefined && today > maxDate)}
            onClick={() => choose(today)}>Ir para hoje</button>
        </div>, document.body
      )}
    </div>
  )
}
