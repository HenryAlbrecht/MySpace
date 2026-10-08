/* Network recovery is per peer and independent of signaling/room lifetime. */
(function (root) {
  const TIMING = Object.freeze({
    graceMs: 5000,
    attemptMs: 12000,
    backoffMs: 3000,
    maxAttempts: 3,
    membershipGraceMs: 30000,
  });
  async function getPeerConnectionDiagnostics(pc) {
    const result = {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState,
      candidatePair: null,
    };
    if (!pc.getStats) return result;
    try {
      const report = await pc.getStats(),
        stats = [];
      report.forEach((s) => stats.push(s));
      const transport = stats.find((s) => s.type === "transport" && s.selectedCandidatePairId);
      const pair =
        (transport && report.get(transport.selectedCandidatePairId)) ||
        stats.find((s) => s.type === "candidate-pair" && s.selected) ||
        stats.find((s) => s.type === "candidate-pair" && s.nominated && s.state === "succeeded");
      if (!pair) return result;
      const local = report.get(pair.localCandidateId) || {},
        remote = report.get(pair.remoteCandidateId) || {};
      const type = (v) => (["host", "srflx", "prflx", "relay"].includes(v) ? v : null);
      const protocol = (v) => (["udp", "tcp", "tls"].includes(v) ? v : null);
      const localType = type(local.candidateType),
        remoteType = type(remote.candidateType);
      const relay = localType === "relay" || remoteType === "relay";
      result.candidatePair = {
        localType,
        remoteType,
        protocol: protocol(local.protocol || remote.protocol),
        relayProtocol: protocol(local.relayProtocol || remote.relayProtocol),
        networkType: typeof local.networkType === "string" ? local.networkType : null,
        rtt:
          typeof pair.currentRoundTripTime === "number" ? pair.currentRoundTripTime * 1000 : null,
        route: relay
          ? "relay"
          : localType === "srflx" || remoteType === "srflx"
            ? "stun/direct"
            : "direct",
      };
    } catch {}
    return result;
  }
  function createRecovery({
    restart,
    requestRestart = () => {},
    leader = true,
    onState = () => {},
    timing = TIMING,
    setTimer = root.setTimeout,
    clearTimer = root.clearTimeout,
  }) {
    let timer = null,
      attempts = 0,
      closed = false,
      available = true,
      state = "connecting",
      raw = "new",
      epoch = 0,
      inFlight = false;
    const publish = (v) => {
      if (state !== v) {
        state = v;
        onState(v);
      }
    };
    function cancel() {
      epoch++;
      if (timer !== null) clearTimer(timer);
      timer = null;
    }
    function schedule(delay) {
      if (closed || timer !== null || !available || inFlight) return;
      timer = setTimer(() => {
        timer = null;
        void attempt();
      }, delay);
    }
    async function attempt() {
      if (closed || !available || state === "connected") return;
      if (attempts >= timing.maxAttempts) {
        publish("failed");
        return;
      }
      attempts++;
      publish("reconnecting");
      const token = epoch;
      inFlight = true;
      try {
        if (leader) await restart();
        else requestRestart();
      } catch {
      } finally {
        inFlight = false;
      }
      if (closed || token !== epoch || state === "connected") return;
      schedule(timing.attemptMs + timing.backoffMs * (attempts - 1));
    }
    return {
      update(connection, ice) {
        raw = ice || connection;
        if (closed) return;
        if (connection === "closed" || ice === "closed") {
          cancel();
          publish("closed");
          return;
        }
        if (
          ice === "failed" ||
          connection === "failed" ||
          ice === "disconnected" ||
          connection === "disconnected"
        ) {
          if (state === "failed") return;
          publish("reconnecting");
          schedule(raw === "failed" ? 0 : timing.graceMs);
          return;
        }
        if (connection === "connected" || ice === "connected" || ice === "completed") {
          cancel();
          attempts = 0;
          publish("connected");
          return;
        }
        if (state !== "reconnecting" && state !== "failed") publish("connecting");
      },
      setAvailable(value) {
        available = !!value;
        if (!available) cancel();
        else if (state === "reconnecting") schedule(timing.graceMs);
      },
      requested() {
        if (!leader || closed) return;
        publish("reconnecting");
        schedule(0);
      },
      retry() {
        if (closed) return;
        cancel();
        attempts = 0;
        publish("reconnecting");
        schedule(0);
      },
      close() {
        closed = true;
        cancel();
        publish("closed");
      },
      get state() {
        return state;
      },
      get attempts() {
        return attempts;
      },
    };
  }
  const api = { TIMING, getPeerConnectionDiagnostics, createRecovery };
  root.PARTY_NETWORK = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
