import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'booking-selected-slots-v1';
const MAX_SELECTION = 3;
const SLOT_STEP_MINUTES = 30;
const SLOT_DURATION_MINUTES = 30;
const START_HOUR = 8;
const END_HOUR = 20;

const addDays = (date, count) => {
  const next = new Date(date);
  next.setDate(date.getDate() + count);
  return next;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDayLabel = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const toMinuteValue = (hour, minute) => hour * 60 + minute;

const formatTimeLabel = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const slotsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const DateStrip = memo(function DateStrip({ dates, selectedDateKey, onDateSelect }) {
  return (
    <div className="date-strip">
      {dates.map((date) => {
        const key = formatDateKey(date);
        const isSelected = key === selectedDateKey;
        return (
          <button
            key={key}
            type="button"
            className={`date-button ${isSelected ? 'selected' : ''}`}
            onClick={() => onDateSelect(key)}
          >
            {formatDayLabel(date)}
          </button>
        );
      })}
    </div>
  );
});

const TimeSlotGrid = memo(function TimeSlotGrid({
  slotOptions,
  selectedDateKey,
  selectedSet,
  disabledSet,
  onSlotClick,
}) {
  return (
    <div className="slot-grid">
      {slotOptions.map((slot) => {
        const slotId = `${selectedDateKey}|${slot.startMinutes}`;
        const isSelected = selectedSet.has(slotId);
        const isDisabled = disabledSet.has(slotId);
        return (
          <button
            key={slotId}
            type="button"
            onClick={() => onSlotClick(slot)}
            disabled={isDisabled}
            className={`slot-button ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
});

const SummaryPanel = memo(function SummaryPanel({ selectedSlots, onRemoveSlot }) {
  return (
    <aside className="summary-panel">
      <h3>Selected Slots</h3>
      <p>Total: {selectedSlots.length}</p>
      {selectedSlots.length === 0 ? (
        <p className="summary-empty">No slots selected yet.</p>
      ) : (
        <ul className="summary-list">
          {selectedSlots.map((slot) => {
            const key = `${slot.dateKey}|${slot.startMinutes}`;
            return (
              <li key={key} className="summary-item">
                <span>
                  {slot.dateLabel} - {slot.timeLabel}
                </span>
                <button type="button" onClick={() => onRemoveSlot(slot)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
});

function Home() {
  const [selectedSlots, setSelectedSlots] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  });

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));

  const dates = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, idx) => addDays(base, idx));
  }, []);

  const slotOptions = useMemo(() => {
    const options = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
      for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
        const startMinutes = toMinuteValue(hour, minute);
        options.push({
          startMinutes,
          endMinutes: startMinutes + SLOT_DURATION_MINUTES,
          label: formatTimeLabel(startMinutes),
          hour,
        });
      }
    }
    return options;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedSlots));
  }, [selectedSlots]);

  const normalizedSelectedSlots = useMemo(
    () =>
      selectedSlots
        .filter((slot) => dates.some((d) => formatDateKey(d) === slot.dateKey))
        .sort((a, b) =>
          a.dateKey === b.dateKey ? a.startMinutes - b.startMinutes : a.dateKey.localeCompare(b.dateKey)
        ),
    [dates, selectedSlots]
  );

  const selectedSet = useMemo(
    () => new Set(normalizedSelectedSlots.map((slot) => `${slot.dateKey}|${slot.startMinutes}`)),
    [normalizedSelectedSlots]
  );

  const isToday = useMemo(() => selectedDateKey === formatDateKey(new Date()), [selectedDateKey]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const canAddSlot = useCallback(
    (candidate) => {
      if (normalizedSelectedSlots.length >= MAX_SELECTION) return false;

      const sameDateSlots = normalizedSelectedSlots.filter((slot) => slot.dateKey === selectedDateKey);
      const candidateHour = Math.floor(candidate.startMinutes / 60);

      return !sameDateSlots.some((slot) => {
        const hasOverlap = slotsOverlap(
          slot.startMinutes,
          slot.endMinutes,
          candidate.startMinutes,
          candidate.endMinutes
        );
        const sameHour = Math.floor(slot.startMinutes / 60) === candidateHour;
        return hasOverlap || sameHour;
      });
    },
    [normalizedSelectedSlots, selectedDateKey]
  );

  const disabledSet = useMemo(() => {
    const set = new Set();

    slotOptions.forEach((slot) => {
      const id = `${selectedDateKey}|${slot.startMinutes}`;
      const alreadySelected = selectedSet.has(id);
      if (alreadySelected) return;

      if (isToday && slot.startMinutes < nowMinutes) {
        set.add(id);
        return;
      }

      if (!canAddSlot(slot)) {
        set.add(id);
      }
    });

    return set;
  }, [slotOptions, selectedDateKey, selectedSet, isToday, nowMinutes, canAddSlot]);

  const handleSlotToggle = useCallback(
    (slot) => {
      const slotId = `${selectedDateKey}|${slot.startMinutes}`;

      setSelectedSlots((prev) => {
        const exists = prev.some(
          (item) => item.dateKey === selectedDateKey && item.startMinutes === slot.startMinutes
        );

        if (exists) {
          return prev.filter(
            (item) => !(item.dateKey === selectedDateKey && item.startMinutes === slot.startMinutes)
          );
        }

        if (disabledSet.has(slotId)) {
          return prev;
        }

        const selectedDate = dates.find((d) => formatDateKey(d) === selectedDateKey) ?? new Date();
        const slotItem = {
          dateKey: selectedDateKey,
          dateLabel: formatDayLabel(selectedDate),
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          timeLabel: slot.label,
        };

        return [...prev, slotItem];
      });
    },
    [dates, disabledSet, selectedDateKey]
  );

  const handleRemoveSlot = useCallback((slotToRemove) => {
    setSelectedSlots((prev) =>
      prev.filter(
        (slot) =>
          !(
            slot.dateKey === slotToRemove.dateKey && slot.startMinutes === slotToRemove.startMinutes
          )
      )
    );
  }, []);

  return (
    <section className="booking-layout">
      <div className="booking-main">
        <h2>Choose Your Appointment Slots</h2>
        <DateStrip
          dates={dates}
          selectedDateKey={selectedDateKey}
          onDateSelect={setSelectedDateKey}
        />
        <TimeSlotGrid
          slotOptions={slotOptions}
          selectedDateKey={selectedDateKey}
          selectedSet={selectedSet}
          disabledSet={disabledSet}
          onSlotClick={handleSlotToggle}
        />
      </div>
      <SummaryPanel selectedSlots={normalizedSelectedSlots} onRemoveSlot={handleRemoveSlot} />
    </section>
  );
}

export default Home;
