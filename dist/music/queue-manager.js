/* Runtime playback sequence. Persistent playlists remain outside this owner. */
(function (root) {
  const clone = (value) => ({ ...value });
  const MAX_HISTORY_ENTRIES = 100;

  function create({ onChange = () => {}, random = () => Math.random() } = {}) {
    let context = null;
    let queue = [];
    let entryKeys = [];
    let nextEntryKey = 0;
    let index = -1;
    let history = [];
    let playbackPath = [];
    let pathCursor = -1;
    let shuffleBag = [];
    let cycleConsumed = new Set();
    let forcedNext = [];
    let shuffle = false;
    let repeat = "off";
    let revision = 0;

    function keyAt(position) {
      return position >= 0 ? entryKeys[position] ?? null : null;
    }
    function positionOf(key) {
      return key == null ? -1 : entryKeys.indexOf(key);
    }
    function trackAt(key) {
      const position = positionOf(key);
      return position >= 0 ? queue[position] : null;
    }
    function newKey() {
      nextEntryKey++;
      return nextEntryKey;
    }
    function historyEntry(key) {
      const entry = trackAt(key);
      return entry ? { key, id: entry.id || "", entry: clone(entry) } : null;
    }
    function addHistory(entry) {
      if (!entry) return;
      history.push(entry);
      if (history.length > MAX_HISTORY_ENTRIES)
        history.splice(0, history.length - MAX_HISTORY_ENTRIES);
    }
    function shuffleHistory() {
      return playbackPath.slice(0, Math.max(0, pathCursor)).map(historyEntry).filter(Boolean);
    }
    function trimPlaybackPath() {
      const maxPathLength = MAX_HISTORY_ENTRIES + 1;
      if (playbackPath.length <= maxPathLength) return;
      const removed = playbackPath.length - maxPathLength;
      playbackPath.splice(0, removed);
      pathCursor = Math.max(-1, pathCursor - removed);
    }
    function snapshot() {
      const priorityPosition = forcedNext.length ? positionOf(forcedNext[0]) : -1;
      return {
        context: context ? { ...context, tracks: context.tracks.map(clone) } : null,
        queue: queue.map(clone),
        index,
        history: (shuffle ? shuffleHistory() : history).map((entry) => ({
          ...entry,
          entry: clone(entry.entry),
        })),
        shuffle,
        repeat,
        priorityNext: priorityPosition,
        revision,
      };
    }
    function changed() {
      onChange(snapshot());
      return snapshot();
    }
    function current() {
      return index >= 0 ? queue[index] || null : null;
    }
    function shuffleKeys(keys) {
      const result = keys.slice();
      for (let position = result.length - 1; position > 0; position--) {
        const other = Math.floor(random() * (position + 1));
        [result[position], result[other]] = [result[other], result[position]];
      }
      return result;
    }
    function removeFromBag(key) {
      shuffleBag = shuffleBag.filter((candidate) => candidate !== key);
    }
    function markConsumed(key) {
      if (key == null) return;
      cycleConsumed.add(key);
      removeFromBag(key);
    }
    function recordPlayback(key, { recordSame = false } = {}) {
      if (key == null) return;
      if (!recordSame && pathCursor >= 0 && playbackPath[pathCursor] === key) {
        markConsumed(key);
        return;
      }
      playbackPath = playbackPath.slice(0, pathCursor + 1);
      playbackPath.push(key);
      pathCursor = playbackPath.length - 1;
      trimPlaybackPath();
      markConsumed(key);
    }
    function buildShuffleBag({ exclude = cycleConsumed } = {}) {
      const candidates = entryKeys.filter((key) => !exclude.has(key));
      shuffleBag = shuffleKeys(candidates);
    }
    function start(value) {
      context = root.PlaybackContext.create(value);
      queue = context.tracks.map(clone);
      entryKeys = queue.map(newKey);
      index = queue.length ? context.startIndex : -1;
      history = [];
      playbackPath = [];
      pathCursor = -1;
      shuffleBag = [];
      cycleConsumed = new Set();
      forcedNext = [];
      if (index >= 0) {
        const key = keyAt(index);
        playbackPath.push(key);
        pathCursor = 0;
        cycleConsumed.add(key);
      }
      if (shuffle) buildShuffleBag();
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function select(position, { recordSame = false } = {}) {
      if (!Number.isInteger(position) || position < 0 || position >= queue.length) return null;
      const oldKey = keyAt(index), key = keyAt(position);
      if ((oldKey !== key || recordSame) && oldKey != null)
        addHistory(historyEntry(oldKey));
      index = position;
      recordPlayback(key, { recordSame });
      forcedNext = forcedNext.filter((candidate) => candidate !== key);
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function replayFromHistory(historyPosition) {
      const entries = shuffle ? shuffleHistory() : history;
      if (
        !Number.isInteger(historyPosition) ||
        historyPosition < 0 ||
        historyPosition >= entries.length
      )
        return null;
      const target = entries[historyPosition], position = positionOf(target.key);
      if (position < 0) return null;
      if (shuffle) {
        pathCursor = historyPosition;
        index = position;
        markConsumed(target.key);
      } else {
        history.length = historyPosition;
        index = position;
        recordPlayback(target.key);
      }
      forcedNext = forcedNext.filter((candidate) => candidate !== target.key);
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function append(value, { next = false } = {}) {
      const entry = clone(value), key = newKey();
      if (next && index >= 0) {
        let insertAt = index + 1;
        for (const forcedKey of forcedNext) {
          const forcedPosition = positionOf(forcedKey);
          if (forcedPosition >= insertAt) insertAt = forcedPosition + 1;
        }
        queue.splice(insertAt, 0, entry);
        entryKeys.splice(insertAt, 0, key);
        forcedNext.push(key);
      } else {
        queue.push(entry);
        entryKeys.push(key);
      }
      if (shuffle) {
        if (next) {
          removeFromBag(key);
        } else {
          const insertAt = Math.floor(random() * (shuffleBag.length + 1));
          shuffleBag.splice(insertAt, 0, key);
        }
      }
      if (!context) context = root.PlaybackContext.create({ type: "single", tracks: [] });
      revision++;
      changed();
      return entry;
    }
    function remove(position) {
      if (!Number.isInteger(position) || position < 0 || position >= queue.length) return null;
      const [removed] = queue.splice(position, 1), [removedKey] = entryKeys.splice(position, 1);
      const wasCurrent = position === index;
      if (position < index) index--;
      else if (wasCurrent) index = -1;
      shuffleBag = shuffleBag.filter((key) => key !== removedKey);
      forcedNext = forcedNext.filter((key) => key !== removedKey);
      cycleConsumed.delete(removedKey);
      history = history.filter((entry) => entry.key !== removedKey);
      const oldCursor = pathCursor;
      const removedBeforeCursor = playbackPath.slice(0, oldCursor + 1)
        .filter((key) => key === removedKey).length;
      playbackPath = playbackPath.filter((key) => key !== removedKey);
      pathCursor = Math.max(-1, oldCursor - removedBeforeCursor);
      revision++;
      changed();
      return removed;
    }
    function update(position, value) {
      if (!Number.isInteger(position) || position < 0 || position >= queue.length) return null;
      queue[position] = { ...queue[position], ...value };
      revision++;
      changed();
      return clone(queue[position]);
    }
    function reorder(from, to) {
      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        to < 0 ||
        from >= queue.length ||
        to >= queue.length ||
        from === to
      )
        return false;
      const activeKey = keyAt(index);
      queue.splice(to, 0, queue.splice(from, 1)[0]);
      entryKeys.splice(to, 0, entryKeys.splice(from, 1)[0]);
      index = positionOf(activeKey);
      revision++;
      changed();
      return true;
    }
    function chooseShuffleKey() {
      if (forcedNext.length) return forcedNext.shift();
      if (pathCursor >= 0 && pathCursor + 1 < playbackPath.length) {
        pathCursor++;
        return playbackPath[pathCursor];
      }
      if (!shuffleBag.length && repeat === "all") {
        const currentKey = keyAt(index);
        cycleConsumed = new Set(currentKey == null ? [] : [currentKey]);
        buildShuffleBag({ exclude: cycleConsumed });
        if (!shuffleBag.length && currentKey != null && entryKeys.length === 1)
          shuffleBag = [currentKey];
      }
      const key = shuffleBag.shift() ?? null;
      return key;
    }
    function next() {
      if (!queue.length) return null;
      if (shuffle) {
        const key = chooseShuffleKey();
        const position = positionOf(key);
        return position < 0
          ? null
          : select(position, { recordSame: repeat === "all" && key === keyAt(index) });
      }
      let position = -1;
      if (forcedNext.length) position = positionOf(forcedNext.shift());
      else if (index < 0) position = 0;
      else if (index + 1 < queue.length) position = index + 1;
      else if (repeat === "all") {
        position = 0;
        cycleConsumed = new Set();
      }
      return position < 0
        ? null
        : select(position, {
            recordSame: repeat === "all" && keyAt(position) === keyAt(index),
          });
    }
    function previous() {
      if (shuffle) {
        if (pathCursor <= 0) return null;
        pathCursor--;
        const position = positionOf(playbackPath[pathCursor]);
        if (position < 0) return null;
        index = position;
        revision++;
        changed();
        return { token: revision, track: current(), index };
      }
      while (history.length) {
        const previous = history.pop(), position = positionOf(previous.key);
        if (position >= 0) {
          index = position;
          recordPlayback(keyAt(position));
          revision++;
          changed();
          return { token: revision, track: current(), index };
        }
      }
      const position = index > 0
        ? index - 1
        : repeat === "all" && index === 0 && queue.length > 1
          ? queue.length - 1
          : -1;
      if (position < 0) return null;
      index = position;
      recordPlayback(keyAt(position));
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function previousEntries() {
      if (shuffle)
        return shuffleHistory().map((entry, historyIndex) => ({ ...entry, historyIndex }));
      if (index < 0) return [];
      return queue.slice(0, index).map((entry, position) => ({
        entry: clone(entry),
        id: entry.id || "",
        position,
        historyIndex: -1,
      }));
    }
    function upcoming() {
      const entries = [];
      const add = (key, allowCurrent = false) => {
        const position = positionOf(key);
        if (
          position >= 0 &&
          (allowCurrent || key !== keyAt(index)) &&
          !entries.some((item) => item.key === key)
        )
          entries.push({ key, position, track: clone(queue[position]) });
      };
      if (shuffle) {
        forcedNext.forEach(add);
        playbackPath.slice(pathCursor + 1).forEach(add);
        shuffleBag.forEach(add);
        if (!entries.length && repeat === "all" && queue.length) {
          const currentKey = keyAt(index);
          const alternatives = entryKeys.filter((key) => key !== currentKey);
          if (alternatives.length) alternatives.forEach(add);
          else entryKeys.forEach((key) => add(key, true));
          return {
            determined: false,
            entries: entries.map(({ position, track }) => ({ position, track })),
          };
        }
        return {
          determined: true,
          entries: entries.map(({ position, track }) => ({ position, track })),
        };
      }
      const priorityKeys = forcedNext.slice();
      priorityKeys.forEach(add);
      const first = index >= 0 ? index + 1 : 0;
      for (let position = first; position < queue.length; position++)
        if (!priorityKeys.includes(keyAt(position))) add(keyAt(position));
      if (repeat === "all" && index >= 0)
        for (let position = 0; position < index; position++)
          if (!priorityKeys.includes(keyAt(position))) add(keyAt(position));
      return {
        determined: true,
        entries: entries.map(({ position, track }) => ({ position, track })),
      };
    }
    function setModes(value = {}) {
      const wasShuffle = shuffle;
      if (typeof value.shuffle === "boolean") shuffle = value.shuffle;
      if (["off", "all", "one"].includes(value.repeat)) repeat = value.repeat;
      if (shuffle && !wasShuffle) buildShuffleBag();
      else if (!shuffle && wasShuffle)
        history = playbackPath
          .slice(0, pathCursor)
          .map(historyEntry)
          .filter(Boolean)
          .slice(-MAX_HISTORY_ENTRIES);
      revision++;
      return changed();
    }
    function invalidate() {
      revision++;
      changed();
      return revision;
    }
    function clear() {
      context = null;
      queue = [];
      entryKeys = [];
      index = -1;
      history = [];
      playbackPath = [];
      pathCursor = -1;
      shuffleBag = [];
      cycleConsumed = new Set();
      forcedNext = [];
      revision++;
      changed();
    }
    return {
      snapshot,
      current,
      start,
      select,
      replayFromHistory,
      append,
      remove,
      update,
      reorder,
      next,
      previous,
      previousEntries,
      upcoming,
      setModes,
      invalidate,
      clear,
      isCurrent: (token) => token === revision,
    };
  }

  root.QueueManager = { create };
  if (typeof module !== "undefined") module.exports = root.QueueManager;
})(globalThis);
