/* Runtime playback sequence. Persistent playlists remain outside this owner. */
(function (root) {
  const clone = (value) => ({ ...value });

  function create({ onChange = () => {} } = {}) {
    let context = null;
    let queue = [];
    let index = -1;
    let history = [];
    let forcedNext = -1;
    let shuffle = false;
    let repeat = "off";
    let revision = 0;

    function snapshot() {
      return {
        context: context ? { ...context, tracks: context.tracks.map(clone) } : null,
        queue: queue.map(clone),
        index,
        history: history.slice(),
        shuffle,
        repeat,
        priorityNext: forcedNext >= 0 && forcedNext < queue.length ? forcedNext : -1,
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
    function start(value) {
      context = root.PlaybackContext.create(value);
      queue = context.tracks.map(clone);
      index = queue.length ? context.startIndex : -1;
      history = [];
      forcedNext = -1;
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function select(position) {
      if (!Number.isInteger(position) || position < 0 || position >= queue.length) return null;
      if (index >= 0 && index !== position)
        history.push({ entry: current(), id: current()?.id || "" });
      index = position;
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function replayFromHistory(historyPosition) {
      if (
        !Number.isInteger(historyPosition) ||
        historyPosition < 0 ||
        historyPosition >= history.length
      )
        return null;
      const previous = history[historyPosition];
      let position = queue.indexOf(previous.entry);
      if (position < 0 && previous.id)
        position = queue.findIndex((entry) => entry.id === previous.id);
      if (position < 0 && previous.entry) {
        queue.push(clone(previous.entry));
        position = queue.length - 1;
      }
      if (position < 0) return null;
      history.length = historyPosition;
      index = position;
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function append(value, { next = false } = {}) {
      const entry = clone(value);
      if (next && index >= 0) {
        queue.splice(index + 1, 0, entry);
        forcedNext = index + 1;
      }
      else queue.push(entry);
      if (!context) context = root.PlaybackContext.create({ type: "single", tracks: [] });
      revision++;
      changed();
      return entry;
    }
    function remove(position) {
      if (!Number.isInteger(position) || position < 0 || position >= queue.length) return null;
      const [removed] = queue.splice(position, 1);
      if (position < index) index--;
      else if (position === index) index = -1;
      if (position < forcedNext) forcedNext--;
      else if (position === forcedNext) forcedNext = -1;
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
      const active = current(), forced = queue[forcedNext];
      queue.splice(to, 0, queue.splice(from, 1)[0]);
      index = active ? queue.findIndex((entry) => entry === active) : index;
      forcedNext = forced ? queue.findIndex((entry) => entry === forced) : -1;
      revision++;
      changed();
      return true;
    }
    function next() {
      if (!queue.length) return null;
      if (repeat === "one" && index >= 0)
        return { token: revision, track: current(), index };
      let position = -1;
      if (forcedNext >= 0 && forcedNext < queue.length) {
        position = forcedNext;
        forcedNext = -1;
      } else if (index < 0) position = shuffle
        ? Math.floor(Math.random() * queue.length)
        : 0;
      else if (shuffle && queue.length > 1) {
        const choices = queue.map((_, i) => i).filter((i) => i !== index);
        position = choices[Math.floor(Math.random() * choices.length)];
      } else if (index + 1 < queue.length) position = index + 1;
      else if (repeat === "all") position = 0;
      return position < 0 ? null : select(position);
    }
    function previous() {
      while (history.length) {
        const previous = history.pop();
        let position = queue.indexOf(previous.entry);
        if (position < 0 && previous.id)
          position = queue.findIndex((entry) => entry.id === previous.id);
        if (position < 0 && previous.entry) {
          queue.push(clone(previous.entry));
          position = queue.length - 1;
        }
        if (position >= 0 && position !== index) {
          index = position;
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
      revision++;
      changed();
      return { token: revision, track: current(), index };
    }
    function upcoming() {
      const positions = [];
      const priority = forcedNext >= 0 && forcedNext < queue.length && forcedNext !== index
        ? forcedNext
        : -1;
      if (repeat === "one" && index >= 0)
        return { determined: true, entries: [] };
      if (priority >= 0) positions.push(priority);
      if (shuffle) {
        for (let position = 0; position < queue.length; position++)
          if (position !== index && position !== priority) positions.push(position);
        return {
          determined: false,
          entries: positions.map((position) => ({
            position,
            track: clone(queue[position]),
          })),
        };
      }
      const first = index >= 0 ? index + 1 : 0;
      for (let position = first; position < queue.length; position++)
        if (position !== priority) positions.push(position);
      if (repeat === "all" && index >= 0)
        for (let position = 0; position < index; position++)
          if (position !== priority) positions.push(position);
      return {
        determined: true,
        entries: positions.map((position) => ({
          position,
          track: clone(queue[position]),
        })),
      };
    }
    function setModes(value = {}) {
      if (typeof value.shuffle === "boolean") shuffle = value.shuffle;
      if (["off", "all", "one"].includes(value.repeat)) repeat = value.repeat;
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
      index = -1;
      history = [];
      forcedNext = -1;
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
